import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
} from "@/components/dashboard-shell";
import { RealtimeTurnoverRefresh } from "@/components/realtime-turnover-refresh";
import { requireDashboardCapability } from "@/lib/auth-role";
import { getQuarterlyTurnoverSummary } from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } =
    await requireDashboardCapability("viewReports");
  const summary = await getQuarterlyTurnoverSummary();

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
        title="Turnover reason analysis"
        description="Live quarterly analysis of linked historical employee exits by department and reason."
      >
        {rows.length ? (
          <DataTable
            columns={[
              "Quarter and department",
              "Exits",
              "Average employees",
              "Turnover rate",
              "Most common reason",
            ]}
            rows={rows}
          />
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
