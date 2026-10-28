import { redirect } from "next/navigation";
import {
  DashboardShell,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { AssetActionForm } from "@/components/asset-action-form";
import { getAssets } from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "ict", "library"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const assets = await getAssets();
  const pendingReturns = assets.filter((asset) =>
    ["assigned", "damaged", "returned"].includes(String(asset.status).toLowerCase()),
  );

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Asset return verification"
        description="Record receipt and perform a separate verification before exit clearance can pass the digital lock."
      >
        {pendingReturns.length ? (
          <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/70 bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Asset", "Assigned employee", "Status", "Current location", "Action"].map((title) => (
                    <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {pendingReturns.map((asset) => {
                  const employee = Array.isArray(asset.employees)
                    ? asset.employees[0]
                    : asset.employees;
                  return (
                    <tr key={asset.id}>
                      <td className="px-4 py-3 font-medium">{asset.asset_tag} · {asset.asset_type}</td>
                      <td className="px-4 py-3">{employee?.full_name ?? "Unassigned"}</td>
                      <td className="px-4 py-3">
                        <Status tone={asset.status === "returned" ? "blue" : "amber"}>
                          {asset.status}
                        </Status>
                      </td>
                      <td className="px-4 py-3">{asset.current_location ?? "Not recorded"}</td>
                      <td className="px-4 py-3">
                        {asset.status === "assigned" || asset.status === "damaged" ? (
                          <AssetActionForm kind="receive" successMessage="Return recorded. Verify the asset after inspection.">
                            <input type="hidden" name="asset_id" value={asset.id ?? ""} />
                            <button className="rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                              Mark return received
                            </button>
                          </AssetActionForm>
                        ) : (
                          <AssetActionForm kind="verify" successMessage="Asset return verified. Release it from the asset record when ready for reassignment.">
                            <input type="hidden" name="asset_id" value={asset.id ?? ""} />
                            <button className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
                              Verify received asset
                            </button>
                          </AssetActionForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            label="pending asset returns"
            description="No assigned or received assets are waiting for return verification."
          />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
