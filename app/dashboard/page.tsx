import { redirect } from "next/navigation";
import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import {
  RoleDashboardOverview,
  type DashboardAction,
  type DashboardDeparture,
  type DashboardMetric,
} from "@/components/dashboard/role-overview";
import {
  getRoleKey,
  resolveDashboardUserContext,
} from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

const openExitStatuses = [
  "draft",
  "submitted",
  "under_review",
  "clearance",
  "blocked",
  "eligible_for_finalization",
];

export default async function Page() {
  const { user, profile, userName, userRole } =
    await resolveDashboardUserContext();
  const role = getRoleKey(userRole);

  if (!profile.department_id) {
    redirect("/onboard?next=/dashboard");
  }

  const supabase = await createClient();
  let metrics: DashboardMetric[];
  let actions: DashboardAction[];
  let departures: DashboardDeparture[] = [];
  let unlinkedEmployee = false;

  if (role === "employee") {
    const { data: employee, error: employeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (employeeError) {
      throw new Error("Unable to load your employee record.");
    }

    unlinkedEmployee = !employee;
    const [leaveRequests, hrRequests, exitRequests] = employee
      ? await Promise.all([
          supabase
            .from("leave_requests")
            .select("id", { count: "exact", head: true })
            .eq("employee_id", employee.id)
            .eq("status", "pending"),
          supabase
            .from("employee_requests")
            .select("id", { count: "exact", head: true })
            .eq("employee_id", employee.id)
            .in("status", ["submitted", "in_progress"]),
          supabase
            .from("employee_requests")
            .select("id", { count: "exact", head: true })
            .eq("employee_id", employee.id)
            .eq("request_type", "exit_request")
            .in("status", ["submitted", "in_progress"]),
        ])
      : [{ count: 0 }, { count: 0 }, { count: 0 }];

    if (leaveRequests.error || hrRequests.error || exitRequests.error) {
      throw new Error("Unable to load your personal dashboard.");
    }

    metrics = [
      {
        label: "Leave awaiting review",
        value: leaveRequests.count ?? 0,
        description: "Your pending leave applications",
        href: "/dashboard/leave",
        icon: "leave",
      },
      {
        label: "Open HR requests",
        value: hrRequests.count ?? 0,
        description: "Requests submitted to Human Resources",
        href: "/dashboard/requests",
        icon: "requests",
      },
      {
        label: "Exit support requests",
        value: exitRequests.count ?? 0,
        description: "Exit-related requests sent to HR",
        href: "/dashboard/requests",
        icon: "exits",
      },
    ];
    actions = [
      {
        href: "/dashboard/leave",
        title: "Apply for leave",
        description: "Submit an application and follow its status.",
        icon: "leave",
      },
      {
        href: "/dashboard/requests",
        title: "Contact HR",
        description: "Request a document, profile correction, or HR support.",
        icon: "requests",
      },
      {
        href: "/profile",
        title: "My profile",
        description: "Review your personal profile information.",
        icon: "employees",
      },
    ];
  } else {
    const [
      { count: employeeCount, error: employeeError },
      { count: exitCount, error: exitError },
      { count: leaveCount, error: leaveError },
      { count: requestCount, error: requestError },
      { data: recentRequests, error: recentRequestsError },
      { count: userCount, error: userError },
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("employment_status", "active"),
      supabase
        .from("exit_cases")
        .select("id", { count: "exact", head: true })
        .in("status", openExitStatuses),
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase
        .from("employee_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "in_progress"]),
      supabase
        .from("exit_cases")
        .select("id, status, last_day, employees(full_name, employee_number)")
        .in("status", openExitStatuses)
        .order("last_day", { ascending: true, nullsFirst: false })
        .limit(5),
      role === "administrator"
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("active", true)
        : Promise.resolve({ count: null, error: null }),
    ]);

    if (
      employeeError ||
      exitError ||
      leaveError ||
      requestError ||
      recentRequestsError ||
      userError
    ) {
      throw new Error("Unable to load the operational dashboard.");
    }

    metrics = [
      ...(role === "administrator"
        ? [
            {
              label: "Active accounts",
              value: userCount ?? 0,
              description: "Profiles with current system access",
              href: "/dashboard/user-management",
              icon: "users" as const,
            },
          ]
        : []),
      {
        label: "Active employees",
        value: employeeCount ?? 0,
        description: "Current workforce records",
        href: "/dashboard/employees",
        icon: "employees",
      },
      {
        label: "Open exit cases",
        value: exitCount ?? 0,
        description: "Transitions requiring follow-up",
        href: "/dashboard/exit-requests",
        icon: "exits",
      },
      {
        label: "Pending leave",
        value: leaveCount ?? 0,
        description: "Applications awaiting a decision",
        href: "/dashboard/leave",
        icon: "leave",
      },
      {
        label: "Open HR requests",
        value: requestCount ?? 0,
        description: "Employee queries and follow-ups",
        href: "/dashboard/requests",
        icon: "requests",
      },
    ];

    actions =
      role === "administrator"
        ? [
            {
              href: "/dashboard/user-management",
              title: "Access & roles",
              description: "Review accounts and administer role assignments.",
              icon: "users",
            },
            {
              href: "/dashboard/reports",
              title: "Institutional reports",
              description: "Review workforce and operational indicators.",
              icon: "reports",
            },
            {
              href: "/dashboard/settings",
              title: "System settings",
              description: "Configure organization-wide workflows.",
              icon: "settings",
            },
          ]
        : [
            {
              href: "/dashboard/employees",
              title: "Employee register",
              description: "Maintain staff records and employment details.",
              icon: "employees",
            },
            {
              href: "/dashboard/leave",
              title: "Leave review",
              description: "Review applications and maintain balances.",
              icon: "leave",
            },
            {
              href: "/dashboard/requests",
              title: "HR service queue",
              description: "Respond to employee requests and follow-ups.",
              icon: "requests",
            },
          ];

    departures = (recentRequests ?? []).map((request) => {
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
  }

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title={`Good ${getGreetingPeriod()}, ${userName.split(" ")[0]}`}
        description={
          role === "employee"
            ? "Your self-service workspace for leave, HR support, and profile information."
            : `Your ${userRole} workspace for workforce operations and timely decisions.`
        }
      >
        <RoleDashboardOverview
          audience={userRole}
          metrics={metrics}
          actions={actions}
          departures={departures}
          unlinkedEmployee={unlinkedEmployee}
        />
      </PageFrame>
    </DashboardShell>
  );
}

function getGreetingPeriod() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
