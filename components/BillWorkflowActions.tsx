"use client";

import { Banknote, Check, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SheetRow } from "@/lib/types";

type BillWorkflowActionsProps = {
  row: SheetRow;
  compact?: boolean;
  allowEdit?: boolean;
  redirectAfterDelete?: string;
};

export function BillWorkflowActions({ row, compact = false, allowEdit = false, redirectAfterDelete }: BillWorkflowActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<"status" | "delete" | null>(null);
  const [error, setError] = useState("");
  const sheetRow = Number(row._sheetRow);
  const status = String(row["สถานะ"] || "").trim() || "รออนุมัติ";
  const pending = status === "รออนุมัติ";
  const approved = status === "อนุมัติ";

  function editBill() {
    window.dispatchEvent(new CustomEvent("open-bill-edit-form", { detail: { row, sheetRow } }));
  }

  async function updateStatus(nextStatus: "อนุมัติ" | "เบิกแล้ว") {
    setBusy("status");
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", sheetRow, values: { "สถานะ": nextStatus } })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "เปลี่ยนสถานะไม่สำเร็จ");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function deleteBill() {
    if (!window.confirm(`ลบบิล ${String(row["ลำดับ"] || "")} ใช่หรือไม่`)) return;
    setBusy("delete");
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName: "Data", sheetRows: [sheetRow] })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "ลบบิลไม่สำเร็จ");
      if (redirectAfterDelete) router.push(redirectAfterDelete);
      else router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบบิลไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={compact ? "bill-workflow-actions compact" : "bill-workflow-actions"}>
      {allowEdit && pending ? (
        <button type="button" onClick={editBill} title="แก้ไขบิล" aria-label="แก้ไขบิล">
          <Pencil size={15} />{compact ? null : <span>แก้ไข</span>}
        </button>
      ) : null}
      {pending ? (
        <button className="success" type="button" disabled={busy !== null} onClick={() => updateStatus("อนุมัติ")} title="อนุมัติบิล">
          {busy === "status" ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}
          {compact ? null : <span>อนุมัติ</span>}
        </button>
      ) : null}
      {approved ? (
        <button className="success" type="button" disabled={busy !== null} onClick={() => updateStatus("เบิกแล้ว")} title="บันทึกว่าเบิกแล้ว">
          {busy === "status" ? <LoaderCircle className="spin" size={15} /> : <Banknote size={15} />}
          {compact ? null : <span>เบิกแล้ว</span>}
        </button>
      ) : null}
      {pending ? (
        <button className="danger" type="button" disabled={busy !== null} onClick={deleteBill} title="ลบบิล" aria-label="ลบบิล">
          {busy === "delete" ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}
          {compact ? null : <span>ลบ</span>}
        </button>
      ) : null}
      {error ? <span className="bill-action-error">{error}</span> : null}
    </div>
  );
}
