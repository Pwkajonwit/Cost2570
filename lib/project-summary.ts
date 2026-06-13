import { toNumber } from "@/lib/numbers";
import type { RowValue, SheetRow } from "@/lib/types";

const AMOUNT_COLUMNS = [
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

export function valueOf(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (hasValue(value)) return value;
  }
  return "";
}

export function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function sumColumns(rows: SheetRow[], columns: string[]) {
  return rows.reduce((sum, row) => sum + columns.reduce((inner, column) => inner + toNumber(row[column]), 0), 0);
}

export function hydrateDataRows(rows: SheetRow[]) {
  return rows.map(row => {
    const output = { ...row };
    if (!hasValue(output["ยอดเงิน"])) output["ยอดเงิน"] = sumColumns([output], AMOUNT_COLUMNS);
    if (!hasValue(output["ยอดโอน"])) output["ยอดโอน"] = computeTransferAmount(output);
    if (!hasValue(output["ร้าน/บุคคล"])) output["ร้าน/บุคคล"] = valueOf(output, ["ร้านค้า", "ผู้รับเหมา", "ร้านค้า/ผู้รับเหมา"]);
    if (!hasValue(output["สินค้า/ทำงาน"])) output["สินค้า/ทำงาน"] = valueOf(output, ["สินค้า", "รายละเอียดงาน", "รายการ"]);
    return output;
  });
}

export function rowsForProject(dataRows: SheetRow[], projectId: RowValue | undefined) {
  const id = String(projectId || "").trim();
  return hydrateDataRows(dataRows).filter(row => String(row["ID Project"] || "").trim() === id);
}

export function hydrateProjectSummary(project: SheetRow, projectDataRows: SheetRow[]): {
  project: SheetRow;
  totals: {
    workTotal: number;
    totalVat: number;
    budget: number;
    totalAll: number;
    billCount: number;
    remaining: number;
    material: number;
    labor: number;
    staff: number;
    fuel: number;
    carRepair: number;
    machine: number;
    tool: number;
    other: number;
  };
} {
  const projectTotal = sumColumns(projectDataRows, ["ยอดเงิน"]);
  const workTotal = toNumber(valueOf(project, ["ยอดงาน"]));
  const totalAll = hasValue(project["รวม ALL"]) ? toNumber(project["รวม ALL"]) : projectTotal;
  const totalVat = hasValue(project["ยอดรวม vat"]) ? toNumber(project["ยอดรวม vat"]) : workTotal * 1.07;
  const budget = toNumber(valueOf(project, ["งบไม่เกิน"]));

  return {
    project: {
      ...project,
      "รวม ALL": totalAll,
      "ยอดรวม vat": totalVat
    },
    totals: {
      workTotal,
      totalVat,
      budget,
      totalAll,
      billCount: projectDataRows.length,
      remaining: budget - totalAll,
      material: sumColumns(projectDataRows, ["ค่าของ"]),
      labor: sumColumns(projectDataRows, ["ค่าแรง"]),
      staff: sumColumns(projectDataRows, ["พนักงาน"]),
      fuel: sumColumns(projectDataRows, ["น้ำมัน"]),
      carRepair: sumColumns(projectDataRows, ["ซ่อมรถ"]),
      machine: sumColumns(projectDataRows, ["เครื่องจักร"]),
      tool: sumColumns(projectDataRows, ["เครื่องมือ"]),
      other: sumColumns(projectDataRows, ["อื่นๆ"])
    }
  };
}

function computeTransferAmount(row: SheetRow) {
  const amount = toNumber(row["ยอดเงิน"]);
  const hasVat = hasValue(row.vat);
  const hasDeduct = hasValue(row["หัก"]);
  if (!hasVat && !hasDeduct) return amount;
  if (hasVat && hasDeduct) return amount * 104 / 107;
  if (hasVat) return amount;
  if (hasDeduct) return amount * computeDeductMultiplier(row);
  return 0;
}

function computeDeductMultiplier(row: SheetRow) {
  const deduct = String(row["หัก"] || "").trim();
  const status = String(row["statusค่าแรง"] || "").trim();
  const company = status === "บริษัท";
  if (deduct === "1") return company ? 1.06 : 0.99;
  if (deduct === "3") return company ? 1.04 : 0.97;
  if (deduct === "5") return company ? 1.02 : 0.95;
  if (deduct === "8") return company ? 0.99 : 0.92;
  return 1;
}
