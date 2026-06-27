import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataTable } from "@/components/DataTable";
import { isCommittedBill } from "@/lib/bill-status";
import { ProjectDetailEditor } from "@/components/ProjectDetailEditor";
import { TABLES } from "@/lib/config";
import { money, toNumber } from "@/lib/numbers";
import { getRows } from "@/lib/sheets";
import { hydrateProjectSummary, rowsForProject, valueOf } from "@/lib/project-summary";
import type { SheetRow } from "@/lib/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>;
};

const DETAIL_FIELDS = [
  "ID Project",
  "ชื่อ Project",
  "ชื่อลูกค้า",
  "สถานที่",
  "บริษัท",
  "รับผิดชอบ",
  "วันที่",
  "color",
  "คุมงบประเภทงาน",
  "ยอดงาน",
  "ยอดรวม vat",
  "งบไม่เกิน",
  "รวม ALL"
];

const RELATED_COLUMNS = [
  "ลำดับ",
  "ว/ด/ป",
  "ร้าน/บุคคล",
  "สินค้า/ทำงาน",
  "บิล",
  "ประเภท",
  "ยอดเงิน",
  "ยอดโอน",
  "ผู้เบิก",
  "สถานะ"
];

const EXPENSE_CATEGORIES = [
  "ค่าของ",
  "ค่าแรง",
  "พนักงาน",
  "น้ำมัน",
  "ซ่อมรถ",
  "เครื่องจักร",
  "เครื่องมือ",
  "อื่นๆ"
];

const BUDGET_LIMIT_FIELDS = [
  "งบไม่เกินเหล็กเส้น",
  "งบไม่เกินรูปพรรณ",
  "งบไม่เกินคอนกรีต",
  "งบไม่เกินไม้แบบ",
  "งบไม่เกินวัสดุมุง",
  "งบไม่เกินฝ้าผนัง",
  "งบไม่เกินปูพื้น",
  "งบไม่เกินกระจก",
  "งบไม่เกินไฟฟ้า",
  "งบไม่เกินประปา",
  "งบไม่เกินอื่นๆ",
  "งบไม่เกินสีเคมี",
  "งบไม่เกินสุขภัณฑ์",
  "งบไม่เกินบิวอิน",
  "งบไม่เกินแอร์",
  "งบไม่เกินดิน",
  "งบไม่เกินหินทราย",
  "งบไม่เกินเตรียมงาน",
  "งบไม่เกินค่าของ",
  "งบไม่เกินค่าแรง"
];

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  const decodedProjectId = decodeURIComponent(projectId);
  const [projectRows, dataRows, contractRows] = await Promise.all([
    getRows(TABLES.PROJECT).catch(() => []),
    getRows(TABLES.DATA).catch(() => []),
    getRows(TABLES.CONTRACT_WORK).catch(() => [])
  ]);
  const project = projectRows.find(row => String(row["ID Project"] || "").trim() === decodedProjectId.trim());
  if (!project) notFound();

  const relatedRows = rowsForProject(dataRows, project["ID Project"]);
  const summaryRows = relatedRows.filter(isCommittedBill);
  const relatedContractRows = contractRows.filter(row => String(row["ID Project"] || "").trim() === String(project["ID Project"] || "").trim());
  const { project: hydratedProject, totals } = hydrateProjectSummary(project, relatedRows);
  const expenseBreakdown = buildExpenseBreakdown(summaryRows, totals.totalAll);
  const budgetBreakdown = buildBudgetBreakdown(hydratedProject, summaryRows);
  const contractorPaidBreakdown = buildContractorPaidBreakdown(summaryRows);
  const contractWorkBreakdown = buildContractWorkBreakdown(relatedContractRows);
  const appSheetSummaries = buildAppSheetProjectSummaries(summaryRows, totals);
  const projectName = displayValue(valueOf(hydratedProject, ["ชื่อ Project"])) || `Project ${decodedProjectId}`;
  const tone = projectTone(hydratedProject);

  return (
    <>
      <header className="toolbar project-detail-toolbar">
        <div>
          <h2>{projectName}</h2>
          <p>Project Detail</p>
        </div>
        <Link className="back-link-button" href="/views/project-all">
          <ArrowLeft size={16} />
          <span>กลับ</span>
        </Link>
      </header>

      <section className="content project-detail-page">
        <article className={`project-detail-card project-detail-${tone}`}>
          <div className="project-detail-hero">
            <div>
              <span>Project</span>
              <h3>{projectName}</h3>
            </div>
            <strong>{displayValue(hydratedProject["ID Project"])}</strong>
          </div>

          <div className="project-detail-metrics">
            <Metric label="ยอดงาน" value={money(totals.workTotal)} />
            <Metric label="ยอดรวม vat" value={money(totals.totalVat)} />
            <Metric label="งบไม่เกิน" value={money(totals.budget)} />
            <Metric label="รวม ALL" value={money(totals.totalAll)} />
            <Metric label="คงเหลือ" value={money(totals.remaining)} tone={totals.remaining < 0 ? "danger" : "success"} />
            <Metric label="จำนวนบิล" value={String(totals.billCount)} />
          </div>

          <div className="project-detail-grid">
            <ProjectDetailEditor fields={DETAIL_FIELDS} project={hydratedProject} />

            <section className="project-detail-section">
              <h3>แยกตามประเภทค่าใช้จ่าย</h3>
              <div className="expense-breakdown-wrap">
                <table className="expense-breakdown-table">
                  <thead>
                    <tr>
                      <th>ประเภท</th>
                      <th className="numeric-cell">รายการ</th>
                      <th className="numeric-cell">ยอดเงิน</th>
                      <th className="numeric-cell">ยอดโอน</th>
                      <th className="numeric-cell">เฉลี่ย</th>
                      <th className="numeric-cell">% รวม</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseBreakdown.map(item => (
                      <tr key={item.label}>
                        <td>{item.label}</td>
                        <td className="numeric-cell">{item.count}</td>
                        <td className="numeric-cell">{money(item.amount)}</td>
                        <td className="numeric-cell">{money(item.transfer)}</td>
                        <td className="numeric-cell">{money(item.average)}</td>
                        <td className="numeric-cell">{item.percent.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>รวม</td>
                      <td className="numeric-cell">{expenseBreakdown.reduce((sum, item) => sum + item.count, 0)}</td>
                      <td className="numeric-cell">{money(expenseBreakdown.reduce((sum, item) => sum + item.amount, 0))}</td>
                      <td className="numeric-cell">{money(expenseBreakdown.reduce((sum, item) => sum + item.transfer, 0))}</td>
                      <td className="numeric-cell">-</td>
                      <td className="numeric-cell">100.00%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="project-detail-section project-budget-section">
              <h3>สรุปแยกกลุ่ม</h3>
              <div className="project-grouped-summary">
                <WorkTypePanel title="รวมจ่ายประเภทงาน" items={budgetBreakdown.firstGroup} />
                <WorkTypePanel title="รวมจ่ายประเภทงาน 2" items={budgetBreakdown.secondGroup} />
                <PaymentSummaryPanel rows={expenseBreakdown} totals={totals} />
                <ContractorPaidSummaryPanel rows={contractorPaidBreakdown} />
                <ContractProjectSummaryPanels rows={contractWorkBreakdown} />
                <BeforeVatSummaryPanel rows={appSheetSummaries.beforeVatRows} />
              </div>
            </section>

            <ProjectVisualSummary beforeVatRows={appSheetSummaries.beforeVatRows} expenseRows={expenseBreakdown} />
          </div>
        </article>

        <div className="project-related-table">
          <DataTable
            columns={RELATED_COLUMNS}
            rows={relatedRows}
            title="รายการที่เกี่ยวข้อง"
            subtitle={`${relatedRows.length} รายการจาก Data`}
            rowLabel="รายการ"
            limit={120}
          />
        </div>
      </section>
    </>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  return (
    <div className={`project-metric project-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WorkTypePanel({
  title,
  items
}: {
  title: string;
  items: Array<{ field: string; label: string; actual: number; limit: number }>;
}) {
  const actualTotal = items.reduce((sum, item) => sum + item.actual, 0);
  const limitTotal = items.reduce((sum, item) => sum + item.limit, 0);
  return (
    <section className="summary-card summary-card-work">
      <header className="summary-card-head">
        <div>
          <h4>{title}</h4>
          <span>{items.length} หมวดงาน</span>
        </div>
        <strong>{formatCompactMoney(actualTotal)}</strong>
      </header>
      <div className="work-type-budget-card">
        <div className="work-type-budget-panel">
          <div className="work-type-budget-grid">
            {items.map(item => (
              <div className="work-type-budget-item" key={item.field}>
                <div className="work-type-line">
                  <span>{item.label}</span>
                  <strong>{formatCompactMoney(item.actual)}</strong>
                </div>
                <div className="work-type-limit-line">
                  <small>งบไม่เกิน</small>
                  <b>{formatCompactMoney(item.limit)}</b>
                </div>
              </div>
            ))}
          </div>
          <div className="work-type-budget-total">
            <span>รวม</span>
            <strong>{formatCompactMoney(actualTotal)}</strong>
            <small>งบไม่เกิน {formatCompactMoney(limitTotal)}</small>
          </div>
        </div>
      </div>
    </section>
  );
}

function PaymentSummaryPanel({
  rows,
  totals
}: {
  rows: Array<{ label: string; amount: number }>;
  totals: ReturnType<typeof hydrateProjectSummary>["totals"];
}) {
  return (
    <section className="summary-card summary-card-payment">
      <header className="summary-card-head">
        <div>
          <h4>รวมจ่ายเงิน</h4>
          <span>แยกตามหมวดค่าใช้จ่าย</span>
        </div>
        <strong>{formatCompactMoney(totals.totalAll)}</strong>
      </header>
      <div className="payment-summary-card">
        <div className="payment-summary-list">
          {rows.map(row => (
            <div key={row.label}>
              <span>รวม{row.label}</span>
              <strong>{formatCompactMoney(row.amount)}</strong>
            </div>
          ))}
        </div>
        <div className="payment-summary-side">
          <div><span>ยอดรวม vat</span><strong>{formatCompactMoney(totals.totalVat)}</strong></div>
          <div><span>งบไม่เกิน</span><strong>{formatCompactMoney(totals.budget)}</strong></div>
          <div><span>ยอดรวม</span><strong>{formatCompactMoney(totals.totalAll)}</strong></div>
        </div>
      </div>
    </section>
  );
}

function ContractorSummaryPanel({
  rows
}: {
  rows: Array<{ id: string; name: string; amount: number; paid: number; detail: string }>;
}) {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const paidTotal = rows.reduce((sum, row) => sum + row.paid, 0);
  return (
    <section className="summary-card summary-card-contractors">
      <header className="summary-card-head">
        <div>
          <h4>รวมจ่ายผู้รับเหมา</h4>
          <span>{rows.length} รายการจากงานรับเหมา</span>
        </div>
        <strong>{formatCompactMoney(total)}</strong>
      </header>
      <div className="contractor-summary-card">
        <table>
          <thead>
            <tr>
              <th>ชื่อผู้รับเหมา</th>
              <th className="numeric-cell">จำนวนเงิน</th>
              <th className="numeric-cell">ยอดเงิน</th>
              <th>รายละเอียดงาน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id || `${row.name}-${row.detail}`}>
                <td>{row.name || "-"}</td>
                <td className="numeric-cell">{formatCompactMoney(row.amount)}</td>
                <td className="numeric-cell">{formatCompactMoney(row.paid)}</td>
                <td>{row.detail || "-"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4}>ไม่พบข้อมูลงานรับเหมา</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="contractor-summary-total">
          <span>รวมเงินจ้าง</span>
          <strong>{formatCompactMoney(total)} บาท</strong>
          {paidTotal !== total ? <small>ยอดเงิน {formatCompactMoney(paidTotal)} บาท</small> : null}
        </div>
      </div>
    </section>
  );
}

function AppSheetProjectSummaryPanel({
  summaries
}: {
  summaries: ReturnType<typeof buildAppSheetProjectSummaries>;
}) {
  return (
    <section className="summary-card appsheet-extra-row">
      <header className="summary-card-head">
        <div>
          <h4>สรุป Project เพิ่มเติม</h4>
          <span>ข้อมูลเสริมตาม Project Detail</span>
        </div>
      </header>
      <div className="appsheet-extra-grid">
        <SmallSummaryCard title="รวมจ่ายProject" rows={summaries.billRows} />
        <SmallSummaryCard title="รวมจ่ายProject2" rows={summaries.taxRows} />
        <SmallSummaryCard title="รวมจ่ายProject3" rows={summaries.requesterRows} />
        <SmallSummaryCard title="รวมจ่ายProject4" rows={summaries.recentRows} />
        <SmallSummaryCard title="ยอดรวมก่อน VAT" rows={summaries.beforeVatRows} wide />
      </div>
    </section>
  );
}

function SmallSummaryCard({ title, rows, wide = false }: { title: string; rows: Array<{ label: string; value: string }>; wide?: boolean }) {
  return (
    <article className={wide ? "small-summary-card small-summary-wide" : "small-summary-card"}>
      <h5>{title}</h5>
      <div>
        {rows.map((row, index) => (
          <p key={`${row.label}-${index}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </p>
        ))}
      </div>
    </article>
  );
}

function ContractorPaidSummaryPanel({
  rows
}: {
  rows: Array<{ id: string; name: string; amount: number; paid: number; detail: string }>;
}) {
  return (
    <ContractorTablePanel
      title="รวมจ่ายผู้รับเหมา"
      subtitle={`${rows.length} รายการจ่ายจาก Data`}
      rows={rows}
      totalLabel="รวมเงินจ่าย"
      emptyLabel="ไม่พบข้อมูลจ่ายผู้รับเหมา"
    />
  );
}

function ContractProjectSummaryPanels({
  rows
}: {
  rows: Array<{ id: string; name: string; amount: number; paid: number; detail: string }>;
}) {
  const chunks = chunkRows(rows, 12).slice(0, 4);
  while (chunks.length < 4) chunks.push([]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const titles = ["รวมจ่ายProject", "รวมจ่ายProject2", "รวมจ่ายProject3", "รวมจ่ายProject4"];
  return (
    <div className="contract-project-grid">
      {titles.map((title, index) => (
        <ContractorTablePanel
          key={title}
          title={title}
          subtitle={`ชุดที่ ${index + 1}`}
          rows={chunks[index]}
          totalLabel="รวมเงินจ้าง"
          totalOverride={total}
          emptyLabel="ไม่พบข้อมูลงานจ้าง"
          compact
        />
      ))}
    </div>
  );
}

function ContractorTablePanel({
  title,
  subtitle,
  rows,
  totalLabel,
  totalOverride,
  emptyLabel,
  compact = false
}: {
  title: string;
  subtitle: string;
  rows: Array<{ id: string; name: string; amount: number; paid: number; detail: string }>;
  totalLabel: string;
  totalOverride?: number;
  emptyLabel: string;
  compact?: boolean;
}) {
  const amountTotal = totalOverride ?? rows.reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className={compact ? "summary-card summary-card-contractors summary-card-contractors-compact" : "summary-card summary-card-contractors"}>
      <header className="summary-card-head">
        <div>
          <h4>{title}</h4>
          <span>{subtitle}</span>
        </div>
        <strong>{formatCompactMoney(amountTotal)}</strong>
      </header>
      <div className="contractor-summary-card">
        <table>
          <thead>
            <tr>
              <th>ชื่อผู้รับเหมา</th>
              <th className="numeric-cell">จำนวนเงิน</th>
              <th className="numeric-cell">ยอดเงิน</th>
              <th>รายละเอียดงาน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${title}-${row.id || index}-${row.name}-${row.detail}`}>
                <td>{row.name || "-"}</td>
                <td className="numeric-cell">{formatCompactMoney(row.amount)}</td>
                <td className="numeric-cell">{formatCompactMoney(row.paid)}</td>
                <td>{row.detail || "-"}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4}>{emptyLabel}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="contractor-summary-total">
          <span>{totalLabel}</span>
          <strong>{formatCompactMoney(amountTotal)} บาท</strong>
        </div>
      </div>
    </section>
  );
}

function BeforeVatSummaryPanel({ rows }: { rows: Array<{ label: string; value: string; tone?: string }> }) {
  return (
    <section className="summary-card before-vat-summary-card">
      <header className="summary-card-head">
        <div>
          <h4>ยอดรวมก่อน VAT</h4>
          <span>สรุปยอดงานและ VAT</span>
        </div>
      </header>
      <div className="before-vat-summary-grid">
        {rows.map((row, index) => (
          <div className={row.tone ? `before-vat-item before-vat-${row.tone}` : "before-vat-item"} key={`${row.label}-${index}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectVisualSummary({
  beforeVatRows,
  expenseRows
}: {
  beforeVatRows: Array<{ label: string; value: string; tone?: string }>;
  expenseRows: Array<{ label: string; amount: number; percent: number }>;
}) {
  const beforeVatValues = beforeVatRows.map(row => ({ ...row, amount: parseCompactMoney(row.value) }));
  const beforeVatMax = Math.max(...beforeVatValues.map(row => row.amount), 1);
  const mainExpenses = expenseRows
    .filter(row => row.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 6);
  const expenseTotal = mainExpenses.reduce((sum, row) => sum + row.amount, 0) || 1;

  return (
    <section className="project-detail-section project-visual-section">
      <h3>ภาพรวมข้อมูล</h3>
      <div className="project-visual-grid">
        <article className="visual-card">
          <header>
            <h4>ยอดรวมก่อน VAT</h4>
            <span>ค่าแรง / ค่าของ / ค่าน้ำมัน</span>
          </header>
          <div className="visual-bar-list">
            {beforeVatValues.map(row => (
              <div className="visual-bar-row" key={row.label}>
                <div className="visual-bar-label">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
                <div className="visual-track">
                  <span className={`visual-fill visual-fill-${row.tone || "default"}`} style={{ width: `${Math.max(4, row.amount / beforeVatMax * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="visual-card">
          <header>
            <h4>สัดส่วนค่าใช้จ่าย</h4>
            <span>หมวดที่มียอดสูงสุด</span>
          </header>
          <div className="expense-ratio-list">
            {mainExpenses.map((row, index) => (
              <div className="expense-ratio-row" key={row.label}>
                <span className={`ratio-dot ratio-dot-${index % 6}`} />
                <span>{row.label}</span>
                <div className="ratio-track">
                  <b style={{ width: `${Math.max(4, row.amount / expenseTotal * 100)}%` }} />
                </div>
                <strong>{formatCompactMoney(row.amount)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

function projectTone(row: SheetRow) {
  const color = String(row.color || "").trim().toLowerCase();
  if (color === "black") return "dark";
  if (color === "red") return "red";
  return "green";
}

function displayValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function buildExpenseBreakdown(rows: SheetRow[], totalAll: number) {
  return EXPENSE_CATEGORIES.map(label => {
    const activeRows = rows.filter(row => toNumber(row[label]) > 0);
    const amount = activeRows.reduce((sum, row) => sum + toNumber(row[label]), 0);
    const transfer = activeRows.reduce((sum, row) => sum + toNumber(row["ยอดโอน"]), 0);
    const count = activeRows.length;
    return {
      label,
      count,
      amount,
      transfer,
      average: count ? amount / count : 0,
      percent: totalAll ? amount / totalAll * 100 : 0
    };
  });
}

function buildBudgetBreakdown(project: SheetRow, rows: SheetRow[]) {
  const items = BUDGET_LIMIT_FIELDS.map(field => ({
    field,
    label: field.replace("งบไม่เกิน", ""),
    limit: toNumber(project[field]),
    actual: sumRowsByWorkType(rows, field.replace("งบไม่เกิน", ""))
  }));
  return {
    items,
    firstGroup: items.slice(0, 11),
    secondGroup: items.slice(11),
    actualTotal: items.reduce((sum, item) => sum + item.actual, 0),
    limitTotal: items.reduce((sum, item) => sum + item.limit, 0)
  };
}

function buildContractorBreakdown(rows: SheetRow[]) {
  return rows
    .map(row => {
      const amount = toNumber(row["ยอดเงินจ้าง"]);
      const paid = toNumber(row["ยอดเงินจ่าย"]) || amount;
      return {
        id: String(row["id_Conwork"] || row._sheetRow || ""),
        name: String(valueOf(row, ["ชื่อเล่น", "ชื่อ-นามสกุล", "id_Contractor"]) || "").trim(),
        amount,
        paid,
        detail: String(valueOf(row, ["รายละเอียดงาน"]) || "").trim()
      };
    })
    .filter(row => row.name || row.amount || row.detail)
    .sort((left, right) => right.amount - left.amount);
}

function buildContractorPaidBreakdown(rows: SheetRow[]) {
  const grouped = new Map<string, { id: string; name: string; amount: number; paid: number; detail: string }>();
  rows.forEach((row, index) => {
    const laborAmount = toNumber(row["ค่าแรง"]);
    const category = String(valueOf(row, ["ประเภท", "สินค้า/ทำงาน", "รายการ"]) || "");
    const amount = laborAmount || (category.includes("ค่าแรง") ? toNumber(row["ยอดเงิน"]) : 0);
    if (!amount) return;

    const name = String(valueOf(row, ["ผู้รับเหมา", "ร้าน/บุคคล", "ร้านค้า", "ชื่อผู้รับเหมา"]) || "-").trim();
    const detail = String(valueOf(row, ["รายละเอียดงาน", "สินค้า/ทำงาน", "รายการ"]) || "-").trim();
    const key = `${name}|${detail}`;
    const current = grouped.get(key) || {
      id: `paid-${index}`,
      name,
      amount: 0,
      paid: 0,
      detail
    };
    current.amount += amount;
    current.paid += toNumber(row["ยอดโอน"]) || toNumber(row["ยอดเงิน"]) || amount;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort((left, right) => right.amount - left.amount);
}

function buildContractWorkBreakdown(rows: SheetRow[]) {
  return rows
    .map(row => {
      const amount = toNumber(row["ยอดเงินจ้าง"]);
      const paid = toNumber(row["ยอดเงินจ่าย"]) || amount;
      return {
        id: String(row["id_Conwork"] || row._sheetRow || ""),
        name: String(valueOf(row, ["ชื่อเล่น", "ชื่อ-นามสกุล", "id_Contractor"]) || "").trim(),
        amount,
        paid,
        detail: String(valueOf(row, ["รายละเอียดงาน"]) || "").trim()
      };
    })
    .filter(row => row.name || row.amount || row.detail)
    .sort((left, right) => right.amount - left.amount);
}

function chunkRows<T>(rows: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    chunks.push(rows.slice(index, index + size));
  }
  return chunks;
}

function buildAppSheetProjectSummaries(rows: SheetRow[], totals: ReturnType<typeof hydrateProjectSummary>["totals"]) {
  const mainRows = rows.filter(row => String(row["บิล"] || "").includes("หลัก"));
  const subRows = rows.filter(row => String(row["บิล"] || "").includes("ย่อย"));
  const vatRows = rows.filter(row => String(row.vat || "").trim());
  const deductRows = rows.filter(row => String(row["หัก"] || "").trim());
  const creditRows = rows.filter(row => String(row["เครดิต"] || "").trim());
  const topRequesters = topGroups(rows, row => String(row["ผู้เบิก"] || "-"), 4);
  const latestRows = [...rows].sort((left, right) => rowDateValue(right) - rowDateValue(left)).slice(0, 4);
  const laborBeforeVat = roundMoney(sumBeforeVatRows(rows, "ค่าแรง", { includeCompanyLaborVat: true }));
  const materialBeforeVat = roundMoney(sumBeforeVatRows(rows, "ค่าของ"));
  const fuelBeforeVat = Math.floor(sumBeforeVatRows(rows, "น้ำมัน"));
  const beforeVatTotal = laborBeforeVat + materialBeforeVat + fuelBeforeVat;

  return {
    billRows: [
      { label: "บิลหลัก", value: `${mainRows.length} / ${formatCompactMoney(sumRows(mainRows, "ยอดเงิน"))}` },
      { label: "บิลย่อย", value: `${subRows.length} / ${formatCompactMoney(sumRows(subRows, "ยอดเงิน"))}` },
      { label: "ทั้งหมด", value: `${rows.length} / ${formatCompactMoney(sumRows(rows, "ยอดเงิน"))}` }
    ],
    taxRows: [
      { label: "มี VAT", value: `${vatRows.length} / ${formatCompactMoney(sumRows(vatRows, "ยอดเงิน"))}` },
      { label: "มีหัก", value: `${deductRows.length} / ${formatCompactMoney(sumRows(deductRows, "ยอดเงิน"))}` },
      { label: "เครดิต", value: `${creditRows.length} / ${formatCompactMoney(sumRows(creditRows, "ยอดเงิน"))}` }
    ],
    requesterRows: topRequesters.map(item => ({
      label: item.label,
      value: `${item.count} / ${formatCompactMoney(item.amount)}`
    })),
    recentRows: latestRows.map(row => ({
      label: String(row["ว/ด/ป"] || row["วันที่"] || "-"),
      value: formatCompactMoney(toNumber(row["ยอดเงิน"]))
    })),
    beforeVatRows: [
      { label: "ค่าแรง", value: formatCompactMoney(laborBeforeVat), tone: "labor" },
      { label: "ค่าของ", value: formatCompactMoney(materialBeforeVat), tone: "material" },
      { label: "ค่าน้ำมัน", value: formatCompactMoney(fuelBeforeVat), tone: "fuel" },
      { label: "รวม", value: formatCompactMoney(beforeVatTotal), tone: "total" }
    ]
  };
}

function sumBeforeVatRows(rows: SheetRow[], column: string, options: { includeCompanyLaborVat?: boolean } = {}) {
  return rows.reduce((sum, row) => {
    const amount = toNumber(row[column]);
    if (!amount) return sum;
    const hasVat = String(row.vat || "").trim() !== "";
    const isCompanyLabor = options.includeCompanyLaborVat && String(row["statusค่าแรง"] || "").trim() === "บริษัท";
    return sum + (hasVat || isCompanyLabor ? amount / 1.07 : amount);
  }, 0);
}

function roundMoney(value: number) {
  return Math.round(toNumber(value) * 100) / 100;
}

function topGroups(rows: SheetRow[], getLabel: (row: SheetRow) => string, limit: number) {
  const grouped = new Map<string, { label: string; count: number; amount: number }>();
  rows.forEach(row => {
    const label = getLabel(row).trim() || "-";
    const current = grouped.get(label) || { label, count: 0, amount: 0 };
    current.count += 1;
    current.amount += toNumber(row["ยอดเงิน"]);
    grouped.set(label, current);
  });
  return [...grouped.values()].sort((left, right) => right.amount - left.amount).slice(0, limit);
}

function sumRows(rows: SheetRow[], column: string) {
  return rows.reduce((sum, row) => sum + toNumber(row[column]), 0);
}

function rowDateValue(row: SheetRow) {
  const raw = String(row["ว/ด/ป"] || row["วันที่"] || "");
  const parts = raw.split(/[/-]/).map(Number);
  if (parts.length >= 3 && parts.every(Number.isFinite)) {
    const [day, month, year] = parts;
    const normalizedYear = year > 2400 ? year - 543 : year;
    return new Date(normalizedYear, month - 1, day).getTime();
  }
  return 0;
}

function sumRowsByWorkType(rows: SheetRow[], label: string) {
  const query = label.trim().toLowerCase();
  if (!query) return 0;
  return rows.reduce((sum, row) => {
    const haystack = [
      row["สินค้า"],
      row["สินค้า/ทำงาน"],
      row["รายละเอียดงาน"],
      row["รายการ"],
      row["ประเภท"]
    ].map(value => String(value || "").toLowerCase()).join(" ");
    return haystack.includes(query) ? sum + toNumber(row["ยอดเงิน"]) : sum;
  }, 0);
}

function formatCompactMoney(value: number) {
  return toNumber(value).toLocaleString("th-TH", {
    maximumFractionDigits: 2
  });
}

function parseCompactMoney(value: string) {
  return toNumber(String(value || "").replace(/,/g, ""));
}
