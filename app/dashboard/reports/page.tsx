import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
} from "@/components/dashboard-shell";
import { Activity, BarChart3, CircleAlert, UsersRound } from "lucide-react";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { requireDashboardCapability } from "@/lib/auth-role";
import { getQuarterlyTurnoverSummary } from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("viewReports");
  const summary = await getQuarterlyTurnoverSummary();
  const totalExits = summary.reduce((total, item) => total + item.exits, 0);
  const averageTurnover =
    summary.filter((item) => item.attrition_rate_pct != null).length > 0
      ? summary
          .filter((item) => item.attrition_rate_pct != null)
          .reduce((total, item) => total + (item.attrition_rate_pct ?? 0), 0) /
        summary.filter((item) => item.attrition_rate_pct != null).length
      : null;
  const reasonCounts = Object.entries(
    summary.reduce<Record<string, number>>((counts, item) => {
      const reason = item.top_exit_reason ?? "Not recorded";
      counts[reason] = (counts[reason] ?? 0) + item.exits;
      return counts;
    }, {}),
  )
    .sort(([, first], [, second]) => second - first)
    .slice(0, 6);
  const departmentCounts = Object.entries(
    summary.reduce<Record<string, number>>((counts, item) => {
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
  const maxQuarterExits = Math.max(...quarters.map((item) => item.exits), 1);

  const rows = summary.map((quarter) => [
    `${new Date(`${quarter.quarter_start}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })} · ${quarter.department}`,
    quarter.exits,
    quarter.active_headcount,
    quarter.attrition_rate_pct == null
      ? "N/A"
      : `${quarter.attrition_rate_pct}%`,
    quarter.top_exit_reason ?? "Not recorded",
  ]);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <RealtimeTurnoverRefresh />
      <PageFrame
        title="Turnover trend tracking system"
        description="Live quarterly analysis of linked historical employee exits by department and reason."
      >
        {rows.length ? (
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-primary to-primary/80 p-6 text-white shadow-lg md:p-8">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                    Workforce intelligence
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
                    Understand the reasons behind turnover.
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                    Compare linked historical exits across quarters and departments to identify the strongest turnover drivers.
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-medium text-white/90">
                  <span className="size-2 rounded-full bg-emerald-400" />
                  Live analysis
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Metric label="Recorded exits" value={totalExits} icon={UsersRound} tone="blue" />
              <Metric
                label="Average turnover rate"
                value={averageTurnover == null ? "N/A" : `${averageTurnover.toFixed(1)}%`}
                icon={Activity}
                tone="amber"
              />
              <Metric
                label="Reasons identified"
                value={reasonCounts.filter(([reason]) => reason !== "Not recorded").length}
                icon={CircleAlert}
                tone="violet"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <BarCard
                title="Why employees leave"
                description="Exit reasons across the available analysis periods."
                entries={reasonCounts}
                max={maxReasonCount}
                color="bg-primary"
              />
              <BarCard
                title="Exits by department"
                description="Departments with the highest recorded turnover."
                entries={departmentCounts}
                max={maxDepartmentCount}
                color="bg-amber-400"
              />
            </div>

            <section className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="mb-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <BarChart3 className="size-5" />
                  </span>
                  <div>
                    <h2 className="font-semibold">Turnover trend by quarter</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Each bar represents the total number of linked exits recorded in that quarter.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex min-h-52 items-end gap-3 overflow-x-auto border-b border-border/70 px-2 pt-6">
                {quarters.map((item) => (
                  <div key={item.quarter} className="flex min-w-16 flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-semibold">{item.exits}</span>
                    <div
                      className="w-full max-w-12 rounded-t-lg bg-primary/80 transition-all"
                      style={{ height: `${Math.max((item.exits / maxQuarterExits) * 150, 8)}px` }}
                      title={`${item.exits} exits`}
                    />
                    <span className="text-center text-[11px] text-muted-foreground">{item.quarter}</span>
                  </div>
                ))}
              </div>
            </section>

            <DataTable
              columns={["Quarter and department", "Exits", "Average employees", "Turnover rate", "Most common reason"]}
              rows={rows}
            />
          </div>
        ) : (
          <EmptyState
            label="turnover analysis"
            description="Complete linked exit cases to begin analysing turnover reasons."
          />
        )}
      </PageFrame>
    </DashboardShell>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof UsersRound;
  tone: "blue" | "amber" | "violet";
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className={`flex size-9 items-center justify-center rounded-xl ${tone === "blue" ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" : tone === "amber" ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" : "bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300"}`}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function BarCard({
  title,
  description,
  entries,
  max,
  color,
}: {
  title: string;
  description: string;
  entries: Array<[string, number]>;
  max: number;
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
              <strong>{count}</strong>
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
