import { TABLES } from "@/lib/config";
import { isCommittedBill } from "@/lib/bill-status";
import { computeBillAmount, computeBillDeductMultiplier, computeBillTransferAmount } from "@/lib/project-summary";
import { getRows } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";

export async function applyBillFormulas(row: SheetRow) {
  const context = await getBillFormulaContext();
  return applyBillFormulasWithContext(row, context);
}

export async function hydrateBillRows(rows: SheetRow[]) {
  const context = await getBillFormulaContext();
  return rows.map(row => applyBillFormulasWithContext({ ...row }, context));
}

export async function applyContractFormulas(row: SheetRow) {
  const context = await getContractFormulaContext();
  return applyContractFormulasWithContext({ ...row }, context);
}

export function applyProjectFormulas(row: SheetRow) {
  const output = { ...row };
  const workAmount = toNumber(output["ยอดงาน"]);
  if (hasValue(output["ยอดงาน"])) output["ยอดรวม vat"] = workAmount * 1.07;
  if (!hasValue(output["วันที่"])) output["วันที่"] = new Date().toISOString().slice(0, 10);
  if (!hasValue(output["color"])) output["color"] = "Red";
  return output;
}

export async function hydrateContractRows(rows: SheetRow[]) {
  const context = await getContractFormulaContext();
  return rows.map(row => applyContractFormulasWithContext({ ...row }, context));
}

async function getContractFormulaContext() {
  const [projects, dataRows] = await Promise.all([
    getRows(TABLES.PROJECT, 30_000),
    getRows(TABLES.DATA, 15_000)
  ]);
  return { projects, paidByContract: contractPaidAmounts(dataRows) };
}

function applyContractFormulasWithContext(
  row: SheetRow,
  context: { projects: SheetRow[]; paidByContract: Record<string, number> }
) {
  const project = context.projects.find(item => String(item["ID Project"]) === String(row["ID Project"]));
  if (project) {
    row["ชื่อ Project"] = project["ชื่อ Project"] || row["ชื่อ Project"] || "";
  }
  const key = contractPaymentKey(row);
  const paid = key ? context.paidByContract[key] || 0 : 0;
  const hireAmount = toNumber(firstValue(row, ["ยอดเงินจ้าง"]));
  row["ยอดเงินจ่าย"] = paid;
  row["ค่าแรงคงเหลือ"] = hireAmount - paid;
  return row;
}

function contractPaidAmounts(rows: SheetRow[]) {
  return rows.reduce<Record<string, number>>((totals, row) => {
    if (!isCommittedBill(row)) return totals;
    const key = contractPaymentKey(row);
    if (!key) return totals;
    const directAmount =
      toNumber(firstValue(row, ["ค่าแรง"])) +
      toNumber(firstValue(row, ["พนักงาน"])) +
      toNumber(firstValue(row, ["อื่นๆ"]));
    totals[key] = (totals[key] || 0) + directAmount;
    return totals;
  }, {});
}

function contractPaymentKey(row: SheetRow) {
  const projectId = String(row["ID Project"] || "").trim();
  const contractId = String(firstValue(row, ["id_Conwork", "ผู้รับเหมา"]) || "").trim();
  return projectId && contractId ? `${projectId}|${contractId}` : "";
}

function firstValue(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (hasValue(value)) return value;
  }
  return "";
}

async function getBillFormulaContext() {
  const [projects, stores, contracts] = await Promise.all([
    getRows(TABLES.PROJECT, 120_000),
    getRows(TABLES.STORE, 120_000),
    getRows(TABLES.CONTRACT_WORK, 60_000)
  ]);
  return { projects, stores, contracts };
}

function applyBillFormulasWithContext(
  row: SheetRow,
  context: { projects: SheetRow[]; stores: SheetRow[]; contracts: SheetRow[] }
) {
  const project = context.projects.find(item => String(item["ID Project"]) === String(row["ID Project"]));
  if (project) {
    row["ชื่อ Project"] = project["ชื่อ Project"] || row["ชื่อ Project"] || "";
    row["ชื่อบริษัท"] = project["ชื่อบริษัท"] || row["ชื่อบริษัท"] || "";
  }

  const contract = context.contracts.find(item => String(item["id_Conwork"]) === String(row["ผู้รับเหมา"]));
  if (contract) {
    row["รายละเอียดงาน"] = contract["รายละเอียดงาน"] || row["รายละเอียดงาน"] || "";
    row["ค่าแรงคงเหลือ"] = contract["ค่าแรงคงเหลือ"] || "";
  }

  row["ยอดเงิน"] = computeBillAmount(row);
  row["ค่าแรง+พนักงาน+อื่น"] = toNumber(row["ค่าแรง"]) + toNumber(row["พนักงาน"]) + toNumber(row["อื่นๆ"]);
  row["3เปอร์"] = hasValue(row["หัก"]) ? deductAmount(row) : "";
  row["รวม"] = hasValue(row["หัก"]) ? toNumber(row["ค่าแรง+พนักงาน+อื่น"]) - toNumber(row["3เปอร์"]) : "";
  row["ค่าแรง(หัก)"] = hasValue(row["หัก"]) ? computeBillDeductMultiplier(row) : "";
  row["ยอดโอน(มีvat)"] = row["ยอดเงิน"];
  row["ยอดโอน(มีหัก)"] = hasValue(row["หัก"]) ? computeBillTransferAmount(row) : "";
  row["ยอดโอน(vat,หัก)"] = hasValue(row["vat"]) && hasValue(row["หัก"]) ? computeBillTransferAmount(row) : "";
  row["ยอดโอน"] = computeBillTransferAmount(row);
  row["ร้าน/บุคคล"] = vendorName(row, context.stores, contract);
  row["สินค้า/ทำงาน"] = `${row["สินค้า"] || ""}${row["รายละเอียดงาน"] || ""}`;
  return row;
}

function vendorName(row: SheetRow, stores: SheetRow[], contract?: SheetRow) {
  if (row["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา") return contract?.["ชื่อเล่น"] || row["ผู้รับเหมา"] || "";
  const store = stores.find(item => String(item["id_store"]) === String(row["ร้านค้า"]));
  return store?.["ชื่อร้านค้า"] || row["ร้านค้า"] || "";
}

function deductAmount(row: SheetRow) {
  if (hasValue(row["จำนวนหัก"])) return toNumber(row["จำนวนหัก"]);
  return toNumber(row["ค่าแรง+พนักงาน+อื่น"]) * toNumber(row["หัก"]) * 0.01;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}
