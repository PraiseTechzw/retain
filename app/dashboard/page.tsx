import { redirect } from "next/navigation";
import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { DashboardOverview } from "@/components/dashboard/overview";
import { normalizeUserRole } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("department_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const authRole = user?.user_metadata?.role as string | undefined;
  const profileRole = profile?.role as string | undefined;

  console.log("[dashboard-role-debug]", {
    userId: user.id,
    authRole,
    profileRole,
    rawMetadata: user?.user_metadata ?? null,
    defaultRole: "Employee",
  });

  if (!profile?.department_id) {
    redirect("/onboard?next=/dashboard");
  }

  const [
    { count: employeeCount },
    { count: exitCount },
    { count: clearanceCount },
    { count: documentCount },
    { data: clearanceSteps },
    { data: recentRequests },
  ] = await Promise.all([
    supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("employment_status", "active"),
    supabase
      .from("exit_requests")
      .select("*", { count: "exact", head: true })
      .in("status", [
        "draft",
        "submitted",
        "under_review",
        "clearance",
        "blocked",
        "eligible_for_finalization",
      ]),
    supabase
      .from("clearance_steps")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("knowledge_documents")
      .select("*", { count: "exact", head: true }),
    supabase.from("clearance_steps").select("status"),
    supabase
      .from("exit_requests")
      .select("id, status, last_day, employees(full_name, employee_number)")
      .in("status", [
        "draft",
        "submitted",
        "under_review",
        "clearance",
        "blocked",
        "eligible_for_finalization",
      ])
      .order("last_day", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  const userName =
    profile?.full_name ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "User";
  const userRole = normalizeUserRole(
    (user?.user_metadata?.role as string | undefined) ||
      profile?.role ||
      "Employee",
  );

  const completedClearances = (clearanceSteps ?? []).filter(
    (step) => step.status === "approved",
  ).length;
  const pendingClearances = (clearanceSteps ?? []).filter(
    (step) =>
      step.status === "pending" ||
      step.status === "in_progress" ||
      step.status === "blocked",
  ).length;

  const metrics = [
    {
      label: "Active employees",
      value: employeeCount ?? 0,
      description: "Current workforce records",
      href: "/dashboard/employees",
      icon: "employees",
      tone: "blue",
    },
    {
      label: "Open exit requests",
      value: exitCount ?? 0,
      description: "Transitions in progress",
      href: "/dashboard/exit-requests",
      icon: "exits",
      tone: "amber",
    },
    {
      label: "Clearances to review",
      value: clearanceCount ?? 0,
      description: "Pending department actions",
      href: "/dashboard/clearances",
      icon: "clearances",
      tone: "violet",
    },
    {
      label: "Knowledge records",
      value: documentCount ?? 0,
      description: "Documents retained",
      href: "/dashboard/knowledge-hub",
      icon: "knowledge",
      tone: "emerald",
    },
  ] as const;

  const departures = (recentRequests ?? []).map((request) => {
    const employee = Array.isArray(request.employees)
      ? request.employees[0]
      : request.employees;
    return {
      id: request.id,
      employeeName: employee?.full_name ?? "Unknown employee",
      employeeNumber: employee?.employee_number ?? "No employee number",
      status: request.status,
      lastDay: request.last_day,
    };
  });

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title={`Good morning, ${userName}`}
        description={
          userRole === "Employee"
            ? "Here is the continuity information relevant to your role and department."
            : "Here is what is happening across your institutional continuity workspace."
        }
        action={
          <a
            href="/dashboard/reports"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            View reports
          </a>
        }
      >
        <DashboardOverview
          metrics={[...metrics]}
          departures={departures}
          clearanceTotal={(clearanceSteps ?? []).length}
          clearanceApproved={completedClearances}
          clearancePending={pendingClearances}
          userRole={userRole}
        />
      </PageFrame>
    </DashboardShell>
  );
}
