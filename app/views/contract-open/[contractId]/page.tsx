import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/sheets";
import { money } from "@/lib/numbers";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type ContractDetailPageProps = {
  params: Promise<{ contractId: string }>;
};

const DETAIL_FIELDS = [
  "ชื่อเล่น",
  "id_Conwork",
  "ID Project",
  "ชื่อ Project",
  "id_Contractor",
  "ชื่อ-นามสกุล",
  "เลขบัญชี",
  "ธนาคาร",
  "ยอดเงินจ้าง",
  "ยอดเงินจ่าย",
  "ค่าแรงคงเหลือ",
  "รายละเอียดงาน",
  "สถานที่",
  "วันที่",
  "เบอร์โทรศัพท์",
  "ที่อยู่"
];

const RELATED_COLUMNS = [
  "ลำดับ",
  "ID Project",
  "ชื่อ Project",
  "ร้าน/บุคคล",
  "สินค้า/ทำงาน",
  "บิล",
  "ประเภท",
  "ยอดเงิน",
  "ผู้รับเหมา",
  "ผู้เบิก",
  "ว/ด/ป",
  "สถานะ"
];

export default async function ContractDetailPage({ params }: ContractDetailPageProps) {
  const { contractId } = await params;
  const decodedContractId = decodeURIComponent(contractId).trim();
  const [contractRows, rawDataRows] = await Promise.all([
    getRows(TABLES.CONTRACT_WORK, 15_000).then(rows => hydrateContractRows(rows)).catch(() => []),
    getRows(TABLES.DATA, 15_000).catch(() => [])
  ]);
  const dataRows = await hydrateBillRows(rawDataRows);
  const contract = contractRows.find(row => String(row.id_Conwork || "").trim() === decodedContractId);
  if (!contract) notFound();

  const relatedRows = dataRows.filter(row => relatedToContract(row, decodedContractId));
  const displayName = valueOf(contract, ["ชื่อเล่น", "ชื่อ-นามสกุล", "id_Contractor"]) || decodedContractId;
  const paid = toAmount(valueOf(contract, ["ยอดเงินจ่าย"]));
  const total = toAmount(valueOf(contract, ["ยอดเงินจ้าง"]));
  const remaining = toAmount(valueOf(contract, ["ค่าแรงคงเหลือ"])) || total - paid;

  return (
    <>
      <header className="toolbar contract-detail-toolbar">
        <div>
          <h2>{displayName}</h2>
          <p>เปิดจ้าง Detail</p>
        </div>
        <div className="contract-detail-actions">
          <Link className="back-link-button" href="/views/contract-open">
            <ArrowLeft size={16} />
            <span>กลับ</span>
          </Link>
          <Link className="back-link-button" href={`/views/contract-open?search=${encodeURIComponent(decodedContractId)}`}>
            <Pencil size={16} />
            <span>แก้ไข</span>
          </Link>
        </div>
      </header>

      <section className="content contract-detail-page">
        <article className="contract-detail-card">
          <div className="contract-detail-head">
            <div>
              <span>เปิดจ้าง</span>
              <h3>{displayName}</h3>
            </div>
            <strong>{decodedContractId}</strong>
          </div>

          <div className="contract-detail-metrics">
            <Metric label="ยอดเงินจ้าง" value={money(total)} />
            <Metric label="ยอดเงินจ่าย" value={money(paid)} />
            <Metric label="ค่าแรงคงเหลือ" value={money(remaining)} tone={remaining < 0 ? "danger" : "success"} />
          </div>

          <div className="contract-detail-layout">
            <section className="contract-detail-section">
              <h3>ข้อมูลเปิดจ้าง</h3>
              <dl className="contract-detail-list">
                {DETAIL_FIELDS.map(field => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd className={amountField(field) ? "detail-amount" : undefined}>
                      {formatDetailValue(field, contract[field])}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="contract-detail-section related-data-section">
              <h3>Related Datas <span>{relatedRows.length}</span></h3>
              <DataTable
                columns={RELATED_COLUMNS}
                rows={relatedRows}
                title="Related Datas"
                subtitle={`${relatedRows.length} รายการจาก Data`}
                rowLabel="รายการ"
                limit={50}
              />
            </section>
          </div>
        </article>
      </section>
    </>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className={`contract-metric contract-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function relatedToContract(row: SheetRow, contractId: string) {
  return String(row["ผู้รับเหมา"] || row.id_Conwork || "").trim() === contractId;
}

function valueOf(row: SheetRow, columns: string[]) {
  for (const column of columns) {
    const value = row[column];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value);
  }
  return "";
}

function toAmount(value: string) {
  const parsed = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountField(field: string) {
  return /ยอด|เงิน|ค่าแรง/.test(field);
}

function formatDetailValue(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (amountField(field)) return money(toAmount(String(value)));
  return String(value);
}
