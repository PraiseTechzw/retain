import {
  DashboardShell,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import Link from "next/link";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { approveClearance } from "@/lib/supabase/actions";

type ClearanceStep = {
  id: string;
  department: string;
  status: string;
  comments?: string;
  approved_by?: string;
  approved_at?: string;
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userName, userRole } = await resolveDashboardUserContext();
  const { id } = await params;
  const supabase = await createClient();

  // Treat route id as exit_request id and load steps
  const { data: steps } = await supabase
    .from("clearance_steps")
    .select("id,department,status,comments,approved_by,approved_at")
    .eq("exit_request_id", id)
    .order("step_order", { ascending: true });
  const { data: request } = await supabase
    .from("exit_requests")
    .select("id, status, last_day, employees!employee_id(full_name, employee_number)")
    .eq("id", id)
    .maybeSingle();
  const employee = Array.isArray(request?.employees)
    ? request.employees[0]
    : request?.employees;
  const role = userRole.trim().toLowerCase();

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Exit clearance approvals"
        description={`${employee?.employee_number ?? "Employee"} · ${employee?.full_name ?? "Exit request"} · Review each department step below.`}
      >
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="font-semibold">Department clearances</h2>
          {request && (
            <p className="mt-1 text-sm text-muted-foreground">
              Request status: {request.status} · Last working day: {request.last_day ?? "Not set"}
            </p>
          )}
          {request && (
            <Link
              href={`/dashboard/exit-requests/${id}`}
              className="mt-3 inline-flex text-sm font-semibold text-primary hover:underline"
            >
              View full exit request and blockers
            </Link>
          )}
          <div className="mt-6 flex flex-col gap-3">
            {(steps ?? []).map((s: ClearanceStep) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="text-sm font-medium">{s.department}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.comments ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Status
                    tone={
                      s.status === "approved"
                        ? "green"
                        : s.status === "rejected"
                          ? "red"
                          : "amber"
                    }
                  >
                    {s.status}
                  </Status>
                  {s.status !== "approved" && canApprove(role, s.department) && (
                    <form action={approveClearance}>
                      <input type="hidden" name="clearance_id" value={s.id} />
                      <button className="btn" type="submit">Approve {s.department}</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
            {!steps?.length && (
              <EmptyState label="department clearance steps" />
            )}
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function canApprove(role: string, department: string) {
  const normalizedDepartment = department.toLowerCase();
  if (role === "hr" || role === "administrator") return true;
  if (role === "management") return normalizedDepartment.includes("department head");
  if (role === "ict") {
    return normalizedDepartment.includes("ict") || normalizedDepartment.includes("information and communication technology");
  }
  if (role === "library") return normalizedDepartment.includes("librar");
  return false;
}
