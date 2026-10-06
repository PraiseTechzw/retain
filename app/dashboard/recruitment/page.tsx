import { redirect } from "next/navigation";
import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  createRecruitmentOpening,
  updateRecruitmentStage,
} from "@/lib/supabase/actions";
import { getDepartments, getRecruitmentOpenings } from "@/lib/supabase/data";

const stages = [
  "planned",
  "open",
  "shortlisting",
  "interviewing",
  "offered",
  "filled",
  "cancelled",
];

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "management"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const [openings, departments] = await Promise.all([
    getRecruitmentOpenings(),
    getDepartments(),
  ]);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Recruitment mapping"
        description="Map planned roles and recruitment stages to departments and employment categories."
      >
        <div className="space-y-6">
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="text-lg font-semibold">Map a recruitment opening</h2>
            <form action={createRecruitmentOpening} className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium">
                Job title
                <input name="job_title" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
              </label>
              <label className="text-sm font-medium">
                Department
                <select name="department_id" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal">
                  <option value="">Choose department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id ?? ""}>{department.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Employment category
                <select name="employment_category" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal">
                  <option value="academic">Academic</option>
                  <option value="academic_attaché">Academic attaché</option>
                  <option value="support">Support staff</option>
                </select>
              </label>
              <label className="text-sm font-medium">
                Stage
                <select name="status" defaultValue="planned" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal">
                  {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">
                Positions
                <input name="positions" type="number" min="1" step="1" defaultValue="1" required className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
              </label>
              <label className="text-sm font-medium">
                Target start date
                <input name="target_start_date" type="date" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
              </label>
              <label className="text-sm font-medium md:col-span-2">
                Notes
                <input name="notes" className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal" />
              </label>
              <div className="flex items-end">
                <button className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
                  Add opening
                </button>
              </div>
            </form>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Recruitment pipeline</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Openings map workforce needs; do not enter candidate-sensitive information here.
              </p>
            </div>
            {openings.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Role", "Department", "Category", "Positions", "Target start", "Stage", "Update stage"].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {openings.map((opening) => (
                      <tr key={opening.id}>
                        <td className="px-4 py-3 font-medium">{opening.job_title}</td>
                        <td className="px-4 py-3">{opening.departments?.name ?? "Unassigned"}</td>
                        <td className="px-4 py-3">{opening.employment_category}</td>
                        <td className="px-4 py-3">{opening.positions}</td>
                        <td className="px-4 py-3">{opening.target_start_date ?? "—"}</td>
                        <td className="px-4 py-3"><Status tone={opening.status === "filled" ? "green" : "amber"}>{opening.status}</Status></td>
                        <td className="px-4 py-3">
                          <form action={updateRecruitmentStage} className="flex min-w-52 gap-2">
                            <input type="hidden" name="opening_id" value={opening.id} />
                            <select name="status" defaultValue={opening.status} className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2">
                              {stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                            </select>
                            <button className="rounded-lg border border-border px-3 text-xs font-semibold hover:bg-muted">Save</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No recruitment openings have been mapped.</p>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
