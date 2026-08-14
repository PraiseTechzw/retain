import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { updateProfile } from "@/lib/supabase/actions";
import { createClient } from "@/lib/supabase/server";
import { appConfig, getInitials } from "@/lib/system";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const [{ data: profile }, { data: employee }, { data: recentActivity }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, role, department_id")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("employees")
        .select(
          "id, employee_number, full_name, job_title, employment_status, joined_on, department_id, departments(name)",
        )
        .eq("email", user.email ?? "")
        .maybeSingle(),
      supabase
        .from("audit_events")
        .select("id, action, entity_type, created_at")
        .eq("actor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const departmentName = Array.isArray(employee?.departments)
    ? employee.departments[0]?.name
    : typeof employee?.departments === "object" && employee.departments
      ? (employee.departments as { name?: string | null }).name
      : undefined;

  const userName =
    profile?.full_name ||
    employee?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    appConfig.defaultUserName;

  const userRole =
    profile?.role ||
    (user?.user_metadata?.role as string | undefined) ||
    appConfig.defaultRole;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="My Profile"
        description={`Manage your ${appConfig.appName} profile and account information.`}
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center gap-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {getInitials(userName)}
              </div>
              <div>
                <h2 className="text-xl font-semibold">{userName}</h2>
                <p className="text-sm text-muted-foreground">
                  {employee?.job_title ?? "Unassigned role"} · {userRole}
                </p>
              </div>
            </div>

            <form action={updateProfile} className="mt-8 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  Full name
                  <input
                    name="full_name"
                    defaultValue={userName}
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Email
                  <input
                    value={user.email ?? ""}
                    readOnly
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground"
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Save profile
                </button>
              </div>
            </form>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Employment
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Employee number</dt>
                    <dd className="font-medium">
                      {employee?.employee_number ?? "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Department</dt>
                    <dd className="font-medium">{departmentName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium">
                      {employee?.employment_status ?? "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Account
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Role</dt>
                    <dd className="font-medium">{userRole}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="font-medium">
                      {employee?.joined_on
                        ? new Date(employee.joined_on).toLocaleDateString()
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Organization</dt>
                    <dd className="font-medium">{appConfig.organization}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Security
              </p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  Change password is handled through the auth provider.
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
                  Signed-in as {user.email ?? "unknown email"}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Recent activity
              </p>
              <div className="mt-4 space-y-3">
                {recentActivity && recentActivity.length > 0 ? (
                  recentActivity.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-border/70 bg-muted/30 p-3"
                    >
                      <p className="text-sm font-medium capitalize">
                        {event.action}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.entity_type} ·{" "}
                        {event.created_at
                          ? new Date(event.created_at).toLocaleDateString()
                          : "—"}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No recent activity recorded for this account.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
