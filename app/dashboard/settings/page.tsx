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
  getDepartments,
  getSystemSettings,
} from "@/lib/supabase/data";
import {
  createDepartment,
  deleteDepartment,
  restoreDefaultWorkflow,
  saveSystemSetting,
  updateDepartment,
  updateProfile,
} from "@/lib/supabase/actions";
import { AppearanceSettings } from "@/components/user-preferences";
import { ChevronDown } from "lucide-react";

function SettingsSection({
  number,
  title,
  description,
  open = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      name="settings-section"
      open={open}
      className="group overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
    >
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 transition hover:bg-muted/30 [&::-webkit-details-marker]:hidden md:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {description}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="space-y-4 border-t border-border/70 p-4 md:p-5">
        {children}
      </div>
    </details>
  );
}

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  await createClient();

  const [systemSettings, auditEvents, adminOverview, departmentRecords] =
    await Promise.all([
      getSystemSettings(),
      getAuditEvents(6),
      getAdminOverviewSnapshot(),
      getDepartments(),
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
        description="Manage your preferences and institutional configuration from one place."
      >
        <div className="space-y-3">
          <SettingsSection
            number="01"
            title="Personal"
            description="Your profile, appearance, and accessibility preferences"
            open
          >
            <AppearanceSettings />

            {!isAdminRole && (
              <section className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    ⚠
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Limited access
                    </p>
                    <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                      Your current role is <strong>{userRole}</strong>. Only
                      administrators and HR managers can edit institutional
                      settings and workflow configuration. Contact your
                      administrator if you need access.
                    </p>
                  </div>
                </div>
              </section>
            )}
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
          </SettingsSection>

          {isAdminRole && (
            <SettingsSection
              number="02"
              title="Organization"
              description="Institution identity and department directory"
            >
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
                  Organization
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Department management
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create, edit, and remove departments used across employee
                  records and clearance workflows.
                </p>

                <form
                  action={createDepartment}
                  className="mt-6 grid gap-4 md:grid-cols-3"
                >
                  <label className="block text-sm font-medium text-foreground">
                    Department name
                    <input
                      name="name"
                      placeholder="Operations"
                      className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    Code
                    <input
                      name="code"
                      placeholder="OPS"
                      className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground md:pt-6">
                    <button className="h-10 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                      Add department
                    </button>
                  </label>
                  <label className="block text-sm font-medium text-foreground md:col-span-3">
                    Description
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Describe the department and its responsibilities."
                      className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    />
                  </label>
                </form>

                <div className="mt-6 space-y-3">
                  {departmentRecords.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No departments configured yet.
                    </p>
                  ) : (
                    departmentRecords.map((department) => (
                      <div
                        key={department.id ?? department.name}
                        className="rounded-xl border border-border/70 bg-muted/20 p-4"
                      >
                        <form
                          action={updateDepartment}
                          className="grid gap-3 md:grid-cols-[1.5fr_0.9fr_1.7fr_auto] md:items-end"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={department.id ?? ""}
                          />
                          <label className="block text-sm font-medium text-foreground">
                            Name
                            <input
                              name="name"
                              defaultValue={department.name ?? ""}
                              className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            />
                          </label>
                          <label className="block text-sm font-medium text-foreground">
                            Code
                            <input
                              name="code"
                              defaultValue={department.code ?? ""}
                              className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            />
                          </label>
                          <label className="block text-sm font-medium text-foreground">
                            Description
                            <input
                              name="description"
                              defaultValue={department.description ?? ""}
                              className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button className="h-10 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted">
                              Save
                            </button>
                          </div>
                        </form>
                        <form
                          action={deleteDepartment}
                          className="mt-3 flex justify-end"
                        >
                          <input
                            type="hidden"
                            name="id"
                            value={department.id ?? ""}
                          />
                          <button
                            type="submit"
                            className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    ))
                  )}
                </div>
              </section>

          {isAdminRole && (
            <SettingsSection
              number="03"
              title="Workflow & notifications"
              description="Clearance defaults, retention, and notification delivery"
            >
              <div className="grid gap-4 xl:grid-cols-2">
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
            )}

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
            </div>
            </SettingsSection>
            <SettingsSection
            number="04"
            title="Overview & audit"
            description="Institutional status and recent administrative activity"
            >
            <div className="grid gap-4 xl:grid-cols-2">
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
              </div>
            </SettingsSection>
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
