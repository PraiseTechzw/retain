import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { AssetActionForm } from "@/components/asset-action-form";

type EmployeeRow = { id: string; full_name: string; employee_number: string };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userName, userRole } = await resolveDashboardUserContext();
  const canOperateAssets = ["hr", "administrator", "ict", "library"].some(
    (role) => userRole.toLowerCase().includes(role),
  );
  if (!["hr", "administrator", "management", "ict", "library"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const { id } = await params;
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select(
      "id,asset_tag,asset_type,description,status,assigned_to,returned_at,verified_at,current_location,employees!assigned_to(full_name,employee_number)",
    )
    .eq("id", id)
    .single();
  if (!asset) notFound();
  const assignedEmployee = Array.isArray(asset?.employees)
    ? (asset.employees[0] ?? null)
    : (asset?.employees ?? null);
  const { data: employees } = await supabase
    .from("employees")
    .select("id,full_name,employee_number")
    .eq("employment_status", "active")
    .order("full_name");

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Asset details"
        description={`Asset ${id} · Assignment and return history.`}
      >
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="text-xl font-semibold">
            {asset?.asset_type} · {asset?.asset_tag}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Assigned to {assignedEmployee?.full_name ?? "—"}
          </p>
          {asset.description && <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{asset.description}</p>}
          <div className="mt-6">
            <Status tone={asset?.status === "verified" ? "green" : "amber"}>
              {asset?.status}
            </Status>
            <p className="mt-2 text-sm text-muted-foreground">
              Current location: {asset?.current_location ?? "Not recorded"}
            </p>
          </div>

          <div className="mt-8 flex gap-3">
            {canOperateAssets && ["assigned", "damaged"].includes(asset.status) && (
              <AssetActionForm kind="receive" successMessage="Return recorded. Verify the asset after inspection.">
                <input type="hidden" name="asset_id" value={id} />
                <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  Mark return received
                </button>
              </AssetActionForm>
            )}
            {canOperateAssets && asset.status === "returned" && (
              <AssetActionForm kind="verify" successMessage="Return verified. Release the asset when it is ready for reassignment.">
                <input type="hidden" name="asset_id" value={id} />
                <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  Verify return
                </button>
              </AssetActionForm>
            )}
            {canOperateAssets && asset.status === "verified" && (
              <AssetActionForm kind="release" successMessage="Asset released to inventory and ready for a new assignment.">
                <input type="hidden" name="asset_id" value={id} />
                <button className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted">
                  Release for reassignment
                </button>
              </AssetActionForm>
            )}
            {asset.status === "verified" && (
              <Status tone="green">Return verified · {asset.verified_at ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "Africa/Harare" }).format(new Date(asset.verified_at)) : "date unavailable"}</Status>
            )}

            {canOperateAssets && asset.status === "available" && (
              <AssetActionForm kind="assign" successMessage="Asset assigned to the selected employee." className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="asset_id" value={id} />
              <select
                name="employee_id"
                required
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
              >
                <option value="">Assign to...</option>
                {(employees ?? []).map((e: EmployeeRow) => (
                  <option key={e.id} value={e.id}>
                    {e.employee_number} · {e.full_name}
                  </option>
                ))}
              </select>
              <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                Assign
              </button>
                {!employees?.length && <p className="w-full text-sm text-muted-foreground">There are no active employees available to assign this asset to.</p>}
            </AssetActionForm>
            )}
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
