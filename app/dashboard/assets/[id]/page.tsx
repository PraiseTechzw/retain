import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { verifyAsset } from "@/lib/supabase/actions";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: asset } = await supabase
    .from("assets")
    .select(
      "id,asset_tag,asset_type,description,status,assigned_to,returned_at,employees(full_name,employee_number)",
    )
    .eq("id", id)
    .single();

  return (
    <DashboardShell>
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
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
