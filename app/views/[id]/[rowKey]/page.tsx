import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { TABLES } from "@/lib/config";
import { hydrateBillRows, hydrateContractRows } from "@/lib/formulas";
import { getRows } from "@/lib/sheets";
import { getViewById, getViewColumns } from "@/lib/views";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type GenericDetailPageProps = {
  params: Promise<{ id: string; rowKey: string }>;
};

type RelatedSection = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: SheetRow[];
};

export default async function GenericDetailPage({ params }: GenericDetailPageProps) {
  const { id, rowKey } = await params;
  const view = getViewById(id);
  if (!view || view.type !== "table" || !view.table) notFound();
  if (id === "project-all" || id === "contract-open") notFound();

  const keyColumn = tableKeyColumn(id);
  const decodedKey = decodeURIComponent(rowKey).trim();
  const rows = await getRows(view.table).catch(() => []);
  const row = rows.find(item => String(item[keyColumn] || item._sheetRow || "").trim() === decodedKey);
  if (!row) notFound();

  const columns = getViewColumns(view.name, Object.keys(row).filter(column => !column.startsWith("_")));
  const relatedSections = await getRelatedSections(id, row);
  const title = detailTitle(id, row, decodedKey);

  return (
    <>
      <header className="toolbar generic-detail-toolbar">
        <div>
          <h2>{title}</h2>
          <p>{view.name} Detail</p>
        </div>
        <Link className="back-link-button" href={`/views/${id}`}>
          <ArrowLeft size={16} />
          <span>กลับ</span>
        </Link>
      </header>

      <section className="content generic-detail-page">
        <article className="generic-detail-card">
          <section className="generic-detail-section">
            <h3>ข้อมูลหลัก</h3>
            <dl className="generic-detail-list">
              {columns.map(column => (
                <div key={column}>
                  <dt>{column}</dt>
                  <dd>{formatValue(row[column]) || "-"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {relatedSections.map(section => (
            <section className="generic-detail-section related-data-section" key={section.title}>
              <h3>{section.title} <span>{section.rows.length}</span></h3>
              <DataTable
                columns={section.columns}
                rows={section.rows}
                title={section.title}
                subtitle={section.subtitle}
                rowLabel="รายการ"
                limit={80}
                detailBasePath={section.title.includes("Project") ? "/views/project-all" : undefined}
                detailKeyColumn={section.title.includes("Project") ? "ID Project" : undefined}
              />
            </section>
          ))}
        </article>
      </section>
    </>
  );
}

async function getRelatedSections(viewId: string, row: SheetRow): Promise<RelatedSection[]> {
  const [rawDataRows, rawProjectRows, rawContractRows, storeRows, contractorRows, peopleRows] = await Promise.all([
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => []),
    getRows(TABLES.STORE).catch(() => []),
    getRows(TABLES.CONTRACTOR).catch(() => []),
    getRows(TABLES.PEOPLE).catch(() => [])
  ]);
  const dataRows = await hydrateBillRows(rawDataRows);
  const contractRows = await hydrateContractRows(rawContractRows);
  const billColumns = ["ลำดับ", "ID Project", "ชื่อ Project", "ร้าน/บุคคล", "สินค้า/ทำงาน", "บิล", "ประเภท", "ยอดเงิน", "ผู้เบิก", "ว/ด/ป", "สถานะ"];
  const projectColumns = ["ID Project", "ชื่อ Project", "ชื่อลูกค้า", "ยอดงาน", "ยอดรวม vat", "งบไม่เกิน", "วันที่", "color", "รวม ALL", "บริษัท", "รับผิดชอบ"];
  const contractColumns = ["id_Conwork", "id_Contractor", "ID Project", "ชื่อ Project", "ยอดเงินจ้าง", "ยอดเงินจ่าย", "ค่าแรงคงเหลือ", "รายละเอียดงาน", "วันที่"];

  if (viewId === "stores") {
    const storeId = text(row.id_store);
    const storeName = text(row["ชื่อร้านค้า"]);
    const relatedBills = dataRows.filter(item => text(item["ร้านค้า"]) === storeId || text(item["ร้าน/บุคคล"]) === storeName);
    return [section("Related Bills", "บิลที่อ้างถึงร้านค้านี้", billColumns, relatedBills)];
  }

  if (viewId === "contractors") {
    const contractorId = text(row.id_Contractor);
    const nickname = text(row["ชื่อเล่น"]);
    const contracts = contractRows.filter(item => text(item.id_Contractor) === contractorId || text(item["ชื่อเล่น"]) === nickname);
    const contractIds = new Set(contracts.map(item => text(item.id_Conwork)).filter(Boolean));
    const relatedBills = dataRows.filter(item => contractIds.has(text(item["ผู้รับเหมา"])) || text(item["ร้าน/บุคคล"]) === nickname);
    return [
      section("Related Open Contracts", "งานเปิดจ้างของผู้รับเหมานี้", contractColumns, contracts),
      section("Related Bills", "บิลที่จ่ายให้ผู้รับเหมานี้", billColumns, relatedBills)
    ];
  }

  if (viewId === "people") {
    const code = text(row["รหัสพนักงาน"]);
    const nickname = text(row["ชื่อเล่น"]);
    const relatedBills = dataRows.filter(item => text(item["ผู้เบิก"]) === code || text(item["ผู้เบิก"]) === nickname || text(item["ชื่อพนักงาน"]) === code || text(item["ชื่อพนักงาน"]) === nickname);
    const relatedProjects = rawProjectRows.filter(item => text(item["รับผิดชอบ"]) === code || text(item["รับผิดชอบ"]) === nickname);
    return [
      section("Related Bills", "บิลที่เกี่ยวข้องกับพนักงานนี้", billColumns, relatedBills),
      section("Related Projects", "Project ที่รับผิดชอบ", projectColumns, relatedProjects)
    ];
  }

  if (viewId === "cars") {
    const carId = text(row.id_car);
    const plate = text(row["หมายเลขทะเบียน"]);
    const relatedBills = dataRows.filter(item => text(item["ทะเบียน"]) === carId || text(item["ทะเบียน"]) === plate);
    return [section("Related Bills", "บิลน้ำมันหรือซ่อมรถที่ใช้ทะเบียนนี้", billColumns, relatedBills)];
  }

  if (viewId === "customers") {
    const customerId = text(row.id_cus);
    const customerName = text(row["ชื่อลูกค้า"]);
    const projects = rawProjectRows.filter(item => text(item["ชื่อลูกค้า"]) === customerId || text(item["ชื่อลูกค้า"]) === customerName);
    return [section("Related Projects", "Project ของลูกค้านี้", projectColumns, projects)];
  }

  if (viewId === "banks") {
    const bankId = text(row.id_bank);
    const bankName = text(row["ชื่อธนาคาร"]);
    const relatedStores = storeRows.filter(item => text(item["ธนาคาร"]) === bankId || text(item["ธนาคาร"]) === bankName);
    const relatedContractors = contractorRows.filter(item => text(item["ธนาคาร"]) === bankId || text(item["ธนาคาร"]) === bankName);
    const relatedPeople = peopleRows.filter(item => text(item["ธนาคาร"]) === bankId || text(item["ธนาคาร"]) === bankName);
    return [
      section("Related Stores", "ร้านค้าที่ใช้ธนาคารนี้", ["id_store", "ชื่อร้านค้า", "ชื่อเต็ม", "เลขบัญชี", "ธนาคาร", "เบอร์โทร"], relatedStores),
      section("Related Contractors", "ผู้รับเหมาที่ใช้ธนาคารนี้", ["id_Contractor", "ชื่อเล่น", "ชื่อ-นามสกุล", "เลขบัญชี", "ธนาคาร", "เบอร์โทรศัพท์"], relatedContractors),
      section("Related People", "พนักงานที่ใช้ธนาคารนี้", ["รหัสพนักงาน", "ชื่อเล่น", "ชื่อ-นามสกุล", "เลขบัญชี", "ธนาคาร", "เบอร์โทร"], relatedPeople)
    ];
  }

  return [];
}

function section(title: string, subtitle: string, columns: string[], rows: SheetRow[]): RelatedSection {
  return { title, subtitle, columns, rows };
}

function tableKeyColumn(viewId: string) {
  const keyByView: Record<string, string> = {
    banks: "id_bank",
    stores: "id_store",
    contractors: "id_Contractor",
    people: "รหัสพนักงาน",
    cars: "id_car",
    customers: "id_cus",
    companies: "id_Company",
    loans: "id"
  };
  return keyByView[viewId] || "_RowNumber";
}

function detailTitle(viewId: string, row: SheetRow, fallback: string) {
  const titleColumns: Record<string, string[]> = {
    banks: ["ชื่อธนาคาร", "id_bank"],
    stores: ["ชื่อร้านค้า", "ชื่อเต็ม", "id_store"],
    contractors: ["ชื่อเล่น", "ชื่อ-นามสกุล", "id_Contractor"],
    people: ["ชื่อเล่น", "ชื่อ-นามสกุล", "รหัสพนักงาน"],
    cars: ["หมายเลขทะเบียน", "id_car"],
    customers: ["ชื่อลูกค้า", "id_cus"],
    companies: ["ชื่อบริษัท", "ชื่ออังกฤษ", "id_Company"],
    loans: ["ชื่อ", "type", "id"]
  };
  for (const column of titleColumns[viewId] || []) {
    const value = text(row[column]);
    if (value) return value;
  }
  return fallback;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value.toLocaleString("th-TH", { maximumFractionDigits: 2 });
  return String(value);
}

function text(value: unknown) {
  return String(value ?? "").trim();
}
