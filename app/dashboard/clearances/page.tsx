import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { getClearanceSteps } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  const steps = await getClearanceSteps();
  const rows = steps.map((step) => {
    const request = Array.isArray(step.exit_requests)
      ? step.exit_requests[0]
      : step.exit_requests;
    const employee =
      request &&
      (Array.isArray(request.employees)
        ? request.employees[0]
        : request.employees);
    return [
      <Link
        key={step.id}
        href={`/dashboard/clearances/${step.exit_request_id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {employee?.employee_number ?? "—"} ·{" "}
        {employee?.full_name ?? "Unknown employee"}
      </Link>,
      step.department,
      <Status
        key="status"
        tone={step.status === "approved" ? "green" : "amber"}
      >
        {step.status}
      </Status>,
      step.comments ?? "Awaiting review",
      <Link
        key="review"
        href={`/dashboard/clearances/${step.exit_request_id}`}
        className="font-semibold text-primary hover:underline"
      >
        Review clearances
      </Link>,
    ];
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Digital Clearances"
        description="Coordinate department approvals across every exit request."
      >
        {steps.length ? (
          <DataTable
            columns={["Employee", "Department", "Status", "Notes", "Action"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="clearance steps" />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
