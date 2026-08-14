import {
  DashboardShell,
  PageFrame,
  DataTable,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Reports"
        description="Generate, review, and export institutional continuity reports."
        action={
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Generate report
          </button>
        }
      >
        <DataTable
          columns={["Report", "Period", "Created", "Format"]}
          rows={[
            ["Quarterly retention summary", "Q3 2024", "24 Sep 2024", "PDF"],
            ["Exit clearance audit", "September 2024", "20 Sep 2024", "CSV"],
          ]}
        />
      </PageFrame>
    </DashboardShell>
  );
}
