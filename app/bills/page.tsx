import { TABLES } from "@/lib/config";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { BillWorkflowActions } from "@/components/BillWorkflowActions";
import { getFormPayload } from "@/lib/form";
import { hydrateBillRows } from "@/lib/formulas";
import { getRows } from "@/lib/sheets";
import type { SheetRow } from "@/lib/types";

export const dynamic = "force-dynamic";

type BillsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BillsPage({ searchParams }: BillsPageProps) {
  const query = await searchParams;
  const search = firstSearchParam(query?.search).trim();
  const page = parsePositiveInt(firstSearchParam(query?.page), 1);
  const pageSize = parsePositiveInt(firstSearchParam(query?.pageSize), 80);
  const sort = parseSort(firstSearchParam(query?.sort));
  const viewName = "กรอกบิล";
  const columns = [
    "ลำดับ",
    "ID Project",
    "ชื่อ Project",
    "ร้าน/บุคคล",
    "สินค้า/ทำงาน",
    "บิล",
    "ประเภท",
    "ยอดเงิน",
    "เงื่อนไข",
    "ผู้เบิก",
    "ว/ด/ป",
    "รูปถ่ายบิล",
    "สถานะ",
    "จัดการ"
  ];
  const [allRows, peopleRows, form] = await Promise.all([
    safeRows(TABLES.DATA),
    safeRows(TABLES.PEOPLE),
    getFormPayload(TABLES.DATA).catch(() => null)
  ]);
  const requesterNames = requesterNameMap(peopleRows);
  const hydratedRows = await hydrateBillRows(allRows);
  const rows = filterRows(sortBillRows(nonEmptyRows(hydratedRows, columns), sort), search);

  return (
    <>
      <header className="toolbar bill-entry-toolbar">
        <div>
          <h2>{viewName}</h2>
          {search ? <p>ค้นหา: {search}</p> : null}
        </div>
      </header>
      <section className="content table-view bills-view">
        <div className="bills-compact-bar">
          <form className="bills-search-form" action="/bills">
            <label>
              <span>ค้นหาบิล</span>
              <input name="search" type="search" defaultValue={search} placeholder="Project, ร้าน, ผู้เบิก" />
            </label>
            <button type="submit" className="primary">ค้นหา</button>
            {search ? <a className="bills-clear-link" href="/bills">ล้าง</a> : null}
          </form>
          {form ? (
            <>
              <FormModal form={form} title="เพิ่มบิล" buttonLabel="เพิ่มบิล" submitPath="/api/bills" openEventName="open-bill-form" />
              <FormModal form={form} title="แก้ไขบิล" buttonLabel="แก้ไขบิล" submitPath="/api/rows" openEventName="open-bill-edit-form" hideLauncher />
            </>
          ) : null}
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          title="รายการบิล"
          subtitle={search ? `Search: ${search}` : undefined}
          rowLabel="รายการ"
          pagination={{
            page,
            pageSize,
            basePath: "/bills",
            query: { search: search || undefined, sort: sort === "oldest" ? sort : undefined },
            pageSizeOptions: [50, 100]
          }}
          sortToggle={{
            href: billsHref(search, pageSize, sort === "latest" ? "oldest" : "latest"),
            label: sort === "latest" ? "ล่าสุดก่อน" : "เก่าสุดก่อน",
            direction: sort
          }}
          detailBasePath="/bills"
          detailKeyColumn="ลำดับ"
          cellFormatters={{
            "จัดการ": (_value, row) => <BillWorkflowActions row={row} compact allowEdit />,
            "เงื่อนไข": (_value, row) => <BillConditions row={row} />,
            "ผู้เบิก": value => {
              const key = String(value || "").trim();
              return requesterNames[key] || key;
            }
          }}
        />
      </section>
    </>
  );
}

function BillConditions({ row }: { row: SheetRow }) {
  const values = [
    row.vat ? `VAT ${row.vat}` : "",
    row["หัก"] ? `หัก ${row["หัก"]}` : "",
    row["เครดิต"] ? `เครดิต ${row["เครดิต"]}` : ""
  ].filter(Boolean);
  return values.length ? (
    <span className="bill-condition-cell">{values.join(" · ")}</span>
  ) : <span className="bill-condition-empty">-</span>;
}

function requesterNameMap(peopleRows: SheetRow[]) {
  return peopleRows.reduce<Record<string, string>>((names, row) => {
    const key = String(row["รหัสพนักงาน"] || "").trim();
    const name = String(row["ชื่อเล่น"] || "").trim();
    if (key && name) names[key] = name;
    return names;
  }, {});
}

async function safeRows(tableName: string): Promise<SheetRow[]> {
  try {
    return await getRows(tableName);
  } catch {
    return [];
  }
}

function filterRows(rows: SheetRow[], search: string) {
  if (!search) return rows;
  const query = search.toLowerCase();
  return rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(query)));
}

function nonEmptyRows(rows: SheetRow[], columns: string[]) {
  const primaryColumns = columns.slice(0, 3);
  return rows.filter(row => primaryColumns.some(column => {
    const value = row[column];
    return value !== null && value !== undefined && String(value).trim() !== "";
  }));
}

function sortBillRows(rows: SheetRow[], sort: SortDirection) {
  return [...rows].sort((left, right) => {
    const diff = latestRowValue(right) - latestRowValue(left);
    return sort === "latest" ? diff : -diff;
  });
}

function latestRowValue(row: SheetRow) {
  const sequence = Number(row["ลำดับ"] || row["à¸¥à¸³à¸”à¸±à¸š"] || 0);
  if (Number.isFinite(sequence) && sequence > 0) return sequence;
  const sheetRow = Number(row._sheetRow || 0);
  return Number.isFinite(sheetRow) ? sheetRow : 0;
}

function firstSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.trunc(parsed);
}

type SortDirection = "latest" | "oldest";

function parseSort(value: string): SortDirection {
  return value === "oldest" ? "oldest" : "latest";
}

function billsHref(search: string, pageSize: number, sort: SortDirection) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort === "oldest") params.set("sort", sort);
  params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/bills?${query}` : "/bills";
}
