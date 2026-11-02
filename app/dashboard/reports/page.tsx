import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
} from "@/components/dashboard-shell";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { PrintReportButton } from "@/components/report-actions";
import { TurnoverAnalyticsCharts } from "@/components/turnover-analytics-charts";
import { requireDashboardCapability } from "@/lib/auth-role";
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
  const totalExits = baseline.reduce((total, item) => total + item.exits, 0);
  const quarterRateTotals = new Map<string, { exits: number; headcount: number }>();
  for (const item of summary) {
    const totals = quarterRateTotals.get(item.quarter_start) ?? { exits: 0, headcount: 0 };
    totals.exits += item.exits;
    totals.headcount += item.active_headcount;
    quarterRateTotals.set(item.quarter_start, totals);
  }
  const quarterRates = [...quarterRateTotals.values()]
    .filter((totals) => totals.headcount > 0)
    .map((totals) => (totals.exits / totals.headcount) * 100);
  const averageTurnover = quarterRates.length
    ? quarterRates.reduce((total, rate) => total + rate, 0) / quarterRates.length
    : null;
  const allReasonCounts = Object.entries(
    baseline.reduce<Record<string, number>>((counts, item) => {
      counts[item.reason_category] = (counts[item.reason_category] ?? 0) + item.exits;
      return counts;
    }, {}),
  )
    .sort(([, first], [, second]) => second - first);
  const reasonCounts = allReasonCounts.slice(0, 6);
  const departmentCounts = Object.entries(
    baseline.reduce<Record<string, number>>((counts, item) => {
      counts[item.department] = (counts[item.department] ?? 0) + item.exits;
      return counts;
    }, {}),
  )
    .sort(([, first], [, second]) => second - first)
    .slice(0, 6);
  const maxReasonCount = Math.max(...reasonCounts.map(([, count]) => count), 1);
  const maxDepartmentCount = Math.max(
    ...departmentCounts.map(([, count]) => count),
    1,
  );
  const quarters = quarterTotals(summary);
  const quarterTrend = quarterTrendTotals(summary);
  const maxQuarterExits = Math.max(...quarters.map((item) => item.exits), 1);
  const reportableExitTotal = baseline.reduce((total, item) => total + item.exits, 0);
  const quarterlySummaryRows = quarterTrend.map((quarter) => [
    quarter.label,
    quarter.exits,
    quarter.headcount.toFixed(1),
    quarter.rate == null ? "N/A" : `${quarter.rate.toFixed(1)}%`,
  ]);

  const rows = summary.map((quarter) => [
    `${new Date(`${quarter.quarter_start}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })} · ${quarter.department}`,
    quarter.exits,
    quarter.active_headcount,
    quarter.attrition_rate_pct == null
      ? "N/A"
      : `${quarter.attrition_rate_pct}%`,
    quarter.top_exit_reason ?? "Not recorded",
  ]);
  const baselineRows = baseline.map((item) => [
    item.school,
    item.department,
    item.reason_category.replaceAll("_", " "),
    item.exits,
  ]);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Turnover trend tracking system"
        description="Quarterly turnover trends from historical exits, with small groups suppressed in every report and export."
        action={
          <div className="flex flex-wrap items-end gap-2">
            {(userRole === "HR" || userRole === "Administrator") && (
              <form action="/api/reports/turnover" method="get" className="flex flex-wrap items-end gap-2">
                <label className="text-xs font-medium">
                  From
                  <input name="from" type="date" className="mt-1 h-10 rounded-lg border border-input bg-card px-2 text-sm" />
                </label>
                <label className="text-xs font-medium">
                  To
                  <input name="to" type="date" className="mt-1 h-10 rounded-lg border border-input bg-card px-2 text-sm" />
                </label>
                <label className="text-xs font-medium">
                  Department
                  <input name="department" maxLength={100} className="mt-1 h-10 w-40 rounded-lg border border-input bg-card px-2 text-sm" />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                >
                  Export CSV
                </button>
                <p className="basis-full text-xs text-muted-foreground">
                  Exports contain department-quarter aggregates only; date filters include any overlapping quarter.
                </p>
              </form>
            )}
            <PrintReportButton />
          </div>
        }
      >
        <div className="printable-report">
          {baseline.length ? (
            <div className="grid gap-6">
              <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
                <h2 className="text-lg font-semibold">All-recorded-exit baseline</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Includes imported historical exits and completed HR exit cases. Only standardised reason groups with at least five exits are shown; smaller groups are withheld.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Reportable exit records" value={totalExits} />
                  <Metric
                    label="Average quarterly rate, last 8 quarters"
                    value={averageTurnover == null ? "N/A" : `${averageTurnover.toFixed(1)}%`}
                  />
                  <Metric
                    label="Reason categories recorded"
                    value={reasonCounts.filter(([reason]) => reason !== "Not recorded").length}
                  />
                  <Metric
                    label="Schools represented"
                    value={new Set(baseline.map((item) => item.school).filter((school) => school !== "Not recorded")).size}
                  />
                </div>
              </section>

              <div className="grid items-start gap-6 lg:grid-cols-2">
                <BarCard
                  title="Reasons across all recorded exits"
                  description="Standardised categories with fewer than five exits are withheld."
                  entries={reasonCounts}
                  max={maxReasonCount}
                  total={reportableExitTotal}
                  color="bg-primary"
                />
                <BarCard
                  title="Exits by department"
                  description="Aggregated counts from reportable reason groups only."
                  entries={departmentCounts}
                  max={maxDepartmentCount}
                  total={reportableExitTotal}
                  color="bg-primary"
                />
              </div>

              <TurnoverAnalyticsCharts quarters={quarterTrend} reasons={reasonCounts} />

              <section className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="mb-4">
                  <h2 className="font-semibold">Institution-wide quarterly summary</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Exits divided by average opening and closing headcount for each quarter. Percentages are calculated from the displayed totals.
                  </p>
                </div>
                <DataTable
                  columns={["Quarter", "Exits", "Average headcount", "Turnover rate"]}
                  rows={quarterlySummaryRows}
                />
              </section>

              <section className="rounded-2xl border border-border/70 bg-card p-5">
                <div className="mb-4">
                  <h2 className="font-semibold">Quarterly turnover trend</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Quarterly department groups with fewer than five staff or one to four exits are withheld. Date-filtered exports include every quarter overlapping the selected dates.
                  </p>
                </div>
                {quarters.length ? (
                  <div className="flex min-h-52 items-end gap-3 overflow-x-auto border-b border-border/70 px-2 pt-6">
                    {quarters.map((item) => (
                      <div key={item.quarter} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                        <span className="text-xs font-semibold tabular-nums">{item.exits}</span>
                        <div
                          className="w-full max-w-12 rounded-t bg-primary"
                          style={{ height: `${Math.max((item.exits / maxQuarterExits) * 150, 8)}px` }}
                          title={`${item.exits} exits`}
                        />
                        <span className="text-center text-[11px] text-muted-foreground">{item.quarter}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-sm text-muted-foreground">No quarterly records are available in this period.</p>
                )}
              </section>

              {rows.length > 0 && (
                <DataTable
                  columns={["Quarter and department", "Exits", "Average employees", "Turnover rate", "Most common reason"]}
                  rows={rows}
                />
              )}
              <DataTable
                columns={["School", "Department", "Reason", "All-time exits"]}
                rows={baselineRows}
              />
            </div>
          ) : (
            <EmptyState
              label="turnover records"
              description="Import historical exits or complete HR exit cases to establish the turnover baseline."
            />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-l border-border/70 pl-4 first:border-0 first:pl-0">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-medium tabular-nums">{value}</p>
    </div>
  );
}

function BarCard({
  title,
  description,
  entries,
  max,
  total,
  color,
}: {
  title: string;
  description: string;
  entries: Array<[string, number]>;
  max: number;
  total: number;
  color: string;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 space-y-4">
        {entries.map(([label, count]) => (
          <div key={label}>
            <div className="mb-1 flex justify-between gap-3 text-sm">
              <span className="truncate capitalize">{label.replaceAll("_", " ")}</span>
              <strong className="tabular-nums">{count} <span className="font-normal text-muted-foreground">({total ? ((count / total) * 100).toFixed(1) : "0.0"}%)</span></strong>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${color}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function quarterTotals(summary: Awaited<ReturnType<typeof getQuarterlyTurnoverSummary>>) {
  const totals = new Map<string, number>();
  for (const item of summary) {
    const quarter = new Date(`${item.quarter_start}T12:00:00`).toLocaleDateString("en", {
      month: "short",
      year: "numeric",
    });
    totals.set(quarter, (totals.get(quarter) ?? 0) + item.exits);
  }

  return [...totals.entries()]
    .map(([quarter, exits]) => ({ quarter, exits }))
    .reverse()
    .slice(-8);
}

function quarterTrendTotals(summary: Awaited<ReturnType<typeof getQuarterlyTurnoverSummary>>) {
  const totals = new Map<string, { exits: number; headcount: number }>();
  for (const item of summary) {
    const current = totals.get(item.quarter_start) ?? { exits: 0, headcount: 0 };
    current.exits += item.exits;
    current.headcount += item.active_headcount;
    totals.set(item.quarter_start, current);
  }
  return [...totals.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-8)
    .map(([quarter, value]) => ({
      label: new Date(`${quarter}T12:00:00`).toLocaleDateString("en", { month: "short", year: "2-digit" }),
      exits: value.exits,
      headcount: value.headcount,
      rate: value.headcount > 0 ? (value.exits / value.headcount) * 100 : null,
    }));
}
