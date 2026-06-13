"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, X } from "lucide-react";
import { TABLES } from "@/lib/config";
import { money } from "@/lib/numbers";
import type { SheetRow } from "@/lib/types";

type ProjectDetailEditorProps = {
  fields: string[];
  project: SheetRow;
};

export function ProjectDetailEditor({ fields, project }: ProjectDetailEditorProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Record<string, string>>(() => draftFromProject(project, fields));
  const sheetRow = Number(project._sheetRow);
  const canSave = Number.isInteger(sheetRow) && sheetRow >= 2;

  const changedValues = useMemo(() => {
    return Object.fromEntries(
      fields
        .filter(field => !readonlyField(field))
        .filter(field => stringify(project[field]) !== (draft[field] ?? ""))
        .map(field => [field, draft[field] ?? ""])
    );
  }, [draft, fields, project]);

  function beginEdit() {
    setError("");
    setDraft(draftFromProject(project, fields));
    setEditing(true);
  }

  function cancelEdit() {
    setError("");
    setDraft(draftFromProject(project, fields));
    setEditing(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) {
      setError("ไม่พบตำแหน่งแถวใน Sheet สำหรับบันทึก");
      return;
    }
    if (!Object.keys(changedValues).length) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName: TABLES.PROJECT,
          sheetRow,
          values: changedValues
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "บันทึกข้อมูลไม่สำเร็จ");
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <section className="project-detail-section project-edit-section">
        <form onSubmit={submit}>
          <header className="project-section-head">
            <h3>แก้ไขข้อมูล Project</h3>
            <div className="project-edit-actions">
              <button type="button" disabled={busy} onClick={cancelEdit}>
                <X size={15} />
                <span>ยกเลิก</span>
              </button>
              <button type="submit" className="primary" disabled={busy || !canSave}>
                <Save size={15} />
                <span>บันทึก</span>
              </button>
            </div>
          </header>

          <div className="project-edit-grid">
            {fields.map(field => (
              <label className="project-edit-field" key={field}>
                <span>{field}</span>
                {readonlyField(field) ? (
                  <input value={formatDisplay(project[field], field)} readOnly />
                ) : field === "color" ? (
                  <select value={draft[field] || ""} disabled={busy} onChange={event => setDraftValue(field, event.target.value)}>
                    <option value=""></option>
                    <option value="Green">Green</option>
                    <option value="Red">Red</option>
                    <option value="Black">Black</option>
                  </select>
                ) : longField(field) ? (
                  <textarea value={draft[field] || ""} disabled={busy} rows={3} onChange={event => setDraftValue(field, event.target.value)} />
                ) : (
                  <input
                    value={draft[field] || ""}
                    disabled={busy}
                    inputMode={amountField(field) ? "decimal" : undefined}
                    onChange={event => setDraftValue(field, event.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          {error ? <div className="manage-error project-edit-error">{error}</div> : null}
        </form>
      </section>
    );
  }

  return (
    <section className="project-detail-section">
      <header className="project-section-head">
        <h3>ข้อมูล Project</h3>
        <button type="button" className="detail-edit-button" disabled={!canSave} onClick={beginEdit}>
          <Pencil size={15} />
          <span>แก้ไข</span>
        </button>
      </header>
      <dl className="detail-list">
        {fields.map(field => (
          <div key={field}>
            <dt>{field}</dt>
            <dd className={amountField(field) ? "detail-amount" : undefined}>
              {formatDisplay(project[field], field) || "-"}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );

  function setDraftValue(field: string, value: string) {
    setDraft(current => ({ ...current, [field]: value }));
  }
}

function draftFromProject(project: SheetRow, fields: string[]) {
  return Object.fromEntries(fields.map(field => [field, stringify(project[field])]));
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function readonlyField(field: string) {
  return field === "ID Project" || field === "รวม ALL" || field === "ยอดรวม vat";
}

function amountField(field: string) {
  return ["ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "รวม ALL"].includes(field) || field.startsWith("งบไม่เกิน");
}

function longField(field: string) {
  return field === "ชื่อ Project" || field === "ชื่อลูกค้า" || field === "บริษัท" || field === "สถานที่";
}

function formatDisplay(value: unknown, field: string) {
  if (amountField(field)) return money(value);
  return stringify(value);
}
