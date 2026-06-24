import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BillImageThumbnail } from "@/components/BillImageThumbnail";
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

const DETAIL_FIELDS = [
  "ลำดับ",
  "ID Project",
  "ชื่อ Project",
  "ร้านค้า/ผู้รับเหมา",
  "ร้านค้า",
  "ผู้รับเหมา",
  "รายละเอียดงาน",
  "สินค้า",
  "บิล",
  "ประเภท",
  "ค่าของ",
  "vat",
  "วันได้บิล",
  "ค่าแรง",
  "หัก",
  "statusค่าแรง",
  "วันออก 3%",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "ทะเบียน",
  "เครื่องจักร",
  "เครื่องมือ",
  "ชื่อเครื่องมือ",
  "อื่นๆ",
  "รายการ",
  "เครดิต",
  "วันจ่าย",
  "ผู้เบิก",
  "ว/ด/ป",
  "filed",
  "3เปอร์เซ็น",
  "textnumber ",
  "สถานะ",
  "ชื่อพนักงาน"
];

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
  const contract = contractRows.filter(row => text(row.id_Conwork) === contractId);
  const imageValue = bill["รูปถ่ายบิล"];
  const total = toNumber(bill["ยอดเงิน"]);
  const transfer = toNumber(bill["ยอดโอน"]);

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

      <section className="content bill-detail-page">
        <article className="bill-detail-card">
          <div className="bill-detail-metrics">
            <Metric label="ยอดเงิน" value={money(total)} />
            <Metric label="ยอดโอน" value={money(transfer)} />
            <Metric label="สถานะ" value={text(bill["สถานะ"]) || "-"} />
          </div>

          <section className="generic-detail-section">
            <h3>ข้อมูลบิล</h3>
            <dl className="generic-detail-list">
              {DETAIL_FIELDS.map(field => (
                <div key={field}>
                  <dt>{field}</dt>
                  <dd>{formatValue(bill[field]) || "-"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="generic-detail-section">
            <h3>รูปถ่ายบิล</h3>
            <BillImageThumbnail value={imageValue} />
          </section>

          <section className="generic-detail-section related-data-section">
            <h3>Related Project <span>{project.length}</span></h3>
            <DataTable
              columns={["ID Project", "ชื่อ Project", "ชื่อลูกค้า", "ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "วันที่", "color", "รวม ALL", "บริษัท", "รับผิดชอบ"]}
              rows={project}
              title="Related Project"
              rowLabel="รายการ"
              limit={10}
              detailBasePath="/views/project-all"
              detailKeyColumn="ID Project"
            />
          </section>

          <section className="generic-detail-section related-data-section">
            <h3>Related Open Contract <span>{contract.length}</span></h3>
            <DataTable
              columns={["id_Conwork", "id_Contractor", "ID Project", "ชื่อ Project", "ยอดเงินจ้าง", "ยอดเงินจ่าย", "ค่าแรงคงเหลือ", "รายละเอียดงาน", "วันที่"]}
              rows={contract}
              title="Related Open Contract"
              rowLabel="รายการ"
              limit={10}
              detailBasePath="/views/contract-open"
              detailKeyColumn="id_Conwork"
            />
          </section>
        </article>
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="project-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
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
