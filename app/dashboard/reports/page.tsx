import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  getAuditEvents,
  getLeaveProcessingTargetMetrics,
  getQuarterlyTurnoverSummary,
  getReportDashboardSnapshot,
} from "@/lib/supabase/data";
import { redirect } from "next/navigation";

const reportCatalog = [
  {
    key: "workforce",
    label: "Workforce continuity",
    description: "Current workforce and turnover overview",
  },
  {
    key: "exit-readiness",
    label: "Exit readiness",
    description: "Open exits, clearance backlog, and finalization risk",
  },
  {
    key: "knowledge",
    label: "Knowledge retention",
    description: "Document coverage and compliance risk",
  },
  {
    key: "assets",
    label: "Asset recovery",
    description: "Assigned and recovered asset status",
  },
  {
    key: "quarterly-attrition",
    label: "Quarterly attrition",
    description:
      "Automatically grouped exits, current headcount, and quarterly rate by department",
  },
  {
    key: "leave-turnaround",
    label: "Leave turnaround",
    description:
      "Pending volume, approvals, and measured application review time",
  },
] as const;

function buildCsvHref(rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "").replace(/\r?\n/g, " ");
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{
    report?: string;
    format?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const reportKey = reportCatalog.some((report) => report.key === params.report)
    ? params.report
    : "workforce";
  const exportFormat = params.format === "csv" ? "csv" : "preview";

  const { user, userName, userRole } = await resolveDashboardUserContext();
  if (!user) redirect("/auth/login");
  if (
    !["hr", "administrator", "management"].some((role) =>
      userRole.toLowerCase().includes(role),
    )
  ) {
    redirect("/dashboard");
  }
  const [snapshot, quarterlyTurnover, auditEvents, leaveMetrics] =
    await Promise.all([
      getReportDashboardSnapshot(),
      getQuarterlyTurnoverSummary(),
      getAuditEvents(5),
      getLeaveProcessingTargetMetrics(),
    ]);

  const selectedReport =
    reportCatalog.find((report) => report.key === reportKey) ??
    reportCatalog[0];

  const reportRows = (() => {
    switch (reportKey) {
      case "exit-readiness":
        return [
          ["Open exits", snapshot.openExitRequests],
          ["Completed exits", snapshot.completedExits],
          ["Pending clearances", snapshot.pendingClearanceSteps],
          ["Approved clearances", snapshot.approvedClearanceSteps],
          ["Attrition rate", `${snapshot.currentYearAttritionRate}%`],
        ];
      case "knowledge":
        return [
          ["Knowledge requirements", snapshot.knowledgeRequirements.length],
          [
            "Verified documents",
            snapshot.knowledgeDocuments.filter((document) =>
              ["verified", "approved"].includes(
                String(document.status ?? "").toLowerCase(),
              ),
            ).length,
          ],
          ["Coverage rate", `${snapshot.knowledgeCoverage}%`],
          [
            "Open documents",
            snapshot.knowledgeDocuments.filter((document) =>
              ["pending", "submitted"].includes(
                String(document.status ?? "").toLowerCase(),
              ),
            ).length,
          ],
        ];
      case "assets":
        return [
          ["Assigned assets", snapshot.assets.length],
          ["Recovered assets", snapshot.assetRecoveryCount],
          ["Recovery rate", `${snapshot.assetRecoveryRate}%`],
          [
            "Outstanding items",
            snapshot.assets.filter(
              (asset) =>
                String(asset.status ?? "").toLowerCase() !== "verified",
            ).length,
          ],
        ];
      case "quarterly-attrition":
        return quarterlyTurnover.map((quarter) => [
          `${new Date(`${quarter.quarter_start}T12:00:00`).toLocaleDateString("en", { month: "short", year: "numeric" })} · ${quarter.department}`,
          `${quarter.exits} exits / ${quarter.active_headcount} average staff · ${quarter.attrition_rate_pct ?? "N/A"}% · driver: ${quarter.top_exit_reason ?? "Not recorded"}${quarter.generated_at ? ` · snapshot ${new Date(quarter.generated_at).toLocaleDateString()}` : " · live"}`,
        ]);
      case "leave-turnaround": {
        return [
          ["Baseline average review time", leaveMetrics.baseline_days == null ? "Set in Settings" : `${leaveMetrics.baseline_days.toFixed(1)} days`],
          ["Average review time · rolling six months", leaveMetrics.current_average_days == null ? "No reviewed requests in period" : `${leaveMetrics.current_average_days.toFixed(1)} days`],
          ["Reduction against baseline", leaveMetrics.reduction_percent == null ? "Baseline required" : `${leaveMetrics.reduction_percent.toFixed(1)}%`],
          ["Target", "35% reduction within six months of deployment"],
          ["Reviewed requests in period", leaveMetrics.reviewed_request_count],
          ["Pending requests", leaveMetrics.pending_request_count],
          ["Measurement period", leaveMetrics.measurement_start && leaveMetrics.measurement_end ? `${leaveMetrics.measurement_start} to ${leaveMetrics.measurement_end}` : "Unavailable"],
        ];
      }
      case "workforce":
      default:
        return [
          ["Active employees", snapshot.activeEmployees],
          ["Exiting employees", snapshot.exitingEmployees],
          ["Open exit requests", snapshot.openExitRequests],
          ["Total employees", snapshot.totalEmployees],
          ["Attrition rate", `${snapshot.currentYearAttritionRate}%`],
        ];
    }
  })();

  const csvHref = buildCsvHref([["Metric", "Value"], ...reportRows]);

  const reportHistoryRows = auditEvents.length
    ? auditEvents.map((event) => [
        event.entity_type,
        event.action,
        event.created_at
          ? new Date(event.created_at).toLocaleDateString()
          : "N/A",
      ])
    : [];

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Reports"
        description="Generate, review, and export institutional continuity insights from the live workspace data."
        action={
          <form method="GET" className="flex flex-wrap items-center gap-2">
            <select
              name="report"
              defaultValue={reportKey}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              {reportCatalog.map((report) => (
                <option key={report.key} value={report.key}>
                  {report.label}
                </option>
              ))}
            </select>
            <select
              name="format"
              defaultValue={exportFormat}
              className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="preview">Preview</option>
              <option value="csv">CSV</option>
            </select>
            <button
              type="submit"
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Generate report
            </button>
          </form>
        }
      >
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Employees",
                value: snapshot.totalEmployees,
                tone: "blue",
              },
              {
                label: "Open exits",
                value: snapshot.openExitRequests,
                tone: "amber",
              },
              {
                label: "Pending clearances",
                value: snapshot.pendingClearanceSteps,
                tone: "violet",
              },
              {
                label: "Recovery rate",
                value: `${snapshot.assetRecoveryRate}%`,
                tone: "emerald",
              },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-2xl border border-border/70 bg-card p-4"
              >
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-2xl font-semibold">{metric.value}</p>
                  <Status tone={metric.tone}>{metric.label}</Status>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Active report
                </p>
                <p className="mt-2 text-2xl font-semibold">
                  {selectedReport.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedReport.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Status tone="blue">Live snapshot</Status>
                {exportFormat === "csv" && (
                  <a
                    href={csvHref}
                    download={`${reportKey}-report.csv`}
                    className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
                  >
                    Download CSV
                  </a>
                )}
              </div>
            </div>
            <div className="mt-5">
              <DataTable
                columns={["Metric", "Value"]}
                rows={reportRows.map((row) => [String(row[0]), String(row[1])])}
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm font-semibold text-foreground">
                Data quality summary
              </p>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-3">
                  <span>Employee coverage</span>
                  <strong className="text-foreground">
                    {snapshot.totalEmployees ? "100%" : "0%"}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-3">
                  <span>Knowledge coverage</span>
                  <strong className="text-foreground">
                    {snapshot.knowledgeCoverage}%
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/30 p-3">
                  <span>Asset recovery</span>
                  <strong className="text-foreground">
                    {snapshot.assetRecoveryRate}%
                  </strong>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm font-semibold text-foreground">
                Recent report activity
              </p>
              {reportHistoryRows.length ? (
                <div className="mt-4">
                  <DataTable
                    columns={["Entity", "Action", "Date"]}
                    rows={reportHistoryRows}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="report history"
                    description="No report snapshots have been generated yet. Use the controls above to create one from the live workspace data."
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
