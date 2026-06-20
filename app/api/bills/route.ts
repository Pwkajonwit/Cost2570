import { NextRequest, NextResponse } from "next/server";
import { TABLES } from "@/lib/config";
import { clearCache } from "@/lib/cache";
import { createBillPdfFromHtml, uploadBillImage } from "@/lib/drive";
import { applyBillFormulas } from "@/lib/formulas";
import { appendRow, getRows } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";

const BILL_IMAGE_COLUMNS = ["รูปถ่ายบิล"];
const SEQUENCE_COLUMNS = ["ลำดับ", "ลำดับtest"];
const BILL_DATE_COLUMNS = ["ว/ด/ป"];
const STATUS_COLUMNS = ["สถานะ"];

export async function POST(request: NextRequest) {
  try {
    const row = await readBillRow(request);
    const output = await applyBillFormulas(row);
    applyAppSheetBillSystemFields(output);
    const pdfWarning = await attachBillPdf(output);
    await appendRow(TABLES.DATA, output);
    clearCache("rows:");
    return NextResponse.json({ ok: true, row: output, pdfWarning });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

async function readBillRow(request: NextRequest): Promise<SheetRow> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return ensureUniqueBillSequence(ensureBillStatus(await request.json()));
  }

  const formData = await request.formData();
  const row: SheetRow = {};

  for (const [key, value] of formData.entries()) {
    if (isFile(value)) continue;
    row[key] = value;
  }

  await ensureUniqueBillSequence(row);

  const billImageField = findFileField(formData, BILL_IMAGE_COLUMNS);
  const billImages = billImageField ? formData.getAll(billImageField).filter(isUsableFile) : [];
  if (billImageField && billImages.length) {
    const uploadedUrls = await Promise.all(
      billImages.map((billImage, index) =>
        uploadBillImage(billImage, {
          sequence: sequenceWithIndex(firstRowValue(row, SEQUENCE_COLUMNS), index, billImages.length),
          projectId: String(row["ID Project"] || ""),
          billDate: firstRowValue(row, BILL_DATE_COLUMNS)
        })
      )
    );
    row[billImageField] = uploadedUrls.join(", ");
  }

  return ensureBillStatus(row);
}

function ensureBillStatus(row: SheetRow) {
  STATUS_COLUMNS.forEach(column => {
    if (row[column] === undefined || row[column] === null || String(row[column]).trim() === "") {
      row[column] = "รออนุมัติ";
    }
  });
  return row;
}

function applyAppSheetBillSystemFields(row: SheetRow) {
  row["3เปอร์เซ็น"] = String(toNumber(row["3เปอร์เซ็น"]) || deductAmount(row));
  row["textnumber "] = thaiBahtText(toNumber(row["3เปอร์เซ็น"]));
  if (!hasValue(row["filed"])) row["filed"] = buildFiledPath(row);
  ensureBillStatus(row);
  return row;
}

async function attachBillPdf(row: SheetRow) {
  try {
    const url = await createBillPdfFromHtml(buildBillPdfHtml(row), {
      sequence: firstRowValue(row, SEQUENCE_COLUMNS),
      projectId: String(row["ID Project"] || ""),
      billDate: firstRowValue(row, BILL_DATE_COLUMNS)
    });
    row["filed"] = url;
    return "";
  } catch (error) {
    return errorMessage(error);
  }
}

function deductAmount(row: SheetRow) {
  if (hasValue(row["หัก"]) && hasValue(row["ค่าแรง+พนักงาน+อื่นๆ"])) {
    return toNumber(row["ค่าแรง+พนักงาน+อื่นๆ"]) * toNumber(row["หัก"]) * 0.01;
  }
  if (hasValue(row["หัก"])) {
    return (toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"])) * toNumber(row["หัก"]) * 0.01;
  }
  return 0;
}

function buildFiledPath(row: SheetRow) {
  const dateValue = firstRowValue(row, BILL_DATE_COLUMNS) || new Date().toLocaleDateString("th-TH");
  const [day, month] = dateValue.split(/[/-]/).map(value => Number(value));
  const monthLabel = Number.isFinite(month) && month > 0 ? ` เดือน  ${month} ยื่นภาษี` : "ยื่นภาษี";
  const sequence = firstRowValue(row, SEQUENCE_COLUMNS);
  const laborStatus = String(row["statusค่าแรง"] || "").trim();
  const folder = laborStatus ? `${laborStatus} ${monthLabel}` : monthLabel;
  return `My Drive/appsheet/data/Cost-584789250-24-06-08/${folder}/${sequence}สัญญาจ้างเหมา.pdf`;
}

function buildBillPdfHtml(row: SheetRow) {
  const moneyRows = [
    ["ค่าของ", rowText(row, "ค่าของ")],
    ["VAT", rowText(row, "vat")],
    ["ค่าแรง", rowText(row, "ค่าแรง")],
    ["พนักงาน", rowText(row, "พนักงาน")],
    ["น้ำมัน", rowText(row, "น้ำมัน")],
    ["ซ่อมรถ", rowText(row, "ซ่อมรถ")],
    ["เครื่องจักร", rowText(row, "เครื่องจักร")],
    ["เครื่องมือ", rowText(row, "เครื่องมือ")],
    ["อื่นๆ", rowText(row, "อื่นๆ")],
    ["หัก", rowText(row, "หัก")],
    ["3%", rowText(row, "3เปอร์เซ็น")]
  ].filter(([, value]) => hasValue(value) && toNumber(value) !== 0);

  const detailRows = [
    ["ลำดับ", firstRowValue(row, SEQUENCE_COLUMNS)],
    ["ID Project", rowText(row, "ID Project")],
    ["ชื่อ Project", rowText(row, "ชื่อ Project")],
    ["ร้านค้า/ผู้รับเหมา", rowText(row, "ร้านค้า/ผู้รับเหมา")],
    ["ร้านค้า", rowText(row, "ร้านค้า")],
    ["ผู้รับเหมา", rowText(row, "ผู้รับเหมา")],
    ["สินค้า/ทำงาน", rowText(row, "สินค้า") || rowText(row, "ชื่อเครื่องมือ") || rowText(row, "รายละเอียดงาน")],
    ["บิล", rowText(row, "บิล")],
    ["ประเภท", rowText(row, "ประเภท")],
    ["ผู้เบิก", rowText(row, "ผู้เบิก")],
    ["วันที่", firstRowValue(row, BILL_DATE_COLUMNS)],
    ["สถานะ", firstRowValue(row, STATUS_COLUMNS)]
  ].filter(([, value]) => hasValue(value));

  const total = [
    "ค่าของ",
    "vat",
    "ค่าแรง",
    "พนักงาน",
    "น้ำมัน",
    "ซ่อมรถ",
    "เครื่องจักร",
    "เครื่องมือ",
    "อื่นๆ"
  ].reduce((sum, column) => sum + toNumber(row[column]), 0);

  const detailHtml = detailRows.map(([label, value]) => `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${escapeHtml(String(value))}</td>
    </tr>
  `).join("");

  const moneyHtml = moneyRows.map(([label, value]) => `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="money">${escapeHtml(formatMoney(toNumber(value)))}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, "Noto Sans Thai", sans-serif; color: #172033; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #15803d; padding-bottom: 12px; margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .muted { color: #64748b; }
    .badge { background: #dcfce7; color: #166534; border-radius: 999px; padding: 6px 12px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 14px; }
    .card { border: 1px solid #d7e0ea; border-radius: 10px; overflow: hidden; }
    .card h2 { font-size: 15px; margin: 0; padding: 10px 12px; background: #f8fafc; border-bottom: 1px solid #d7e0ea; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #eef2f7; vertical-align: top; }
    th { width: 34%; text-align: left; color: #52627a; font-weight: 700; }
    .money { text-align: right; font-weight: 700; color: #0f766e; }
    .total { margin-top: 14px; border: 2px solid #15803d; border-radius: 10px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: baseline; }
    .total-label { font-size: 15px; font-weight: 700; }
    .total-value { font-size: 26px; font-weight: 800; color: #0f766e; }
    .text-number { margin-top: 8px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>เอกสารบิล</h1>
      <div class="muted">${escapeHtml(rowText(row, "ชื่อ Project") || "-")}</div>
    </div>
    <div class="badge">${escapeHtml(firstRowValue(row, SEQUENCE_COLUMNS) || "-")}</div>
  </div>
  <div class="grid">
    <section class="card">
      <h2>ข้อมูลบิล</h2>
      <table>${detailHtml}</table>
    </section>
    <section class="card">
      <h2>ยอดเงิน</h2>
      <table>${moneyHtml || "<tr><td>ไม่มีรายการยอดเงิน</td><td></td></tr>"}</table>
    </section>
  </div>
  <div class="total">
    <span class="total-label">ยอดรวม</span>
    <span class="total-value">${escapeHtml(formatMoney(total))} บาท</span>
  </div>
  <div class="text-number">${escapeHtml(rowText(row, "textnumber ") || "")}</div>
</body>
</html>`;
}

function thaiBahtText(amount: number) {
  const rounded = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);
  const bahtText = `${thaiNumberText(baht)}บาท`;
  return satang ? `${bahtText}${thaiNumberText(satang)}สตางค์` : `${bahtText}ถ้วน`;
}

function thaiNumberText(value: number): string {
  if (!value) return "ศูนย์";
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const million = 1_000_000;
  if (value >= million) {
    const head = Math.floor(value / million);
    const tail = value % million;
    return `${thaiNumberText(head)}ล้าน${tail ? thaiNumberText(tail) : ""}`;
  }

  const chars = String(value).split("").map(Number);
  return chars.map((digit, index) => {
    if (!digit) return "";
    const position = chars.length - index - 1;
    if (position === 0 && digit === 1 && chars.length > 1) return "เอ็ด";
    if (position === 1 && digit === 1) return "สิบ";
    if (position === 1 && digit === 2) return "ยี่สิบ";
    return `${digits[digit]}${positions[position]}`;
  }).join("");
}

function rowText(row: SheetRow, column: string) {
  const value = row[column];
  return value === null || value === undefined ? "" : String(value).trim();
}

function formatMoney(value: number) {
  return (Number.isFinite(value) ? value : 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function ensureUniqueBillSequence(row: SheetRow) {
  const rows = await getRows(TABLES.DATA, 15_000);
  const currentSequence = firstRowValue(row, SEQUENCE_COLUMNS).trim();
  const usedSequences = new Set(
    rows
      .map(existingRow => firstRowValue(existingRow, SEQUENCE_COLUMNS).trim())
      .filter(Boolean)
  );

  if (currentSequence && !usedSequences.has(currentSequence)) {
    row["ลำดับ"] = currentSequence;
    return row;
  }

  const nextSequence = rows.reduce((max, existingRow) => {
    return Math.max(max, ...SEQUENCE_COLUMNS.map(column => toSequenceNumber(existingRow[column])));
  }, 0) + 1;
  row["ลำดับ"] = String(nextSequence);
  return row;
}

function toSequenceNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findFileField(formData: FormData, columns: string[]) {
  return columns.find(column => formData.getAll(column).some(isUsableFile));
}

function firstRowValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (value !== null && value !== undefined && value !== "") return String(value);
  }
  return "";
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
    typeof value === "object" &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value
  );
}

function isUsableFile(value: FormDataEntryValue): value is File {
  return isFile(value) && value.size > 0;
}

function sequenceWithIndex(sequence: string, index: number, total: number) {
  if (total <= 1) return sequence;
  const suffix = String(index + 1).padStart(2, "0");
  return sequence ? `${sequence}-${suffix}` : suffix;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Save bill failed";
}
