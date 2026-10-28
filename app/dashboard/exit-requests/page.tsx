import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { getEmployees, getExitRequests } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  const [requests, employeeRows] = await Promise.all([
    getExitRequests(),
    getEmployees(),
  ]);
  const employeeOptions = employeeRows.flatMap((employee) => {
    if (!employee.id || !employee.employee_number || !employee.full_name)
      return [];
    return [
      {
        id: employee.id,
        employee_number: employee.employee_number,
        full_name: employee.full_name,
      },
    ];
  });
  const rows = requests.map((request) => {
    const employee = Array.isArray(request.employees)
      ? request.employees[0]
      : request.employees;
    return [
      <Link
        key={request.id}
        href={`/dashboard/exit-requests/${request.id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {employee?.employee_number ?? "—"} ·{" "}
        {employee?.full_name ?? "Unknown employee"}
      </Link>,
      request.reason ?? "Voluntary separation",
      <Status
        key="status"
        tone={request.status === "completed" ? "green" : "amber"}
      >
        {request.status}
      </Status>,
      request.last_day ?? "—",
      <Link
        key="review"
        href={`/dashboard/exit-requests/${request.id}`}
        className="font-semibold text-primary hover:underline"
      >
        Review request
      </Link>,
    ];
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Exit Requests"
        description="Review employee transitions, deadlines, and approval status."
        action={<OperationsPanel mode="exit" employees={employeeOptions} />}
      >
        {requests.length ? (
          <DataTable
            columns={["Employee", "Reason", "Status", "Last day", "Action"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="exit requests" />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
