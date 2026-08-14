import {
  DashboardShell,
  PageFrame,
  DataTable,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Asset Return Verification"
        description="Verify returned equipment before closing an employee transition."
      >
        <DataTable
          columns={["Asset", "Employee", "Condition", "Action"]}
          rows={[
            [
              "AST-1042 · MacBook Pro",
              "Sarah Ndlovu",
              "Awaiting inspection",
              <Status key="a" tone="amber">
                Review
              </Status>,
            ] as unknown as string[],
            [
              "AST-1201 · Access card",
              "Lerato Mokoena",
              "Verified",
              <Status key="b" tone="green">
                Complete
              </Status>,
            ] as unknown as string[],
          ]}
        />
      </PageFrame>
    </DashboardShell>
  );
}
