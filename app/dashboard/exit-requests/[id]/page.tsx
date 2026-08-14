import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { checkExitBlockers, finalizeExit } from "@/lib/supabase/actions";

type ClearanceStep = {
  id: string;
  department: string;
  status: string;
  comments?: string;
  approved_by?: string;
  approved_at?: string;
};
type AssetRow = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
};
type DocRow = {
  id: string;
  title: string;
  category?: string;
  created_at: string;
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: exitReq } = await supabase
    .from("exit_requests")
    .select(
      "id, status, reason, last_day, employees(id,full_name,employee_number)",
    )
    .eq("id", id)
    .single();

  const { data: steps } = await supabase
    .from("clearance_steps")
    .select("id,department,status,comments,approved_by,approved_at")
    .eq("exit_request_id", id)
    .order("step_order", { ascending: true });

  const employeeId = exitReq?.employees?.id;
  const { data: assets } = await supabase
    .from("assets")
    .select("id,asset_tag,asset_type,status")
    .eq("assigned_to", employeeId);

  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id,title,category,created_at")
    .eq("employee_id", employeeId);

  const { blocked, blockers } = await checkExitBlockers(id);

  return (
    <DashboardShell>
      <PageFrame
        title="Exit request details"
        description={`Request ${id} · Review timeline, reason, and approvals.`}
      >
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {exitReq?.employees?.full_name ?? "Unknown"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {exitReq?.employees?.employee_number ?? ""} · Last day{" "}
                {exitReq?.last_day ?? "—"}
              </p>
            </div>
            <Status tone={exitReq?.status === "completed" ? "green" : "blue"}>
              {exitReq?.status ?? "unknown"}
            </Status>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">Reason</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {exitReq?.reason}
              </p>
            </div>

            <div className="rounded-xl border p-4 md:col-span-2">
              <p className="text-sm font-medium">Clearance Steps</p>
              <div className="mt-3 space-y-2">
                {(steps ?? []).map((s: ClearanceStep) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.department}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.comments ?? ""}
                      </p>
                    </div>
                    <Status
                      tone={
                        s.status === "approved"
                          ? "green"
                          : s.status === "rejected"
                            ? "red"
                            : "amber"
                      }
                    >
                      {s.status}
                    </Status>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">Assigned Assets</p>
              <div className="mt-3 space-y-2">
                {(assets ?? []).map((a: AssetRow) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {a.asset_tag} — {a.asset_type}
                      </p>
                    </div>
                    <Status tone={a.status === "returned" ? "green" : "amber"}>
                      {a.status}
                    </Status>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <p className="text-sm font-medium">Knowledge Documents</p>
              <div className="mt-3 space-y-2">
                {(docs ?? []).map((d: DocRow) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.category ?? "General"}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium">Blockers</p>
            {blocked ? (
              <div className="mt-3 rounded-md border p-4 bg-amber-50">
                <pre className="whitespace-pre-wrap text-xs">
                  {JSON.stringify(blockers, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="mt-3 rounded-md border p-4 bg-green-50 text-sm">
                No blockers — ready to finalize.
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <form action={finalizeExit}>
              <input type="hidden" name="exit_request_id" value={id} />
              <button disabled={blocked} className="btn-primary">
                Finalize Exit
              </button>
            </form>
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
