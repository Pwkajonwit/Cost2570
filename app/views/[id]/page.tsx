import { notFound } from "next/navigation";
import { BillFollowDashboard, MainDashboard, WithdrawDashboard, WorkStatusDashboard } from "@/components/Dashboards";
import { DataTable } from "@/components/DataTable";
import { FormModal } from "@/components/FormModal";
import { ManageTableClient } from "@/components/ManageTableClient";
import { TABLE_KEYS, TABLES } from "@/lib/config";
import { getFormPayload } from "@/lib/form";
import { hydrateContractRows } from "@/lib/formulas";
import { toNumber } from "@/lib/numbers";
import { getHeaders, getRows } from "@/lib/sheets";
import { getViewById, getViewColumns } from "@/lib/views";

export const dynamic = "force-dynamic";

type ViewPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ViewPage({ params, searchParams }: ViewPageProps) {
  const { id } = await params;
  const query = await searchParams;
  const search = firstSearchParam(query?.search).trim();
  const view = getViewById(id);
  if (!view) notFound();
  const displayName = getDisplayViewName(view.id, view.name);

  return (
    <>
      {view.position !== "menu" ? (
        <header className={getToolbarClassName(view.id)}>
          <div>
            <h2>{displayName}</h2>
            {search || (view.type !== "dashboard" && view.id !== "contract-open") ? <p>{search ? `ค้นหา: ${search}` : view.table || ""}</p> : null}
          </div>
        </header>
      ) : null}
      {await renderView(view, search, query, displayName)}
    </>
  );
}

async function renderView(
  view: NonNullable<ReturnType<typeof getViewById>>,
  search: string,
  query?: Record<string, string | string[] | undefined>,
  displayName = view.name
) {
  if (view.id === "dashboard-main") return <MainDashboard />;
  if (view.id === "withdraw-request") {
    return (
      <WithdrawDashboard
        filters={{
          requester: firstSearchParam(query?.requester).trim(),
          date: firstSearchParam(query?.date).trim(),
          bill: firstSearchParam(query?.bill).trim(),
          search
        }}
      />
    );
  }
  if (view.id === "bill-follow") return <BillFollowDashboard />;
  if (view.id === "work-status") return <WorkStatusDashboard />;

  if (view.type === "table" && view.table) {
    const page = parsePositiveInt(firstSearchParam(query?.page), 1);
    const pageSize = parsePositiveInt(firstSearchParam(query?.pageSize), 80);
    const sort = parseSort(firstSearchParam(query?.sort));
    const [rawRows, headers, form, projectDataRows, companyRows] = await Promise.all([
      safeRows(view.table),
      getHeaders(view.table).catch(() => []),
      usesSchemaForm(view.id) ? getFormPayload(view.table).catch(() => null) : Promise.resolve(null),
      view.id === "project-all" ? safeRows(TABLES.DATA) : Promise.resolve([]),
      view.id === "project-all" ? safeRows(TABLES.COMPANY) : Promise.resolve([])
    ]);
    const hydratedRows = view.id === "contract-open"
      ? await hydrateContractRows(rawRows)
      : view.id === "project-all"
        ? hydrateProjectRowsForList(rawRows, projectDataRows)
        : rawRows;
    const rows = filterRows(hydratedRows, search);
    const displayRows = view.id === "contract-open" ? sortContractRows(rows, sort) : rows;
    const fallback = rows[0] ? Object.keys(rows[0]).filter(column => !column.startsWith("_")) : [];
    const columns = getViewColumns(view.name, fallback);
    if (view.position === "menu") {
      const keyColumn = tableKeyColumn(view.id, view.table);
      const schemaAddEventName = form ? `open-${view.id}-form` : undefined;
      const schemaEditEventName = form ? `open-${view.id}-edit-form` : undefined;
      return (
        <section className={`content table-view table-view-${view.id} manage-view`}>
          <ManageTableClient
            tableName={view.table}
            viewName={view.name}
            columns={columns}
            formColumns={getManageFormColumns(columns, headers, keyColumn)}
            rows={rows}
            keyColumn={keyColumn}
            search={search}
            rowLabel="รายการ"
            detailBasePath={detailBasePathForView(view.id)}
            addOpenEventName={schemaAddEventName}
            editOpenEventName={schemaEditEventName}
            displayLookups={view.id === "project-all" ? { "บริษัท": companyLookup(companyRows) } : undefined}
          />
          {form ? (
            <>
              <FormModal
                form={form}
                title={`เพิ่ม ${displayName}`}
                buttonLabel={`เพิ่ม ${displayName}`}
                relaxed
                submitPath="/api/rows"
                openEventName={schemaAddEventName}
                hideLauncher
              />
              <FormModal
                form={form}
                title={`แก้ไข ${displayName}`}
                buttonLabel={`แก้ไข ${displayName}`}
                relaxed
                submitPath="/api/rows"
                openEventName={schemaEditEventName}
                hideLauncher
              />
            </>
          ) : null}
        </section>
      );
    }

    return (
      <section className={`content table-view table-view-${view.id}`}>
        {view.id === "contract-open" ? (
          <div className="contract-compact-bar">
            <form className="contract-search-form" action={`/views/${view.id}`}>
              <label>
                <span>ค้นหา</span>
                <input name="search" type="search" defaultValue={search} placeholder="Project, ผู้รับเหมา, รายละเอียดงาน" />
              </label>
              <button type="submit" className="primary">ค้นหา</button>
              {search ? <a className="contract-clear-link" href={`/views/${view.id}`}>ล้าง</a> : null}
            </form>
            {form ? <FormModal form={form} relaxed submitPath="/api/rows" openEventName="open-contract-form" /> : null}
          </div>
        ) : (
          form ? <FormModal form={form} relaxed={view.id === "contract-open"} openEventName={view.id === "contract-open" ? "open-contract-form" : undefined} /> : null
        )}
        <DataTable
          columns={columns}
          rows={displayRows}
          title={view.name}
          subtitle={search ? `Search: ${search}` : view.id === "contract-open" ? undefined : view.table}
          pagination={view.id === "contract-open" ? {
            page,
            pageSize,
            basePath: `/views/${view.id}`,
            query: { search: search || undefined, sort: sort === "oldest" ? sort : undefined },
            pageSizeOptions: [50, 100]
          } : undefined}
          sortToggle={view.id === "contract-open" ? {
            href: contractHref(view.id, search, pageSize, sort === "latest" ? "oldest" : "latest"),
            label: sort === "latest" ? "ล่าสุดก่อน" : "เก่าสุดก่อน",
            direction: sort
          } : undefined}
          detailBasePath={view.id === "contract-open" ? "/views/contract-open" : undefined}
          detailKeyColumn={view.id === "contract-open" ? "id_Conwork" : undefined}
        />
      </section>
    );
  }

  return <section className="content panel">ยังไม่ได้ตั้งค่าหน้านี้</section>;
}

async function safeRows(tableName: string, search = "") {
  try {
    const rows = await getRows(tableName);
    return filterRows(rows, search);
  } catch {
    return [];
  }
}

function filterRows(rows: Awaited<ReturnType<typeof getRows>>, search = "") {
  if (!search) return rows;
  const query = search.toLowerCase();
  return rows.filter(row => Object.values(row).some(value => String(value || "").toLowerCase().includes(query)));
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

function sortContractRows(rows: Awaited<ReturnType<typeof getRows>>, sort: SortDirection) {
  return [...rows].sort((left, right) => {
    const diff = contractSortValue(right) - contractSortValue(left);
    return sort === "latest" ? diff : -diff;
  });
}

function contractSortValue(row: Awaited<ReturnType<typeof getRows>>[number]) {
  const conwork = String(row.id_Conwork || "");
  const conworkNumber = Number(conwork.match(/\d+/)?.[0] || 0);
  if (Number.isFinite(conworkNumber) && conworkNumber > 0) return conworkNumber;
  const sheetRow = Number(row._sheetRow || 0);
  return Number.isFinite(sheetRow) ? sheetRow : 0;
}

function contractHref(viewId: string, search: string, pageSize: number, sort: SortDirection) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (sort === "oldest") params.set("sort", sort);
  params.set("pageSize", String(pageSize));
  const query = params.toString();
  return query ? `/views/${viewId}?${query}` : `/views/${viewId}`;
}

function getToolbarClassName(viewId: string) {
  if (viewId === "withdraw-request") return "toolbar withdraw-request-toolbar";
  if (viewId === "contract-open") return "toolbar contract-open-toolbar";
  if (viewId === "bill-follow") return "toolbar bill-follow-toolbar";
  if (viewId === "work-status") return "toolbar work-status-toolbar";
  return "toolbar";
}

function getDisplayViewName(viewId: string, fallback: string) {
  if (viewId === "work-status") return "สถานะงาน";
  return fallback;
}

function getManageFormColumns(columns: string[], headers: string[], keyColumn: string) {
  const available = headers.length ? headers : columns;
  const candidates = [keyColumn, ...columns];
  return [...new Set(candidates)].filter(column => {
    if (!column || column === "_sheetRow" || column === "_RowNumber") return false;
    return available.includes(column);
  });
}

function usesSchemaForm(viewId: string) {
  return ["contract-open", "project-all", "banks", "stores", "contractors", "people", "cars", "customers", "companies", "loans"].includes(viewId);
}

function detailBasePathForView(viewId: string) {
  if (viewId === "project-all") return "/views/project-all";
  if (["banks", "stores", "contractors", "people", "cars", "customers", "companies", "loans"].includes(viewId)) return `/views/${viewId}`;
  return undefined;
}

function tableKeyColumn(viewId: string, tableName: string) {
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
  return keyByView[viewId] || TABLE_KEYS[tableName] || "_RowNumber";
}

const PROJECT_TOTAL_COLUMNS = [
  "ยอดเงิน",
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

function hydrateProjectRowsForList(projectRows: Awaited<ReturnType<typeof getRows>>, dataRows: Awaited<ReturnType<typeof getRows>>) {
  const totals = dataRows.reduce<Record<string, number>>((accumulator, row) => {
    const projectId = String(row["ID Project"] || "").trim();
    if (!projectId) return accumulator;
    const amount = toNumber(row["ยอดเงิน"]) || PROJECT_TOTAL_COLUMNS.slice(1).reduce((sum, column) => sum + toNumber(row[column]), 0);
    accumulator[projectId] = (accumulator[projectId] || 0) + amount;
    return accumulator;
  }, {});

  return projectRows.map(row => {
    const projectId = String(row["ID Project"] || "").trim();
    const output = { ...row };
    if (!hasRowValue(output["รวม ALL"])) output["รวม ALL"] = totals[projectId] ?? 0;
    if (!hasRowValue(output["ยอดรวม vat"]) && hasRowValue(output["ยอดงาน"])) {
      output["ยอดรวม vat"] = toNumber(output["ยอดงาน"]) * 1.07;
    }
    return output;
  });
}

function hasRowValue(value: unknown) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function companyLookup(companyRows: Awaited<ReturnType<typeof getRows>>) {
  return companyRows.reduce<Record<string, string>>((lookup, row) => {
    const key = String(row.id_Company || row["id_Company"] || "").trim();
    const name = String(row["ชื่อบริษัท"] || row["บริษัท"] || "").trim();
    if (key && name) lookup[key] = name;
    return lookup;
  }, {});
}

