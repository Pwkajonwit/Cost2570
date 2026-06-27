import { NextRequest, NextResponse } from "next/server";
import { clearCache } from "@/lib/cache";
import { canEditOrDeleteBill, validateBillStatusTransition } from "@/lib/bill-status";
import { validateBillRelations } from "@/lib/bill-validation";
import { PRIMARY_VIEWS, TABLE_KEYS, TABLES, VIEW_COLUMNS } from "@/lib/config";
import { uploadTableImage } from "@/lib/drive";
import { applyBillFormulas, applyContractFormulas, applyProjectFormulas } from "@/lib/formulas";
import { getFormSchema } from "@/lib/schemas";
import { appendAuditLog, appendRow, deleteRows, getRows, updateRow } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get("tableName");
  const viewName = request.nextUrl.searchParams.get("viewName") || "";
  const limit = Number(request.nextUrl.searchParams.get("limit") || 120);
  const search = request.nextUrl.searchParams.get("search") || "";
  if (!tableName) return NextResponse.json({ error: "Missing tableName" }, { status: 400 });

  let rows = await getRows(tableName);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(q)));
  }
  const keyColumn = TABLE_KEYS[tableName] || "_RowNumber";
  rows = rows.slice(0, limit);

  return NextResponse.json({
    tableName,
    viewName,
    columns: VIEW_COLUMNS[viewName] || Object.keys(rows[0] || {}),
    keyColumn,
    rows
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await readPostBody(request);
    const tableName = String(body.tableName || "");
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    const row = body.row && typeof body.row === "object" ? body.row as SheetRow : {};
    sanitizeBySchema(row, tableName);
    validateRequiredBySchema(row, tableName);
    const output = tableName === TABLES.CONTRACT_WORK
      ? await applyContractFormulas(row)
      : tableName === TABLES.PROJECT
        ? applyProjectFormulas(row)
        : row;
    await appendRow(tableName, output);
    await appendAuditLog({
      action: "CREATE",
      tableName,
      key: String(output[TABLE_KEYS[tableName]] || ""),
      actor: actorFromRequest(request),
      details: { projectId: output["ID Project"] || "" }
    }).catch(() => undefined);
    clearCache("rows:");
    clearCache("headers:");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await readPatchBody(request);
    const tableName = String(body.tableName || "");
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    const sheetRow = Number(body.sheetRow);
    const patch = body.values && typeof body.values === "object" ? body.values as SheetRow : {};
    const existingRows = await getRows(tableName);
    const existing = existingRows.find(row => Number(row._sheetRow) === sheetRow);
    if (!existing) throw new Error("ไม่พบข้อมูลที่ต้องการแก้ไข");
    const values = { ...existing, ...patch };
    if (tableName === TABLES.DATA) validateBillPatch(existing, patch, values);
    sanitizeBySchema(values, tableName);
    validateRequiredBySchema(values, tableName);
    if (tableName === TABLES.DATA) await validateBillRelations(values);
    const output = tableName === TABLES.CONTRACT_WORK
      ? await applyContractFormulas(values)
      : tableName === TABLES.PROJECT
        ? applyProjectFormulas(values)
        : tableName === TABLES.DATA
          ? await applyBillFormulas(values)
          : values;
    const row = await updateRow(tableName, sheetRow, output);
    await appendAuditLog({
      action: tableName === TABLES.DATA && Object.keys(patch).every(key => key === "สถานะ") ? "STATUS" : "UPDATE",
      tableName,
      key: String(row[TABLE_KEYS[tableName]] || ""),
      sheetRow,
      actor: actorFromRequest(request),
      details: Object.fromEntries(Object.keys(patch).map(key => [key, row[key] ?? ""]))
    }).catch(() => undefined);
    clearCache("rows:");
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const tableName = String(body.tableName || "");
    if (!canManageTable(tableName)) return NextResponse.json({ error: "Table is not manageable" }, { status: 403 });

    const sheetRows = Array.isArray(body.sheetRows) ? body.sheetRows.map(Number) : [];
    const deletingRows = (await getRows(tableName)).filter(row => sheetRows.includes(Number(row._sheetRow)));
    if (tableName === TABLES.PROJECT) await validateProjectDelete(sheetRows);
    if (tableName === TABLES.DATA) await validateBillDelete(sheetRows);
    await deleteRows(tableName, sheetRows);
    await Promise.all(deletingRows.map(row => appendAuditLog({
      action: "DELETE",
      tableName,
      key: String(row[TABLE_KEYS[tableName]] || ""),
      sheetRow: Number(row._sheetRow),
      actor: actorFromRequest(request),
      details: { projectId: row["ID Project"] || "" }
    }).catch(() => undefined)));
    clearCache("rows:");
    return NextResponse.json({ ok: true, deleted: sheetRows.length });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function validateBillPatch(existing: SheetRow, patch: SheetRow, values: SheetRow) {
  const patchKeys = Object.keys(patch).filter(key => key !== "_sheetRow");
  const statusOnly = patchKeys.length > 0 && patchKeys.every(key => key === "สถานะ");
  if (statusOnly) {
    validateBillStatusTransition(existing["สถานะ"], values["สถานะ"]);
    return;
  }
  if (!canEditOrDeleteBill(existing["สถานะ"])) {
    throw new Error("แก้ไขได้เฉพาะบิลที่รออนุมัติ");
  }
  if (String(values["สถานะ"] || "").trim() !== String(existing["สถานะ"] || "").trim()) {
    throw new Error("กรุณาเปลี่ยนสถานะผ่านปุ่ม Workflow");
  }
}

async function validateBillDelete(sheetRows: number[]) {
  const rows = await getRows(TABLES.DATA);
  const blocked = rows.filter(row => sheetRows.includes(Number(row._sheetRow)) && !canEditOrDeleteBill(row["สถานะ"]));
  if (blocked.length) throw new Error("ลบได้เฉพาะบิลที่รออนุมัติ");
}

function canManageTable(tableName: string) {
  return PRIMARY_VIEWS.some(view => view.type === "table" && view.table === tableName);
}

function actorFromRequest(request: NextRequest) {
  return request.headers.get("x-user-email") || "web";
}

function sanitizeBySchema(row: SheetRow, tableName: string) {
  const schema = getFormSchema(tableName);
  schema.forEach(field => {
    if (field.type === "Hidden") return;
    if (isFieldVisible(field, row)) return;
    row[field.name] = "";
  });
  return row;
}

function validateRequiredBySchema(row: SheetRow, tableName: string) {
  const missing = getFormSchema(tableName).find(field => {
    if (!field.required || field.type === "Hidden" || field.readonly) return false;
    if (!isFieldVisible(field, row)) return false;
    return !hasRowValue(row[field.name]);
  });
  if (missing) throw new Error(`กรุณากรอก ${missing.name}`);
}

function isFieldVisible(field: ReturnType<typeof getFormSchema>[number], row: SheetRow) {
  if (!field.showIf) return true;
  const actual = row[field.showIf.column] || "";
  if (field.showIf.equals !== undefined) return String(actual) === field.showIf.equals;
  if (field.showIf.in) return field.showIf.in.includes(String(actual));
  if (field.showIf.notBlank) return hasRowValue(actual);
  return true;
}

function hasRowValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

async function validateProjectDelete(sheetRows: number[]) {
  const [projects, dataRows, contractRows] = await Promise.all([
    getRows(TABLES.PROJECT),
    getRows(TABLES.DATA),
    getRows(TABLES.CONTRACT_WORK)
  ]);
  const deletingProjects = projects.filter(row => sheetRows.includes(Number(row._sheetRow)));
  const blocked = deletingProjects.flatMap(project => {
    const projectId = String(project["ID Project"] || "").trim();
    if (!projectId) return [];
    const billCount = dataRows.filter(row => String(row["ID Project"] || "").trim() === projectId).length;
    const contractCount = contractRows.filter(row => String(row["ID Project"] || "").trim() === projectId).length;
    return billCount || contractCount ? [`${projectId} (${billCount} บิล, ${contractCount} เปิดจ้าง)`] : [];
  });
  if (blocked.length) {
    throw new Error(`ลบ Project ไม่ได้ เพราะมีข้อมูลที่ผูกอยู่: ${blocked.slice(0, 5).join(", ")}`);
  }
}

async function readPostBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const formData = await request.formData();
  const tableName = String(formData.get("tableName") || "");
  const row: SheetRow = {};
  for (const [key, value] of formData.entries()) {
    if (key === "tableName" || isFile(value)) continue;
    row[key] = typeof value === "string" ? value : "";
  }
  await attachUploadedFiles(formData, tableName, row);
  return { tableName, row };
}

async function readPatchBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const formData = await request.formData();
  const tableName = String(formData.get("tableName") || "");
  const sheetRow = Number(formData.get("sheetRow"));
  const values: SheetRow = {};
  for (const [key, value] of formData.entries()) {
    if (key === "tableName" || key === "sheetRow" || isFile(value)) continue;
    values[key] = typeof value === "string" ? value : "";
  }
  await attachUploadedFiles(formData, tableName, values);
  return { tableName, sheetRow, values };
}

async function attachUploadedFiles(formData: FormData, tableName: string, row: SheetRow) {
  const filesByColumn = new Map<string, File[]>();
  for (const [key, value] of formData.entries()) {
    if (!isFile(value) || value.size <= 0) continue;
    if (!value.type.startsWith("image/")) continue;
    filesByColumn.set(key, [...(filesByColumn.get(key) || []), value]);
  }

  for (const [columnName, files] of filesByColumn) {
    const uploadedUrls = await Promise.all(
      files.map(file => uploadTableImage(file, {
        tableName,
        rowKey: String(row[TABLE_KEYS[tableName] || ""] || row.id_bank || row["ID Project"] || ""),
        columnName
      }))
    );
    row[columnName] = uploadedUrls.join(", ");
  }
}

function isFile(value: FormDataEntryValue): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}
