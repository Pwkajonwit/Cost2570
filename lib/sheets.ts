import { google } from "googleapis";
import { cached } from "@/lib/cache";
import { SHEET_ID, TABLE_KEYS } from "@/lib/config";
import type { RefOption, RowValue, SheetRow } from "@/lib/types";

const GOOGLE_READ_TIMEOUT_MS = 20_000;
const AUDIT_SHEET = "ระบบLog";
const AUDIT_HEADERS = ["เวลา", "การทำงาน", "ตาราง", "รหัส", "แถว", "ผู้ใช้งาน", "รายละเอียด"];

export type AuditEntry = {
  action: string;
  tableName: string;
  key?: string;
  sheetRow?: number;
  actor?: string;
  details?: Record<string, unknown>;
};

function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account credentials.");
  }
  return { client_email: clientEmail, private_key: privateKey };
}

async function getSheetsClient() {
  const credentials = getCredentials();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });
  return google.sheets({ version: "v4", auth });
}

export async function getRows(tableName: string, ttlMs = 300_000): Promise<SheetRow[]> {
  return cached(`rows:${tableName}`, ttlMs, async () => {
    const sheets = await getSheetsClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${tableName}'`
    }, { timeout: GOOGLE_READ_TIMEOUT_MS });
    const values = result.data.values || [];
    const headers = (values[0] || []).map(String);
    return values.slice(1).map((line, rowIndex) => toRow(headers, line, rowIndex + 2));
  });
}

export async function getHeaders(tableName: string): Promise<string[]> {
  const rows = await cached(`headers:${tableName}`, 300_000, async () => {
    const sheets = await getSheetsClient();
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${tableName}'!1:1`
    }, { timeout: GOOGLE_READ_TIMEOUT_MS });
    return (result.data.values?.[0] || []).map(String);
  });
  return rows;
}

export async function listRefOptions(tableName: string, options: {
  keyColumn?: string;
  labelColumn?: string;
  validIf?: string;
  rowColumns?: string[];
} = {}): Promise<RefOption[]> {
  let rows = await getRows(tableName, 120_000);
  if (options.validIf === "activeProjects") {
    rows = rows.filter(row => row.color === "Red" || row.color === "Green");
  }

  const keyColumn = options.keyColumn || TABLE_KEYS[tableName] || "_RowNumber";
  const labelColumn = options.labelColumn || keyColumn;
  const rowColumns = unique([keyColumn, labelColumn, ...(options.rowColumns || [])]);

  return rows
    .filter(row => row[keyColumn] !== "" && row[keyColumn] !== undefined && row[keyColumn] !== null)
    .slice(0, 1000)
    .map(row => ({
      value: row[keyColumn],
      label: row[labelColumn] ? `${row[keyColumn]} - ${row[labelColumn]}` : String(row[keyColumn]),
      row: pick(row, rowColumns)
    }));
}

export async function appendRow(tableName: string, row: SheetRow) {
  const sheets = await getSheetsClient();
  const headers = await getHeaders(tableName);
  const values = headers.map(header => row[header] ?? "");
  const nextRow = await nextWriteRow(sheets, tableName);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheet(tableName)}!A${nextRow}:${columnName(headers.length)}${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}

async function nextWriteRow(sheets: Awaited<ReturnType<typeof getSheetsClient>>, tableName: string) {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: quoteSheet(tableName)
  }, { timeout: GOOGLE_READ_TIMEOUT_MS });
  return (result.data.values || []).length + 1;
}

export async function updateRow(tableName: string, sheetRow: number, patch: SheetRow) {
  if (!Number.isInteger(sheetRow) || sheetRow < 2) throw new Error("Invalid sheet row.");

  const sheets = await getSheetsClient();
  const headers = await getHeaders(tableName);
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheet(tableName)}!${sheetRow}:${sheetRow}`
  }, { timeout: GOOGLE_READ_TIMEOUT_MS });
  const currentValues = existing.data.values?.[0] || [];
  const current = toRow(headers, currentValues, sheetRow);
  const next = { ...current, ...patch };
  const values = headers.map(header => next[header] ?? "");

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheet(tableName)}!A${sheetRow}:${columnName(headers.length)}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });

  return next;
}

export async function deleteRows(tableName: string, sheetRows: number[]) {
  const rows = [...new Set(sheetRows)]
    .filter(row => Number.isInteger(row) && row >= 2)
    .sort((a, b) => b - a);
  if (!rows.length) throw new Error("No rows selected.");

  const sheets = await getSheetsClient();
  const sheetId = await getSheetId(tableName);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: rows.map(row => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: "ROWS",
            startIndex: row - 1,
            endIndex: row
          }
        }
      }))
    }
  });
}

export async function appendAuditLog(entry: AuditEntry) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties"
  }, { timeout: GOOGLE_READ_TIMEOUT_MS });
  const exists = spreadsheet.data.sheets?.some(item => item.properties?.title === AUDIT_SHEET);

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: AUDIT_SHEET } } }] }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${quoteSheet(AUDIT_SHEET)}!A1:G1`,
        valueInputOption: "RAW",
        requestBody: { values: [AUDIT_HEADERS] }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists/i.test(message)) throw error;
    }
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${quoteSheet(AUDIT_SHEET)}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: [[
        new Date().toISOString(),
        entry.action,
        entry.tableName,
        entry.key || "",
        entry.sheetRow || "",
        entry.actor || "web",
        JSON.stringify(entry.details || {})
      ]]
    }
  });
}

async function getSheetId(tableName: string) {
  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
    fields: "sheets.properties"
  }, { timeout: GOOGLE_READ_TIMEOUT_MS });
  const sheet = spreadsheet.data.sheets?.find(item => item.properties?.title === tableName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId === null || sheetId === undefined) throw new Error(`Sheet not found: ${tableName}`);
  return sheetId;
}

function toRow(headers: string[], values: RowValue[], sheetRow: number): SheetRow {
  const row: SheetRow = { _sheetRow: sheetRow };
  headers.forEach((header, index) => {
    row[header] = normalizeValue(values[index] ?? "");
  });
  return row;
}

function normalizeValue(value: RowValue): RowValue {
  return value;
}

function pick(row: SheetRow, columns: string[]) {
  const output: SheetRow = {};
  columns.forEach(column => {
    output[column] = row[column] ?? "";
  });
  return output;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function quoteSheet(tableName: string) {
  return `'${tableName.replace(/'/g, "''")}'`;
}

function columnName(length: number) {
  let name = "";
  let index = length;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name || "A";
}
