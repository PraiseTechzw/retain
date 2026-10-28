import { redirect } from "next/navigation";
import { DashboardShell, PageFrame, Status } from "@/components/dashboard-shell";
import {
  getRecordedCommuteDistance,
  getUpcomingServiceAnniversary,
} from "@/lib/analytics/retention-support";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { recordRetentionIntervention } from "@/lib/supabase/actions";
import {
  getEmployees,
  getLeaveRequests,
  getRetentionInterventions,
} from "@/lib/supabase/data";

function commuteBand(distance: number | null) {
  if (distance === null || distance === undefined) return "Not recorded";
  if (distance >= 50) return "50+ km";
  if (distance >= 25) return "25–49 km";
  if (distance >= 10) return "10–24 km";
  return "Under 10 km";
}

const commuteBands = [
  "Under 10 km",
  "10–24 km",
  "25–49 km",
  "50+ km",
  "Not recorded",
];
const minimumHeatmapCellSize = 5;

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "management"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const employees = await getEmployees();
  const canRecordInterventions = ["hr", "administrator"].some((role) =>
    userRole.toLowerCase().includes(role),
  );
  const interventions = await getRetentionInterventions();
  const activeEmployees = employees
    .filter((employee) => employee.id && employee.full_name && employee.employee_number)
    .filter((employee) => String(employee.employment_status).toLowerCase() === "active")
    .map((employee) => {
      const department = Array.isArray(employee.departments)
        ? employee.departments[0]
        : employee.departments;
      return {
        id: employee.id!,
        full_name: employee.full_name!,
        employee_number: employee.employee_number!,
        employment_status: employee.employment_status,
        job_title: employee.job_title,
        joined_on: employee.joined_on,
        department_name: department?.name ?? "Unassigned",
        home_area: employee.home_area,
        commute_distance_km: employee.commute_distance_km,
      };
    });
  const supportRows = activeEmployees.map((employee) => ({
    employee,
    anniversary: getUpcomingServiceAnniversary(employee.joined_on),
    commuteDistance: getRecordedCommuteDistance(employee),
  }));
  const heatmap = new Map<
    string,
    { label: string; bands: Map<string, number>; total: number }
  >();
  activeEmployees.forEach((employee) => {
    const area = employee.home_area?.trim().replace(/\s+/g, " ") || "Area not recorded";
    const areaKey = area.toLocaleLowerCase("en");
    const band = commuteBand(getRecordedCommuteDistance(employee));
    const row = heatmap.get(areaKey) ?? {
      label: area,
      bands: new Map<string, number>(),
      total: 0,
    };
    row.bands.set(band, (row.bands.get(band) ?? 0) + 1);
    row.total += 1;
    heatmap.set(areaKey, row);
  });
  const areaRows = [...heatmap.values()];
  const visibleAreas = areaRows
    .filter((row) => row.total >= minimumHeatmapCellSize)
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  const smallAreas = areaRows.filter(
    (row) => row.total < minimumHeatmapCellSize,
  );
  if (smallAreas.length) {
    const pooledBands = new Map<string, number>();
    smallAreas.forEach((row) => {
      row.bands.forEach((count, band) => {
        pooledBands.set(band, (pooledBands.get(band) ?? 0) + count);
      });
    });
    visibleAreas.push({
      label: "Other areas (suppressed)",
      bands: pooledBands,
      total: smallAreas.reduce((total, row) => total + row.total, 0),
    });
  }
  const maxHeatmapCell = Math.max(
    1,
    ...visibleAreas.flatMap((row) => commuteBands.map((band) => row.bands.get(band) ?? 0)),
  );
  const interventionsByEmployee = new Map<
    string,
    (typeof interventions)[number][]
  >();
  interventions.forEach((intervention) => {
    const current = interventionsByEmployee.get(intervention.employee_id) ?? [];
    current.push(intervention);
    interventionsByEmployee.set(intervention.employee_id, current);
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Talent retention & support"
        description="Review agreed support actions and workforce-planning context with employees. This page does not predict attrition or rank employees."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-semibold">A support-planning workspace, not a flight-risk score</p>
            <p className="mt-1">
              Commute distance and service dates are shown as neutral context only. Leave use is not scored or ranked. Discuss support needs directly, record agreed actions, and do not use this page to make employment decisions.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">Active employees</p>
              <p className="mt-2 text-3xl font-semibold">{activeEmployees.length}</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">Service anniversaries in six months</p>
              <p className="mt-2 text-3xl font-semibold">
                {supportRows.filter((row) => row.anniversary).length}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-sm text-muted-foreground">Follow-ups scheduled in 30 days</p>
              <p className="mt-2 text-3xl font-semibold">
                {interventions.filter((item) => {
                  if (!item.follow_up_on) return false;
                  const days = (new Date(`${item.follow_up_on}T00:00:00Z`).getTime() - Date.now()) / 86_400_000;
                  return days >= 0 && days <= 30;
                }).length}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Support review</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review context with the employee and record a specific, agreed follow-up.
              </p>
            </div>
            {supportRows.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {[
                        "Employee",
                        "Department",
                        "Service date",
                        "Commute context",
                        "Latest support action",
                        "Follow-up",
                        ...(canRecordInterventions ? ["Record support action"] : []),
                      ].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {supportRows.map(({ employee, anniversary, commuteDistance }) => {
                      const latest = interventionsByEmployee.get(employee.id)?.[0];
                      return (
                      <tr key={employee.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{employee.full_name}</p>
                          <p className="text-xs text-muted-foreground">{employee.employee_number} · {employee.job_title ?? "Role not recorded"}</p>
                        </td>
                        <td className="px-4 py-3">
                          {employee.department_name}
                        </td>
                        <td className="min-w-48 px-4 py-3 text-xs text-muted-foreground">
                          {anniversary
                            ? `${anniversary.yearsOfService}-year service anniversary · ${new Date(`${anniversary.date}T00:00:00Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" })}`
                            : employee.joined_on
                              ? "No anniversary in the next six months"
                              : "Start date not recorded"}
                        </td>
                        <td className="min-w-40 px-4 py-3 text-xs text-muted-foreground">
                          {commuteDistance === null
                            ? "Not recorded"
                            : `${commuteDistance} km one way`}
                        </td>
                        <td className="min-w-48 px-4 py-3 text-xs text-muted-foreground">
                          {latest
                            ? <>{latest.intervention_type.replaceAll("_", " ")} · {latest.action_notes}</>
                            : "No support action recorded"}
                        </td>
                        <td className="min-w-32 px-4 py-3 text-xs text-muted-foreground">
                          {latest?.follow_up_on
                            ? new Date(`${latest.follow_up_on}T00:00:00Z`).toLocaleDateString("en-GB", { dateStyle: "medium", timeZone: "UTC" })
                            : "Not scheduled"}
                        </td>
                        {canRecordInterventions && (
                          <td className="min-w-72 px-4 py-3">
                            <form action={recordRetentionIntervention} className="space-y-2">
                              <input type="hidden" name="employee_id" value={employee.id} />
                              <select name="intervention_type" required className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs">
                                <option value="career_conversation">Career conversation</option>
                                <option value="workload_review">Workload review</option>
                                <option value="development">Development opportunity</option>
                                <option value="commute_support">Commute support</option>
                                <option value="other">Other</option>
                              </select>
                              <textarea name="action_notes" required rows={2} placeholder="Agreed action and context" className="w-full rounded-lg border border-input bg-background p-2 text-xs" />
                              <div className="flex gap-2">
                                <input name="follow_up_on" type="date" className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs" />
                                <button className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground">
                                  Record action
                                </button>
                              </div>
                            </form>
                          </td>
                        )}
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No active employee records are available.</p>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Commute planning snapshot</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Aggregated commute information for service planning only. Use broad locality names, not street addresses; cells smaller than five are suppressed and small-area rows are pooled.
              </p>
            </div>
            {visibleAreas.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Home area", ...commuteBands].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {visibleAreas.map((row) => (
                      <tr key={row.label}>
                        <td className="px-4 py-3 font-medium">{row.label}</td>
                        {commuteBands.map((band) => {
                          const count = row.bands.get(band) ?? 0;
                          const intensity = count / maxHeatmapCell;
                          const heatClass = count < minimumHeatmapCellSize
                            ? "bg-muted/40 text-muted-foreground"
                            : intensity >= 0.75
                              ? "bg-blue-700 font-semibold text-white dark:bg-blue-400 dark:text-slate-950"
                              : intensity >= 0.5
                                ? "bg-blue-500 font-semibold text-white dark:bg-blue-600 dark:text-white"
                                : intensity >= 0.25
                                  ? "bg-blue-300 font-semibold text-blue-950 dark:bg-blue-800 dark:text-blue-100"
                                  : "bg-blue-100 font-semibold text-blue-900 dark:bg-blue-950/70 dark:text-blue-200";
                          return (
                            <td key={band} className={`px-4 py-3 text-center ${heatClass}`}>
                              {count === 0 ? "—" : count < minimumHeatmapCellSize ? "<5" : count}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-border/70 px-5 py-3 text-xs text-muted-foreground">
                  Darker shading indicates a larger relative count. A displayed “&lt;5” is suppressed; totals are intentionally omitted.
                </p>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                No active employee records are available for the commute matrix.
              </p>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
