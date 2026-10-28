import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { AssetLiveRefresh } from "@/components/asset-live-refresh";
import { getAssets } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { redirect } from "next/navigation";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "management", "ict", "library"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const assets = await getAssets();
  const rows = assets.map((asset) => {
    const employee = Array.isArray(asset.employees)
      ? asset.employees[0]
      : asset.employees;
    return [
      <Link
        key={asset.id}
        href={`/dashboard/assets/${asset.id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {asset.asset_tag}
      </Link>,
      asset.asset_type,
      employee?.full_name ?? "Unassigned",
      asset.current_location ?? "Not recorded",
      asset.last_seen_at
        ? new Date(asset.last_seen_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" })
        : "No check-in yet",
      <Status
        key="status"
        tone={asset.status === "verified" ? "green" : "amber"}
      >
        {asset.status}
      </Status>,
      asset.status === "available" ? (
        <Link href={`/dashboard/assets/${asset.id}`} className="text-sm font-semibold text-primary hover:underline">
          Assign asset
        </Link>
      ) : (
        <Link href={`/dashboard/assets/${asset.id}`} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          View record
        </Link>
      ),
    ];
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Asset Management"
        description="Track institutional equipment, assignments, daily activity, and return verification."
        action={
          <div className="flex items-center gap-2">
            <Link href="/dashboard/assets/activity" className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              Daily activity
            </Link>
            {["hr", "administrator", "ict", "library"].some((role) => userRole.toLowerCase().includes(role)) && <OperationsPanel mode="asset" />}
          </div>
        }
      >
        {assets.length ? (
          <DataTable
            columns={["Asset", "Type", "Assigned employee", "Current location", "Last seen (CAT)", "Status", "Action"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="assets" />
        )}
        <AssetLiveRefresh />
      </PageFrame>
    </DashboardShell>
  );
}
