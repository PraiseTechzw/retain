import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { updateEmployeeRiskProfile } from "@/lib/supabase/actions";
import { EmployeeRecordForm } from "@/components/employee-record-form";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, userName, userRole } = await resolveDashboardUserContext();
  const canManageEmployee = ["hr", "administrator"].some((role) =>
    userRole.toLowerCase().includes(role),
  );
  const { id } = await params;
  const supabase = await createClient();

  const lookupValue = decodeURIComponent(id);
  const { data: employee, error } = await supabase
    .from("employees")
    .select(
      "id, user_id, employee_number, full_name, email, phone, job_title, employment_status, employment_category, joined_on, exit_date, home_area, commute_distance_km, is_technical, department_id, departments(name)",
    )
    .or(
      `id.eq.${lookupValue},employee_number.eq.${lookupValue},email.eq.${lookupValue}`,
    )
    .maybeSingle();

  const { data: profileFallback } = await supabase
    .from("profiles")
    .select("id, full_name, role, department_id")
    .eq("id", lookupValue)
    .maybeSingle();

  const fallbackEmployee =
    employee ??
    (profileFallback
      ? {
          id: profileFallback.id,
          user_id: profileFallback.id,
          employee_number: "Profile only",
          full_name: profileFallback.full_name ?? "Profile user",
          email: null,
          job_title: "Profile-only account",
          employment_status: "active",
          employment_category: null,
          joined_on: null,
          exit_date: null,
          home_area: null,
          commute_distance_km: null,
          is_technical: false,
          department_id: profileFallback.department_id,
          departments: null,
        }
      : null);
  const hasStaffDirectoryAccess = ["hr", "administrator", "management"].some(
    (role) => userRole.toLowerCase().includes(role),
  );
  const isOwnEmployeeRecord =
    fallbackEmployee?.id === user?.id ||
    fallbackEmployee?.user_id === user?.id ||
    (!!fallbackEmployee?.email &&
      fallbackEmployee.email.toLowerCase() === user?.email?.toLowerCase());
  if (fallbackEmployee && !hasStaffDirectoryAccess && !isOwnEmployeeRecord) {
    redirect("/dashboard");
  }

  let departmentOptions: { id: string; name: string }[] = [];
  if (canManageEmployee && employee) {
    const { data: departments } = await supabase
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });
    departmentOptions = departments ?? [];
  }

  const departmentName =
    typeof fallbackEmployee?.departments === "object" &&
    fallbackEmployee.departments
      ? (fallbackEmployee.departments as { name?: string | null }).name
      : null;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Employee profile"
        description={
          error || !fallbackEmployee
            ? "Employee record could not be located."
            : `${fallbackEmployee.full_name ?? "Employee"} · ${fallbackEmployee.employee_number ?? "No number"}`
        }
      >
        {!fallbackEmployee ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <h2 className="text-xl font-semibold">Employee not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The employee record for this profile does not exist or is no
              longer available.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {fallbackEmployee.full_name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fallbackEmployee.job_title || "No job title"} ·{" "}
                    {departmentName || "No department"} ·{" "}
                    {fallbackEmployee.employee_number || "No employee number"}
                  </p>
                </div>
                <Status
                  tone={
                    fallbackEmployee.employment_status === "active"
                      ? "green"
                      : "blue"
                  }
                >
                  {fallbackEmployee.employment_status || "Unknown"}
                </Status>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Email
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {fallbackEmployee.email || "Not available"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Department
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {departmentName || "No department"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Employment type
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {fallbackEmployee.employment_category || "Not specified"}
                  </p>
                </div>
              </div>
            </div>
            {canManageEmployee && employee && (
              <EmployeeRecordForm
                employee={{
                  id: employee.id,
                  employee_number: employee.employee_number,
                  full_name: employee.full_name,
                  email: employee.email,
                  phone: employee.phone,
                  job_title: employee.job_title,
                  employment_category: employee.employment_category,
                  joined_on: employee.joined_on,
                  department_id: employee.department_id,
                }}
                departments={departmentOptions}
              />
            )}
            {canManageEmployee && fallbackEmployee.id && (
              <section className="rounded-2xl border border-border/70 bg-card p-6">
                <h2 className="text-lg font-semibold">Commute details for risk review</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional HR-maintained indicators. Access is restricted to HR and administrators.
                </p>
                <form action={updateEmployeeRiskProfile} className="mt-4 grid gap-3 md:grid-cols-3">
                  <input type="hidden" name="employee_id" value={fallbackEmployee.id} />
                  <label className="text-sm font-medium">
                    Home area (town/suburb only)
                    <input name="home_area" maxLength={80} placeholder="Do not enter a street address" defaultValue={fallbackEmployee.home_area ?? ""} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                  </label>
                  <label className="text-sm font-medium">
                    One-way commute (km)
                    <input name="commute_distance_km" type="number" min="0" step="any" defaultValue={fallbackEmployee.commute_distance_km ?? ""} className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input name="is_technical" type="checkbox" defaultChecked={fallbackEmployee.is_technical ?? false} className="size-4 accent-primary" />
                    Technical staff
                  </label>
                  <div className="flex items-end">
                    <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                      Save commute details
                    </button>
                  </div>
                </form>
              </section>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-card p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Profile details
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
                    <dt className="text-muted-foreground">Employee number</dt>
                    <dd className="font-medium">
                      {fallbackEmployee.employee_number || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
                    <dt className="text-muted-foreground">Job title</dt>
                    <dd className="font-medium">
                      {fallbackEmployee.job_title || "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/70 pb-2">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="font-medium">
                      {fallbackEmployee.joined_on
                        ? new Date(
                            fallbackEmployee.joined_on,
                          ).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Exit date</dt>
                    <dd className="font-medium">
                      {fallbackEmployee.exit_date
                        ? new Date(
                            fallbackEmployee.exit_date,
                          ).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-border/70 bg-card p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Continuity checklist
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    "Exit request",
                    "Clearance status",
                    "Knowledge transfer",
                    "Asset return",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 px-3 py-2"
                    >
                      <span className="text-sm font-medium">{item}</span>
                      <Status tone="blue">Review</Status>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </PageFrame>
    </DashboardShell>
  );
}
