import {
  BarChart3,
  Filter,
  TrendingUp,
} from "lucide-react";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
} from "@/components/dashboard-shell";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { TurnoverAnalyticsCharts } from "@/components/turnover-analytics-charts";
import { requireDashboardCapability } from "@/lib/auth-role";
import { TurnoverReportControls } from "@/components/turnover-report-controls";
import {
  getQuarterlyTurnoverSummary,
  getTurnoverBaseline,
} from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("viewReports");
  const [summary, baseline] = await Promise.all([
    getQuarterlyTurnoverSummary(),
    getTurnoverBaseline(),
  ]);
  const currentQuarterStart = getCurrentQuarterStart();
  const quarters = quarterTrendTotals(summary);
  const latest = quarters.at(-1);
  const previous = quarters.at(-2);
  const rateChange =
    latest?.rate != null && previous?.rate != null
      ? latest.rate - previous.rate
      : null;
  const totalExits = baseline.reduce((total, item) => total + item.exits, 0);
  const allReasons = aggregate(baseline.map((item) => [item.reason_category, item.exits]));
  const reasons = allReasons.slice(0, 6);
  const departments = aggregate(baseline.map((item) => [item.department, item.exits])).slice(0, 6);
  const reportableCategories = allReasons.filter(([reason]) => reason !== "Not recorded").length;
  const schools = new Set(
    baseline
      .map((item) => item.school)
      .filter((school) => school !== "Not recorded"),
  ).size;
  const detailRows = summary
    .filter((quarter) => quarter.quarter_start < currentQuarterStart)
    .map((quarter) => ({
      quarter: quarter.quarter_start,
      department: quarter.department,
      cells: [
      `${formatQuarter(quarter.quarter_start)} · ${quarter.department}`,
      quarter.exits,
      formatNumber(quarter.active_headcount),
      quarter.attrition_rate_pct == null
        ? "N/A"
        : `${Number(quarter.attrition_rate_pct).toFixed(1)}%`,
      titleCase(quarter.top_exit_reason ?? "Not recorded"),
    ]}));
  const baselineRows = baseline.map((item) => ({
    department: item.department,
    cells: [item.school, item.department, titleCase(item.reason_category), item.exits],
  }));

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Turnover analysis"
        description="A decision-ready view of completed quarterly movement, reasons, and department patterns."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-muted-foreground">
              <Filter className="size-4" /> Filter and paginate below
            </span>
          </div>
        }
      >
        <div className="space-y-6 printable-report">
          {baseline.length ? (
            <>
              <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
                <div className="grid lg:grid-cols-[minmax(245px,0.65fr)_minmax(0,1.35fr)]">
                  <div className="bg-muted/35 p-6 lg:border-r lg:border-border/70 md:p-8">
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <TrendingUp className="size-4" /> Completed-quarter view
                    </div>
                    <p className="mt-8 text-sm text-muted-foreground">Latest turnover rate</p>
                    <p className="mt-1 text-5xl font-semibold tracking-tight tabular-nums">
                      {latest?.rate == null ? "N/A" : `${latest.rate.toFixed(1)}%`}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {latest ? `${latest.label} · ${latest.exits} exits from ${formatNumber(latest.headcount)} average employees` : "No completed quarter is available."}
                    </p>
                    <div className="mt-8 space-y-3">
                      <LegendRow label="Quarter exits" value={latest?.exits ?? 0} />
                      <LegendRow label="Average headcount" value={latest ? formatNumber(latest.headcount) : "—"} />
                      <LegendRow label="Reportable exits" value={totalExits} />
                    </div>
                    <div className={`mt-8 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${rateChange == null ? "bg-muted text-muted-foreground" : rateChange > 0 ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
                      {rateChange == null ? "Comparison unavailable" : `${Math.abs(rateChange).toFixed(1)} percentage points ${rateChange > 0 ? "higher" : "lower"} vs previous quarter`}
                    </div>
                  </div>
                  <div className="p-5 md:p-8">
                    <TurnoverAnalyticsCharts quarters={quarters} reasons={allReasons} embedded />
                  </div>
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Turnover report summary">
                <SummaryMetric label="Reportable exits" value={totalExits} note="All completed records" />
                <SummaryMetric label="Average quarterly rate" value={averageRate(quarters)} note="Completed quarters only" />
                <SummaryMetric label="Reason categories" value={reportableCategories} note="Standardised reasons" />
                <SummaryMetric label="Schools represented" value={schools} note="Across baseline records" />
              </section>

              <section className="grid gap-6 lg:grid-cols-2">
                <BarCard title="Why people leave" description="Share of all reportable exit records." entries={reasons} total={totalExits} />
                <BarCard title="Where exits are concentrated" description="Departments with the highest recorded exit volume." entries={departments} total={totalExits} />
              </section>

              <section className="rounded-2xl border border-border/70 bg-card">
                <div className="flex flex-wrap items-start justify-between gap-4 bg-muted/20 p-5 md:p-6">
                  <div>
                    <h2 className="font-semibold">Quarterly detail</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Department cohorts are privacy-suppressed by the reporting function.</p>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><BarChart3 className="size-4" /> {quarters.length} completed quarters</span>
                </div>
                <TurnoverReportControls detailRows={detailRows} baselineRows={baselineRows} />
              </section>
            </>
          ) : (
            <EmptyState label="turnover records" description="Import historical exits or complete HR exit cases to establish the turnover baseline." />
          )}

        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function LegendRow({ label, value }: { label: string; value: number | string }) {
  return <div className="flex items-center justify-between gap-4 text-sm"><span className="text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>;
}

function SummaryMetric({ label, value, note }: { label: string; value: number | string; note: string }) {
  return <div className="rounded-2xl border border-border/70 bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{note}</p></div>;
}

function BarCard({ title, description, entries, total }: { title: string; description: string; entries: Array<[string, number]>; total: number }) {
  const max = Math.max(...entries.map(([, count]) => count), 1);
  return <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p><div className="mt-6 space-y-4">{entries.length ? entries.map(([label, count]) => <div key={label}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="truncate capitalize">{titleCase(label)}</span><strong className="tabular-nums">{count} <span className="font-normal text-muted-foreground">({total ? ((count / total) * 100).toFixed(1) : "0.0"}%)</span></strong></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(count / max) * 100}%` }} /></div></div>) : <p className="text-sm text-muted-foreground">No reportable records are available.</p>}</div></section>;
}

function aggregate(entries: Array<[string, number]>) {
  const totals = new Map<string, number>();
  for (const [label, value] of entries) totals.set(label, (totals.get(label) ?? 0) + value);
  return [...totals.entries()].sort(([, first], [, second]) => second - first);
}

function quarterTrendTotals(summary: Awaited<ReturnType<typeof getQuarterlyTurnoverSummary>>) {
  const currentQuarterStart = getCurrentQuarterStart();
  const totals = new Map<string, { exits: number; headcount: number }>();
  for (const item of summary) {
    if (item.quarter_start >= currentQuarterStart) continue;
    const current = totals.get(item.quarter_start) ?? { exits: 0, headcount: 0 };
    current.exits += item.exits;
    current.headcount += item.active_headcount;
    totals.set(item.quarter_start, current);
  }
  return [...totals.entries()].sort(([first], [second]) => first.localeCompare(second)).slice(-8).map(([quarter, value]) => ({
    label: formatQuarter(quarter),
    exits: value.exits,
    headcount: value.headcount,
    rate: value.headcount > 0 ? (value.exits / value.headcount) * 100 : null,
  }));
}

function averageRate(quarters: ReturnType<typeof quarterTrendTotals>) {
  const rates = quarters.flatMap((quarter) => quarter.rate == null ? [] : [quarter.rate]);
  return rates.length ? `${(rates.reduce((total, rate) => total + rate, 0) / rates.length).toFixed(1)}%` : "N/A";
}

function formatQuarter(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getCurrentQuarterStart() {
  const now = new Date();
  const month = Math.floor(now.getUTCMonth() / 3) * 3 + 1;
  return `${now.getUTCFullYear()}-${month < 10 ? `0${month}` : month}-01`;
}
