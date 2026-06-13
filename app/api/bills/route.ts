import { NextRequest, NextResponse } from "next/server";
import { TABLES } from "@/lib/config";
import { clearCache } from "@/lib/cache";
import { uploadBillImage } from "@/lib/drive";
import { applyBillFormulas } from "@/lib/formulas";
import { appendRow } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";

const BILL_IMAGE_COLUMNS = ["รูปถ่ายบิล", "à¸£à¸¹à¸›à¸–à¹ˆà¸²à¸¢à¸šà¸´à¸¥"];
const SEQUENCE_COLUMNS = ["ลำดับ", "à¸¥à¸³à¸”à¸±à¸š"];
const BILL_DATE_COLUMNS = ["ว/ด/ป", "à¸§/à¸”/à¸›"];

export async function POST(request: NextRequest) {
  try {
    const row = await readBillRow(request);
    const output = await applyBillFormulas(row);
    await appendRow(TABLES.DATA, output);
    clearCache("rows:");
    return NextResponse.json({ ok: true, row: output });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

async function readBillRow(request: NextRequest): Promise<SheetRow> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return request.json();
  }

  const formData = await request.formData();
  const row: SheetRow = {};

  for (const [key, value] of formData.entries()) {
    if (isFile(value)) continue;
    row[key] = value;
  }

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

  return row;
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
