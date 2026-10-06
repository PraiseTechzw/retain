import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
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
      <Status
        key="status"
        tone={asset.status === "returned" ? "green" : "amber"}
      >
        {asset.status}
      </Status>,
    ];
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Asset Management"
        description="Track institutional equipment, assignments, daily activity, and return verification."
        action={
          <div className="flex items-center gap-2">
            <a href="/dashboard/assets/activity" className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted">
              Daily activity
            </a>
            {["hr", "administrator", "ict", "library"].some((role) => userRole.toLowerCase().includes(role)) && <OperationsPanel mode="asset" />}
          </div>
        }
      >
        {assets.length ? (
          <DataTable
            columns={["Asset", "Type", "Assigned employee", "Current location", "Status"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="assets" />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
