import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { recordAssetDailyLog } from "@/lib/supabase/actions";
import { AssetActionForm } from "@/components/asset-action-form";
import { getAssetBusinessDate } from "@/lib/asset-date";
import {
  getAssetDailyLogs,
  getAssetActivityCount,
  getAssets,
  getDailyAssetCheckIds,
} from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (
    !["hr", "administrator", "management", "ict", "library"].some((role) =>
      userRole.toLowerCase().includes(role),
    )
  ) {
    redirect("/dashboard");
  }
  const today = getAssetBusinessDate();
  const [assets, logs, dailyCheckIds, todayCount] = await Promise.all([
    getAssets(),
    getAssetDailyLogs(100),
    getDailyAssetCheckIds(today),
    getAssetActivityCount(today),
  ]);
  const monitoredAssets = assets.filter(
    (asset) => asset.status === "assigned" && asset.assigned_to,
  );
  const checkedAssetIds = new Set(dailyCheckIds);
  const missingDailyChecks = monitoredAssets.filter(
    (asset) => asset.id && !checkedAssetIds.has(asset.id),
  );
  const checkedAssetsCount = monitoredAssets.filter(
    (asset) => asset.id && checkedAssetIds.has(asset.id),
  ).length;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Daily asset monitoring"
        description="Log daily checks, movement, maintenance, issues, and return events for university equipment."
        action={
          <Link
            href="/dashboard/assets"
            className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted"
          >
            Asset register
          </Link>
        }
      >
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Assets in register
              </p>
              <p className="mt-2 text-3xl font-semibold">{assets.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Daily checks completed
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {checkedAssetsCount}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Assets still to check
              </p>
              <p className="mt-2 text-3xl font-semibold">
                {missingDailyChecks.length}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">
                Activity events today
              </p>
              <p className="mt-2 text-3xl font-semibold">{todayCount}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Daily check coverage</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {monitoredAssets.length
                  ? `${Math.round((checkedAssetsCount / monitoredAssets.length) * 100)}% of assigned assets checked today`
                  : "No currently assigned assets need a daily check."}
              </p>
            </div>
            {missingDailyChecks.length ? (
              <div className="divide-y divide-border/60">
                {missingDailyChecks.map((asset) => (
                  <div
                    key={asset.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {asset.asset_tag} · {asset.asset_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {asset.current_location ?? "Location not recorded"}
                      </p>
                    </div>
                    <AssetActionForm kind="log" successMessage="Today’s check was recorded.">
                      <input
                        type="hidden"
                        name="asset_id"
                        value={asset.id ?? ""}
                      />
                      <input
                        type="hidden"
                        name="event_type"
                        value="daily_check"
                      />
                      <input type="hidden" name="logged_on" value={today} />
                      <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                        Log today&apos;s check
                      </button>
                    </AssetActionForm>
                  </div>
                ))}
              </div>
            ) : (
              <p className="p-5 text-sm text-muted-foreground">
                {monitoredAssets.length
                  ? "Every currently assigned asset has a daily check recorded today."
                  : "Assign assets to begin daily coverage checks."}
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="text-lg font-semibold">Record asset activity</h2>
            <AssetActionForm
              kind="log"
              successMessage="Asset activity was recorded."
              className="mt-4 grid gap-3 md:grid-cols-3"
            >
              <label className="text-sm font-medium">
                Asset
                <select
                  name="asset_id"
                  required
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
                >
                  <option value="">Choose asset</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id ?? ""}>
                      {asset.asset_tag} · {asset.asset_type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Event
                <select
                  name="event_type"
                  required
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
                >
                  <option value="daily_check">Daily check</option>
                  <option value="movement">Movement</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="issue">Issue</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Date
                <input
                  name="logged_on"
                  type="date"
                  defaultValue={today}
                  required
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
                />
              </label>
              <label className="text-sm font-medium">
                Location / destination
                <input
                  name="location"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
                />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Notes
                <input
                  name="notes"
                  className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
                />
              </label>
              <div className="md:col-span-3">
                <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  Save activity
                </button>
              </div>
            </AssetActionForm>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Recent activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Each entry records an accountable user and timestamp.
              </p>
            </div>
            {logs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {[
                        "Date",
                        "Asset",
                        "Assigned to",
                        "Activity",
                        "Location",
                        "Notes",
                      ].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">
                          {title}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3">{log.logged_on}</td>
                        <td className="px-4 py-3 font-medium">
                          {log.assets?.asset_tag ?? log.asset_id}
                        </td>
                        <td className="px-4 py-3">
                          {log.employees?.full_name ?? "Unassigned"}
                        </td>
                        <td className="px-4 py-3">
                          <Status
                            tone={log.event_type === "issue" ? "amber" : "blue"}
                          >
                            {log.event_type.replaceAll("_", " ")}
                          </Status>
                        </td>
                        <td className="px-4 py-3">{log.location ?? "—"}</td>
                        <td className="max-w-xs truncate px-4 py-3">
                          {log.notes ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                No asset activity has been logged yet.
              </p>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
