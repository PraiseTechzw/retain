import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import {
  defaultSystemSettings,
  parseStoredList,
  resolveSystemSettingValue,
} from "@/lib/system";
import {
  getAdminOverviewSnapshot,
  getAuditEvents,
  getSystemSettings,
} from "@/lib/supabase/data";
import {
  restoreDefaultWorkflow,
  saveSystemSetting,
  updateProfile,
} from "@/lib/supabase/actions";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  await createClient();

  const [systemSettings, auditEvents, adminOverview] = await Promise.all([
    getSystemSettings(),
    getAuditEvents(6),
    getAdminOverviewSnapshot(),
  ]);

  const settingsMap = Object.fromEntries(
    systemSettings.map((setting) => [setting.key, setting.value ?? ""]),
  ) as Record<string, string>;

  const organizationName =
    settingsMap.organization_name || defaultSystemSettings.organization_name;
  const departments = parseStoredList(
    settingsMap.default_clearance_departments ||
      defaultSystemSettings.default_clearance_departments.join(", "),
  );
  const isAdminRole =
    userRole.toLowerCase().includes("administrator") ||
    userRole.toLowerCase().includes("hr");

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Administration & settings"
        description="Central control layer for institutional configuration, access control, workflow policy, retention, and audit readiness."
      >
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Profile
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">User profile</h2>
                </div>
              </div>

              <form
                action={updateProfile}
                className="mt-6 grid gap-4 md:grid-cols-2"
              >
                <label className="block text-sm font-medium text-foreground">
                  Full name
                  <input
                    name="full_name"
                    defaultValue={userName}
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Role
                  <input
                    value={userRole}
                    readOnly
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-muted-foreground"
                  />
                </label>
                <div className="md:col-span-2 flex justify-end">
                  <button className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                    Save profile
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Organization
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Institution profile
              </h2>
              <form action={saveSystemSetting} className="mt-6 space-y-4">
                <input type="hidden" name="key" value="organization_name" />
                <label className="block text-sm font-medium text-foreground">
                  Institution name
                  <input
                    name="value"
                    defaultValue={resolveSystemSettingValue(
                      "organization_name",
                      settingsMap.organization_name,
                    )}
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  />
                </label>
                <div className="flex justify-end">
                  <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Save institution name
                  </button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Workflow
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Clearance workflow defaults
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This configuration is used whenever a new exit request is
                created.
              </p>

              <form action={saveSystemSetting} className="mt-6 space-y-4">
                <input
                  type="hidden"
                  name="key"
                  value="default_clearance_departments"
                />
                <label className="block text-sm font-medium text-foreground">
                  Default departments
                  <textarea
                    name="value"
                    rows={4}
                    defaultValue={departments.join(", ")}
                    className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap justify-between gap-3">
                  <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Save workflow defaults
                  </button>
                </div>
              </form>

              <form
                action={restoreDefaultWorkflow}
                className="mt-4 flex justify-end"
              >
                <button
                  type="submit"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  Restore defaults
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Controls
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Retention & notification policy
              </h2>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <form action={saveSystemSetting} className="space-y-3">
                  <input type="hidden" name="key" value="retention_days" />
                  <label className="block text-sm font-medium text-foreground">
                    Knowledge retention (days)
                    <input
                      name="value"
                      type="number"
                      min="30"
                      defaultValue={resolveSystemSettingValue(
                        "retention_days",
                        settingsMap.retention_days,
                      )}
                      className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Save retention
                  </button>
                </form>

                <form action={saveSystemSetting} className="space-y-3">
                  <input
                    type="hidden"
                    name="key"
                    value="notification_channel"
                  />
                  <label className="block text-sm font-medium text-foreground">
                    Default notification channel
                    <select
                      name="value"
                      defaultValue={resolveSystemSettingValue(
                        "notification_channel",
                        settingsMap.notification_channel,
                      )}
                      className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="email">Email</option>
                      <option value="in_app">In-app</option>
                      <option value="both">Both</option>
                    </select>
                  </label>
                  <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Save notification setting
                  </button>
                </form>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Admin status
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Institutional summary
              </h2>
              <dl className="mt-6 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <dt className="text-sm text-muted-foreground">Institution</dt>
                  <dd className="text-sm font-semibold">{organizationName}</dd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <dt className="text-sm text-muted-foreground">
                    Active employees
                  </dt>
                  <dd className="text-sm font-semibold">
                    {adminOverview.activeEmployees}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <dt className="text-sm text-muted-foreground">Open exits</dt>
                  <dd className="text-sm font-semibold">
                    {adminOverview.openExitRequests}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <dt className="text-sm text-muted-foreground">
                    Pending clearances
                  </dt>
                  <dd className="text-sm font-semibold">
                    {adminOverview.pendingClearanceSteps}
                  </dd>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2">
                  <dt className="text-sm text-muted-foreground">
                    Security mode
                  </dt>
                  <dd className="text-sm font-semibold">
                    {resolveSystemSettingValue(
                      "security_mode",
                      settingsMap.security_mode,
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-2xl border border-border/70 bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Audit trail
              </p>
              <h2 className="mt-2 text-xl font-semibold">
                Recent admin events
              </h2>
              <div className="mt-5 space-y-3">
                {auditEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No recent events recorded yet.
                  </p>
                ) : (
                  auditEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-border/70 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium capitalize">
                          {event.action}
                        </p>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          {event.entity_type}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {event.created_at
                          ? new Date(event.created_at).toLocaleString()
                          : "No timestamp"}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
