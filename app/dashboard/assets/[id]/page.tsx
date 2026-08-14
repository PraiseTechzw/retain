import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { verifyAsset, assignAsset } from "@/lib/supabase/actions";

type EmployeeRow = { id: string; full_name: string };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userName, userRole } = await resolveDashboardUserContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select(
      "id,asset_tag,asset_type,description,status,assigned_to,returned_at,employees!assigned_to(full_name,employee_number)",
    )
    .eq("id", id)
    .single();
  const { data: employees } = await supabase
    .from("employees")
    .select("id,full_name")
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
            Assigned to {asset?.employees?.full_name ?? "—"}
          </p>
          <div className="mt-6">
            <Status tone={asset?.status === "returned" ? "green" : "amber"}>
              {asset?.status}
            </Status>
          </div>

          <div className="mt-8 flex gap-3">
            <form action={verifyAsset}>
              <input type="hidden" name="asset_id" value={id} />
              <input type="hidden" name="status" value="returned" />
              <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Verify return
              </button>
            </form>

            <form action={assignAsset} className="flex items-center gap-2">
              <input type="hidden" name="asset_id" value={id} />
              <select
                name="employee_id"
                className="rounded-md border px-2 py-1"
              >
                <option value="">Assign to...</option>
                {(employees ?? []).map((e: EmployeeRow) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                Assign
              </button>
            </form>
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
