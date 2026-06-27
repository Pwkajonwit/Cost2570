import type { SheetRow } from "@/lib/types";

export function validateBillStatusTransition(currentStatus: unknown, nextStatus: unknown) {
  const current = normalizeBillStatus(currentStatus);
  const next = normalizeBillStatus(nextStatus);
  if (current === next) return;
  if (current === "รออนุมัติ" && next === "อนุมัติ") return;
  if (current === "อนุมัติ" && next === "เบิกแล้ว") return;
  throw new Error(`เปลี่ยนสถานะจาก ${current || "ว่าง"} เป็น ${next || "ว่าง"} ไม่ได้`);
}

export function canEditOrDeleteBill(status: unknown) {
  return normalizeBillStatus(status) === "รออนุมัติ";
}

export function isCommittedBill(row: SheetRow) {
  return normalizeBillStatus(row["สถานะ"]) !== "รออนุมัติ";
}

export function isUnpaidBill(row: SheetRow) {
  return normalizeBillStatus(row["สถานะ"]) !== "เบิกแล้ว";
}

export function normalizeBillStatus(value: unknown) {
  return String(value || "").trim() || "รออนุมัติ";
}
