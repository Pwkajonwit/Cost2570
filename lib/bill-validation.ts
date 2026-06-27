import { TABLES } from "@/lib/config";
import { hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/sheets";
import { toNumber } from "@/lib/numbers";
import type { SheetRow } from "@/lib/types";

export async function validateBillRelations(row: SheetRow) {
  const projectId = String(row["ID Project"] || "").trim();
  const [projects, contracts] = await Promise.all([
    getRows(TABLES.PROJECT, 120_000),
    row["ร้านค้า/ผู้รับเหมา"] === "ผู้รับเหมา"
      ? getRows(TABLES.CONTRACT_WORK, 60_000)
      : Promise.resolve([])
  ]);

  if (!projects.some(project => String(project["ID Project"] || "").trim() === projectId)) {
    throw new Error("ไม่พบ Project ที่เลือก");
  }
  if (row["ร้านค้า/ผู้รับเหมา"] !== "ผู้รับเหมา") return;

  const contractId = String(row["ผู้รับเหมา"] || "").trim();
  const hydratedContracts = await hydrateContractRows(contracts);
  const contract = hydratedContracts.find(item => String(item.id_Conwork || "").trim() === contractId);
  if (!contract) throw new Error("ไม่พบรายการเปิดจ้างที่เลือก");
  if (String(contract["ID Project"] || "").trim() !== projectId) {
    throw new Error("รายการเปิดจ้างไม่อยู่ใน Project ที่เลือก");
  }
  if (toNumber(contract["ค่าแรงคงเหลือ"]) <= 0) {
    throw new Error("รายการเปิดจ้างนี้ชำระครบแล้ว");
  }
}
