import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { requireDashboardCapability } from "@/lib/auth-role";
import { getSystemSettings } from "@/lib/supabase/data";
import { restoreDefaultWorkflow, saveSystemSetting } from "@/lib/supabase/actions";

function settingValue(settings: { key: string; value: string | null }[], key: string, fallback: string) {
  return settings.find((setting) => setting.key === key)?.value ?? fallback;
}

export default async function Page() {
  const { userName, userRole } = await requireDashboardCapability("manageSystemSettings");
  const settings = await getSystemSettings();
  const clearanceDefaults = (() => {
    try {
      const value = JSON.parse(settingValue(settings, "default_clearance_departments", '["ICT","Library","Finance","Department head","Knowledge"]'));
      return Array.isArray(value) ? value.join("\n") : "";
    } catch {
      return "";
    }
  })();

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame title="System settings" description="Configure defaults used by workflows and notifications across the system.">
        <div className="grid gap-6 lg:grid-cols-2">
          <SettingForm title="Organization name" description="Shown in system-generated workflow context." name="organization_name" value={settingValue(settings, "organization_name", "Chinhoyi University of Technology")} type="text" />
          <SettingForm title="Knowledge retention" description="How long uploaded knowledge documents are retained." name="retention_days" value={settingValue(settings, "retention_days", "365")} type="number" suffix="days" />
          <SettingForm title="Notification channel" description="Choose how system notifications are delivered." name="notification_channel" value={settingValue(settings, "notification_channel", "in_app")} type="select" />
          <SettingForm title="Leave processing baseline" description="Measured baseline used by leave processing metrics." name="leave_processing_baseline_days" value={settingValue(settings, "leave_processing_baseline_days", "5")} type="number" suffix="days" />
          <section className="rounded-2xl border border-border/70 bg-card p-5 lg:col-span-2">
            <h2 className="font-semibold">Default clearance departments</h2>
            <p className="mt-1 text-sm text-muted-foreground">One department per line. These defaults are used for new exit workflows.</p>
            <form action={saveSystemSetting} className="mt-4 space-y-3">
              <input type="hidden" name="key" value="default_clearance_departments" />
              <textarea name="value" defaultValue={clearanceDefaults} rows={5} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
              <div className="flex flex-wrap gap-3">
                <button type="submit" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Save departments</button>
                <button formAction={restoreDefaultWorkflow} type="submit" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Restore defaults</button>
              </div>
            </form>
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function SettingForm({ title, description, name, value, type, suffix }: { title: string; description: string; name: string; value: string; type: "text" | "number" | "select"; suffix?: string }) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <form action={saveSystemSetting} className="mt-4 flex items-end gap-2">
        <input type="hidden" name="key" value={name} />
        {type === "select" ? (
          <select name="value" defaultValue={value} className="h-10 flex-1 rounded-lg border border-input bg-background px-3 text-sm">
            <option value="in_app">In-app</option>
            <option value="email">Email</option>
            <option value="both">Email and in-app</option>
          </select>
        ) : (
          <input name="value" defaultValue={value} type={type} required className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm" />
        )}
        {suffix && <span className="pb-2 text-xs text-muted-foreground">{suffix}</span>}
        <button type="submit" className="h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">Save</button>
      </form>
    </section>
  );
}
