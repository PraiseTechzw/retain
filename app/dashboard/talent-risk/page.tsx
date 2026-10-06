import { redirect } from "next/navigation";
import { DashboardShell, PageFrame, Status } from "@/components/dashboard-shell";
import { assessFlightRisk } from "@/lib/analytics/flight-risk";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { getEmployees, getLeaveRequests } from "@/lib/supabase/data";

function commuteBand(distance: number | null | undefined) {
  if (distance === null || distance === undefined) return "Not recorded";
  if (distance >= 50) return "50+ km";
  if (distance >= 25) return "25–49 km";
  if (distance >= 10) return "10–24 km";
  return "Under 10 km";
}

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "management"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const [employees, leaveRequests] = await Promise.all([
    getEmployees(),
    getLeaveRequests(),
  ]);
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
  const assessments = activeEmployees
    .map((employee) => assessFlightRisk(employee, leaveRequests))
    .sort((a, b) => b.score - a.score);
  const heatmap = new Map<string, Map<string, number>>();
  activeEmployees.forEach((employee) => {
    const area = employee.home_area?.trim() || "Area not recorded";
    const band = commuteBand(employee.commute_distance_km);
    const bands = heatmap.get(area) ?? new Map<string, number>();
    bands.set(band, (bands.get(band) ?? 0) + 1);
    heatmap.set(area, bands);
  });
  const heatmapAreas = [...heatmap.entries()].sort(
    (a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]),
  );
  const hasCommuteData = activeEmployees.some(
    (employee) => employee.commute_distance_km !== null && employee.commute_distance_km !== undefined,
  );

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Talent risk & commute heatmap"
        description="Early-warning indicators combine approved leave patterns, tenure milestones, and recorded commute burden for HR review."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
            <p className="font-semibold">Provisional rule-based indicator — not a validated prediction</p>
            <p className="mt-1">
              Initial weights: annual approved leave days (up to 25 points), leave-request frequency (up to 15), tenure milestone within six months (15), and one-way commute distance (up to 25). Scores are normalized to 0–100. Validate thresholds with HR before using them for employment decisions.
            </p>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            {(["High", "Medium", "Low"] as const).map((level) => (
              <div key={level} className="rounded-2xl border border-border/70 bg-card p-5">
                <p className="text-sm text-muted-foreground">{level} review signal</p>
                <p className="mt-2 text-3xl font-semibold">
                  {assessments.filter((assessment) => assessment.level === level).length}
                </p>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Early-warning queue</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                No score should be used as an employment decision without individual review.
              </p>
            </div>
            {assessments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Employee", "Department", "Score", "Signal", "Inputs"].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {assessments.map((assessment) => (
                      <tr key={assessment.employee.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium">{assessment.employee.full_name}</p>
                          <p className="text-xs text-muted-foreground">{assessment.employee.employee_number} · {assessment.employee.job_title ?? "Role not recorded"}</p>
                        </td>
                        <td className="px-4 py-3">{assessment.employee.department_name}</td>
                        <td className="px-4 py-3 font-semibold">{assessment.score}/100</td>
                        <td className="px-4 py-3">
                          <Status tone={assessment.level === "High" ? "amber" : assessment.level === "Low" ? "green" : "blue"}>
                            {assessment.level}
                          </Status>
                        </td>
                        <td className="min-w-64 px-4 py-3 text-xs text-muted-foreground">
                          {assessment.signals.join(" · ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No active employee records are available.</p>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
            <div className="border-b border-border/70 p-5">
              <h2 className="text-lg font-semibold">Commute burden heatmap</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Employee counts by recorded home area and one-way commute distance band.
              </p>
            </div>
            {hasCommuteData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      {["Home area", "Under 10 km", "10–24 km", "25–49 km", "50+ km", "Not recorded"].map((title) => (
                        <th key={title} className="px-4 py-3 font-semibold">{title}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {heatmapAreas.map(([area, bands]) => (
                      <tr key={area}>
                        <td className="px-4 py-3 font-medium">{area}</td>
                        {["Under 10 km", "10–24 km", "25–49 km", "50+ km", "Not recorded"].map((band) => {
                          const count = bands.get(band) ?? 0;
                          return (
                            <td key={band} className={`px-4 py-3 text-center ${count ? "bg-blue-100 font-semibold text-blue-900 dark:bg-blue-950/50 dark:text-blue-200" : "text-muted-foreground"}`}>
                              {count || "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-6 text-sm text-muted-foreground">
                Commute heatmap is waiting for commute distance values on employee profiles.
              </p>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
