import { DashboardShell, PageFrame, Status } from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  getEmployees,
  getLeaveBalances,
  getLeaveRequests,
} from "@/lib/supabase/data";
import {
  reviewLeaveRequest,
  setLeaveBalance,
  submitLeaveRequest,
} from "@/lib/supabase/actions";
import { createClient } from "@/lib/supabase/server";

function employeeFromRequest(
  employee:
    | { full_name?: string | null; employee_number?: string | null }
    | Array<{ full_name?: string | null; employee_number?: string | null }>
    | null
    | undefined,
) {
  return Array.isArray(employee) ? employee[0] : employee;
}

export default async function Page() {
  const { user, userName, userRole } = await resolveDashboardUserContext();
  const [allRequests, allBalances, employees] = await Promise.all([
    getLeaveRequests(),
    getLeaveBalances(),
    getEmployees(),
  ]);
  const isReviewer = ["hr", "administrator"].some((role) =>
    userRole.toLowerCase().includes(role),
  );
  const supabase = await createClient();
  const { data: authUser } = await supabase.auth.getUser();
  const email = authUser.user?.email?.toLowerCase();
  const ownEmployee = employees.find(
    (employee) => employee.email?.toLowerCase() === email,
  );
  const requests = isReviewer
    ? allRequests
    : allRequests.filter((request) => request.employee_id === ownEmployee?.id);
  const balances = isReviewer
    ? allBalances
    : allBalances.filter((balance) => balance.employee_id === ownEmployee?.id);
  const currentYear = new Date().getFullYear();
  const currentYearRequests = requests.filter(
    (request) => new Date(`${request.starts_on}T12:00:00`).getFullYear() === currentYear,
  );
  const currentYearBalances = balances.filter(
    (balance) => balance.leave_year === currentYear,
  );
  const employeesById = new Map(
    employees.filter((employee) => employee.id).map((employee) => [employee.id!, employee]),
  );

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Leave management"
        description="Apply for leave, review request status, and track configured annual balances."
      >
        <div className="space-y-6">
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Annual leave balance · {currentYear}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Balances are configured by HR; approved requests are deducted from the available amount.
              </p>
              <div className="mt-4 space-y-3">
                {currentYearBalances.length ? (
                  currentYearBalances.map((balance) => {
                    const employee = employeesById.get(balance.employee_id);
                    const used = currentYearRequests
                      .filter(
                        (request) =>
                          request.employee_id === balance.employee_id &&
                          request.leave_type === balance.leave_type &&
                          request.status === "approved",
                      )
                      .reduce((sum, request) => sum + Number(request.requested_days), 0);
                    const remaining = Number(balance.entitled_days) +
                      Number(balance.carried_over_days) - used;
                    return (
                      <div key={balance.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div>
                          <p className="text-sm font-semibold">{balance.leave_type}</p>
                          {isReviewer && (
                            <p className="text-xs text-muted-foreground">
                              {employee?.full_name ?? "Employee"}
                            </p>
                          )}
                        </div>
                        <p className="text-right text-sm">
                          <span className="font-semibold">{remaining.toFixed(1)} days left</span>
                          <span className="block text-xs text-muted-foreground">
                            {used.toFixed(1)} used / {(Number(balance.entitled_days) + Number(balance.carried_over_days)).toFixed(1)} days
                          </span>
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {isReviewer
                      ? "No leave balances have been configured for this year."
                      : "HR has not configured your leave balance for this year yet."}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Apply for leave</h2>
              {ownEmployee ? (
                <form action={submitLeaveRequest} className="mt-4 space-y-3">
                  <label className="block text-sm font-medium">
                    Leave type
                    <select name="leave_type" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal">
                      <option value="">Choose a type</option>
                      <option>Annual</option>
                      <option>Sick</option>
                      <option>Special</option>
                      <option>Study</option>
                      <option>Other</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium">
                      Start date
                      <input name="starts_on" type="date" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                    </label>
                    <label className="block text-sm font-medium">
                      End date
                      <input name="ends_on" type="date" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                    </label>
                  </div>
                  <label className="block text-sm font-medium">
                    Reason (optional)
                    <textarea name="reason" rows={3} className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 font-normal" />
                  </label>
                  <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                    Submit request
                  </button>
                </form>
              ) : (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Your account is not linked to an employee record. Contact HR to complete your profile before applying.
                </p>
              )}
            </div>
          </section>

          {isReviewer && (
            <section className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Configure an annual balance</h2>
              <form action={setLeaveBalance} className="mt-4 grid gap-3 md:grid-cols-5">
                <label className="text-sm font-medium">
                  Employee
                  <select name="employee_id" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal">
                    <option value="">Choose employee</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.employee_number} · {employee.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Leave type
                  <input name="leave_type" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Annual entitlement (days)
                  <input name="entitled_days" type="number" min="0" step="0.5" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                </label>
                <label className="text-sm font-medium">
                  Carry-over (days)
                  <input name="carried_over_days" type="number" min="0" step="0.5" defaultValue="0" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                </label>
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-sm font-medium">
                    Year
                    <input name="leave_year" type="number" min="2000" max="2200" defaultValue={currentYear} required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                  </label>
                  <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                    Save
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Leave requests</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Weekdays are counted as leave days; weekends are excluded.
              </p>
            </div>
            {requests.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Employee", "Leave", "Dates", "Days", "Status", "Review"].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {requests.map((request) => {
                      const employee = employeeFromRequest(request.employees);
                      return (
                        <tr key={request.id}>
                          <td className="px-4 py-3 font-medium">
                            {isReviewer ? employee?.full_name ?? "Employee" : "My request"}
                          </td>
                          <td className="px-4 py-3">{request.leave_type}</td>
                          <td className="px-4 py-3">{request.starts_on} – {request.ends_on}</td>
                          <td className="px-4 py-3">{Number(request.requested_days).toFixed(1)}</td>
                          <td className="px-4 py-3">
                            <Status tone={request.status === "approved" ? "green" : request.status === "rejected" ? "red" : "amber"}>
                              {request.status}
                            </Status>
                          </td>
                          <td className="px-4 py-3">
                            {isReviewer && request.status === "pending" ? (
                              <div className="flex gap-2">
                                {(["approved", "rejected"] as const).map((decision) => (
                                  <form key={decision} action={reviewLeaveRequest}>
                                    <input type="hidden" name="request_id" value={request.id} />
                                    <input type="hidden" name="decision" value={decision} />
                                    <button className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold capitalize hover:bg-muted">
                                      {decision}
                                    </button>
                                  </form>
                                ))}
                              </div>
                            ) : (
                              request.review_notes ?? "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No leave requests are available.</p>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
