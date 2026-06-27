import Link from "next/link";
import { ArrowLeft, BriefcaseBusiness, ChevronDown, FileText, Images, ReceiptText, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./page.module.css";
import { BillImageThumbnail } from "@/components/BillImageThumbnail";
import { BillWorkflowActions } from "@/components/BillWorkflowActions";
import { DataTable } from "@/components/DataTable";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows } from "@/lib/formulas";
import { money, toNumber } from "@/lib/numbers";
import { getRows } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type BillDetailPageProps = {
  params: Promise<{ billId: string }>;
};

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  const { billId } = await params;
  const decodedBillId = decodeURIComponent(billId).trim();
  const [rawDataRows, projectRows, rawContractRows] = await Promise.all([
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => [])
  ]);
  const dataRows = await hydrateBillRows(rawDataRows);
  const contractRows = await hydrateContractRows(rawContractRows);
  const bill = dataRows.find(row => billKey(row) === decodedBillId || String(row._sheetRow || "") === decodedBillId);
  if (!bill) notFound();

  const projectId = text(bill["ID Project"]);
  const contractId = text(bill["ผู้รับเหมา"]);
  const project = projectRows.filter(row => text(row["ID Project"]) === projectId);
  const contract = contractId
    ? contractRows.filter(row => text(row.id_Conwork) === contractId)
    : [];
  const imageValue = bill["รูปถ่ายบิล"];
  const total = toNumber(bill["ยอดเงิน"]);
  const transfer = toNumber(bill["ยอดโอน"]);
  const remaining = total - transfer;
  const status = text(bill["สถานะ"]) || "รออนุมัติ";
  const vendor = firstText(bill, ["ร้านค้า", "ผู้รับเหมา", "ร้านค้า/ผู้รับเหมา"]);
  const vendorLabel = text(bill["ผู้รับเหมา"]) ? "ผู้รับเหมา" : text(bill["ร้านค้า"]) ? "ร้านค้า" : "ร้าน/บุคคล";
  const projectFields: DetailField[] = [
    { label: "ID Project", value: bill["ID Project"] },
    { label: "ชื่อ Project", value: bill["ชื่อ Project"], wide: true },
    { label: vendorLabel, value: vendor, wide: true },
    { label: "บิล", value: bill["บิล"] },
    { label: "ประเภท", value: bill["ประเภท"] }
  ];
  const expenseFields = meaningfulFields([
    { label: "รายละเอียดงาน", value: bill["รายละเอียดงาน"], wide: true },
    { label: "สินค้า", value: bill["สินค้า"] },
    { label: "รายการ", value: bill["รายการ"] },
    { label: "ค่าของ", value: bill["ค่าของ"], numeric: true },
    { label: "ค่าแรง", value: bill["ค่าแรง"], numeric: true },
    { label: "น้ำมัน", value: bill["น้ำมัน"], numeric: true },
    { label: "ซ่อมรถ", value: bill["ซ่อมรถ"], numeric: true },
    { label: "ทะเบียน", value: bill["ทะเบียน"] },
    { label: "เครื่องจักร", value: bill["เครื่องจักร"], numeric: true },
    { label: "เครื่องมือ", value: bill["เครื่องมือ"], numeric: true },
    { label: "ชื่อเครื่องมือ", value: bill["ชื่อเครื่องมือ"], wide: true },
    { label: "อื่นๆ", value: bill["อื่นๆ"], numeric: true }
  ]);
  const paymentFields = meaningfulFields([
    { label: "VAT", value: bill.vat },
    { label: "หัก", value: bill["หัก"] },
    { label: "3 เปอร์เซ็น", value: bill["3เปอร์เซ็น"], numeric: true },
    { label: "เครดิต", value: bill["เครดิต"] },
    { label: "ผู้เบิก", value: bill["ผู้เบิก"] },
    { label: "พนักงาน", value: firstText(bill, ["ชื่อพนักงาน", "พนักงาน"]) },
    { label: "วันที่บิล", value: firstText(bill, ["ว/ด/ป", "วันได้บิล"]) },
    { label: "วันออก 3%", value: bill["วันออก 3%"] },
    { label: "วันจ่าย", value: bill["วันจ่าย"] }
  ]);
  const systemFields = meaningfulFields([
    { label: "ลำดับ", value: bill["ลำดับ"] },
    { label: "ไฟล์เอกสาร", value: bill.filed, wide: true },
    { label: "เลขข้อความ", value: bill["textnumber "] },
    { label: "สถานะค่าแรง", value: bill["statusค่าแรง"] },
    { label: "สถานะ", value: status }
  ], true);

  return (
    <>
      <header className="toolbar bill-detail-toolbar">
        <div>
          <h2>บิล {billKey(bill) || decodedBillId}</h2>
          <p>{text(bill["ชื่อ Project"]) || "Bill Detail"}</p>
        </div>
        <Link className="back-link-button" href="/bills">
          <ArrowLeft size={16} />
          <span>กลับ</span>
        </Link>
      </header>

      <section className={`content bill-detail-page ${styles.page}`}>
        <article className={`bill-detail-card ${styles.card}`}>
          <div className={styles.summary}>
            <div className={styles.summaryHeading}>
              <div className={styles.summaryHeadingText}>
                <span className={styles.kicker}>BILL #{billKey(bill) || decodedBillId}</span>
                <strong className={styles.projectTitle}>{text(bill["ชื่อ Project"]) || "ไม่ระบุโครงการ"}</strong>
              </div>
              <span className={`${styles.statusPill} ${styles[statusClass(status)]}`}>{status}</span>
            </div>
            <div className={`bill-detail-metrics ${styles.metrics}`}>
              <Metric label="ยอดเงิน" value={money(total)} emphasis />
              <Metric label="ยอดโอน" value={money(transfer)} />
              <Metric label="คงเหลือ" value={money(remaining)} tone={remaining > 0 ? "warning" : "success"} />
            </div>
          </div>

          <div className={styles.actions}>
            <BillWorkflowActions row={bill} redirectAfterDelete="/bills" />
          </div>

          <div className={styles.informationGrid}>
            <DetailGroup icon={<BriefcaseBusiness size={16} />} title="โครงการและคู่ค้า" fields={projectFields} />
            <DetailGroup icon={<ReceiptText size={16} />} title="รายการค่าใช้จ่าย" fields={expenseFields} emptyText="ไม่มีรายละเอียดค่าใช้จ่ายเพิ่มเติม" />
            <DetailGroup icon={<WalletCards size={16} />} title="เงื่อนไขและการชำระเงิน" fields={paymentFields} emptyText="ไม่มีเงื่อนไขเพิ่มเติม" />
          </div>

          <section className={`generic-detail-section ${styles.group}`}>
            <h3 className={styles.sectionTitle}><span><Images size={16} />รูปถ่ายบิล</span></h3>
            <div className={styles.imageContent}>
              {text(imageValue) ? <BillImageThumbnail value={imageValue} /> : <span className={styles.empty}>ไม่มีรูปถ่ายบิล</span>}
            </div>
          </section>

          <details className={styles.collapsible}>
            <summary className={styles.collapsibleSummary}><span><FileText size={16} />ข้อมูลระบบ</span><span>{systemFields.length} รายการ <ChevronDown size={16} /></span></summary>
            <DetailList fields={systemFields} />
          </details>

          <div className={styles.relatedGrid}>
            <details className={`${styles.collapsible} related-data-section`}>
              <summary className={styles.collapsibleSummary}><span>Project ที่เกี่ยวข้อง</span><span>{project.length} รายการ <ChevronDown size={16} /></span></summary>
              <DataTable
                columns={["ID Project", "ชื่อ Project", "ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "วันที่", "รับผิดชอบ"]}
                rows={project}
                title="Related Project"
                rowLabel="รายการ"
                limit={10}
                detailBasePath="/views/project-all"
                detailKeyColumn="ID Project"
              />
            </details>

            <details className={`${styles.collapsible} related-data-section`}>
              <summary className={styles.collapsibleSummary}><span>เปิดจ้างที่เกี่ยวข้อง</span><span>{contract.length} รายการ <ChevronDown size={16} /></span></summary>
              <DataTable
                columns={["id_Conwork", "id_Contractor", "ยอดเงินจ้าง", "ยอดเงินจ่าย", "ค่าแรงคงเหลือ", "รายละเอียดงาน", "วันที่"]}
                rows={contract}
                title="Related Open Contract"
                rowLabel="รายการ"
                limit={10}
                detailBasePath="/views/contract-open"
                detailKeyColumn="id_Conwork"
              />
            </details>
          </div>
        </article>
      </section>
    </>
  );
}

type DetailField = {
  label: string;
  value: unknown;
  wide?: boolean;
  numeric?: boolean;
};

function Metric({ label, value, emphasis = false, tone }: { label: string; value: string; emphasis?: boolean; tone?: "warning" | "success" }) {
  return (
    <div className={`${styles.metric}${emphasis ? ` ${styles.emphasis}` : ""}${tone ? ` ${styles[tone]}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DetailGroup({ icon, title, fields, emptyText }: { icon: ReactNode; title: string; fields: DetailField[]; emptyText?: string }) {
  return (
    <section className={`generic-detail-section ${styles.group}`}>
      <h3 className={styles.sectionTitle}><span>{icon}{title}</span></h3>
      {fields.length ? <DetailList fields={fields} /> : <p className={styles.empty}>{emptyText || "ไม่มีข้อมูล"}</p>}
    </section>
  );
}

function DetailList({ fields }: { fields: DetailField[] }) {
  return (
    <dl className={styles.detailList}>
      {fields.map(field => (
        <div className={field.wide ? styles.wide : undefined} key={field.label}>
          <dt>{field.label}</dt>
          <dd>{formatValue(field.value) || "-"}</dd>
        </div>
      ))}
    </dl>
  );
}

function meaningfulFields(fields: DetailField[], keepZero = false) {
  return fields.filter(field => {
    const value = text(field.value);
    if (!value) return false;
    if (!keepZero && field.numeric && toNumber(field.value) === 0) return false;
    return true;
  });
}

function firstText(row: SheetRow, fields: string[]) {
  for (const field of fields) {
    const value = text(row[field]);
    if (value) return value;
  }
  return "";
}

function statusClass(status: string) {
  if (status === "เบิกแล้ว") return "paid";
  if (status === "อนุมัติ") return "approved";
  return "pending";
}

function billKey(row: SheetRow) {
  return text(row["ลำดับ"]) || text(row["ลำดับtest"]);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  return String(value);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
