import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { approveClearance } from "@/lib/supabase/actions";

type ClearanceStep = {
  id: string;
  department: string;
  status: string;
  comments?: string;
  approved_by?: string;
  approved_at?: string;
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Treat route id as exit_request id and load steps
  const { data: steps } = await supabase
    .from("clearance_steps")
    .select("id,department,status,comments,approved_by,approved_at")
    .eq("exit_request_id", id)
    .order("step_order", { ascending: true });

  return (
    <DashboardShell>
      <PageFrame
        title="Clearance approval"
        description={`Clearance ${id} · Department actions and audit trail.`}
      >
        <div className="rounded-2xl border border-border/70 bg-card p-6">
          <h2 className="font-semibold">Exit clearance</h2>
          <div className="mt-6 flex flex-col gap-3">
            {(steps ?? []).map((s: ClearanceStep) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl border p-4"
              >
                <div>
                  <p className="text-sm font-medium">{s.department}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.comments ?? ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
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
                  {s.status !== "approved" && (
                    <form action={approveClearance}>
                      <input type="hidden" name="clearance_id" value={s.id} />
                      <button className="btn">Approve</button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
