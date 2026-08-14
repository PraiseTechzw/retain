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

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
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
        description="Track institutional equipment, assignments, and return verification."
        action={<OperationsPanel mode="asset" />}
      >
        {assets.length ? (
          <DataTable
            columns={["Asset", "Type", "Assigned employee", "Status"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="assets" />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
