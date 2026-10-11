import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Download,
  FileText,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  getAnalyticsDateWindow,
  getAssets,
  getClearanceSteps,
  getEmployees,
  getExitRequests,
  getKnowledgeDocuments,
  getKnowledgeRequirements,
} from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const rangeOptions = [
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "180d", label: "Last 6 months" },
  { value: "365d", label: "Last 12 months" },
  { value: "cy", label: "Current year" },
  { value: "py", label: "Previous year" },
];

function normalizeStatus(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number) {
  if (!Number.isFinite(value)) return "0.0 days";
  return `${value.toFixed(1)} days`;
}

function buildCsvHref(rows: Array<Array<string | number>>) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell ?? "").replace(/\r?\n/g, " ");
          if (typeof cell === "string" && /^[=+\-@\t\r]/.test(value)) {
            value = `'${value}`;
          }
          return `"${value.replace(/"/g, '""')}"`;
        })
        .join(","),
    )
    .join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function renderAnalyticsError({
  userName,
  userRole,
  message,
}: {
  userName: string;
  userRole: string;
  message: string;
}) {
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Talent Intelligence"
        description="The analytics view could not be loaded."
      >
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/25 dark:text-rose-200">
          <p className="font-semibold">Analytics unavailable</p>
          <p className="mt-2 text-sm">{message}</p>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function renderAnalyticsPage({
  userName,
  userRole,
  filters,
  departments,
  employeeList,
  rangeOptions,
  metrics,
  attritionDelta,
  monthlyTrend,
  maxTrend,
  comparisonRows,
  departmentRows,
  exitReasonRows,
  categoryRows,
  knowledgeRiskRows,
  clearanceStatusCounts,
  bottleneckRows,
  assetRecoveryRate,
  assignedAssets,
  dataQuality,
}: {
  userName: string;
  userRole: string;
  filters: {
    range: string;
    department: string;
    employmentCategory: string;
    employeeType: string;
    exitStatus: string;
  };
  departments: Array<{ id: string; name: string }>;
  employeeList: Array<{
    id: string;
    department_id?: string | null;
    employment_category?: string | null;
    employment_status?: string | null;
  }>;
  rangeOptions: Array<{ value: string; label: string }>;
  metrics: Array<{
    label: string;
    value: string;
    description: string;
    icon: typeof Users;
    tone: string;
  }>;
  attritionDelta: number;
  monthlyTrend: Array<{ label: string; value: number }>;
  maxTrend: number;
  comparisonRows: Array<{ label: string; value: string; delta: string }>;
  departmentRows: Array<{
    department: string;
    employees: number;
    exits: number;
    attrition: number;
  }>;
  exitReasonRows: Array<{ reason: string; count: number; percentage: number }>;
  categoryRows: Array<{
    category: string;
    employees: number;
    exits: number;
    attrition: number;
  }>;
  knowledgeRiskRows: Array<{
    department: string;
    exiting: number;
    risk: string;
  }>;
  clearanceStatusCounts: Record<string, number>;
  bottleneckRows: Array<{ department: string; count: number }>;
  assetRecoveryRate: number;
  assignedAssets: Array<{
    asset_tag?: string | null;
    status?: string | null;
    employees?:
      | { full_name?: string | null }
      | Array<{ full_name?: string | null }>
      | null;
  }>;
  dataQuality: {
    departmentCoverage: number;
    validDates: number;
    exitReasons: number;
  };
}) {
  const exportHref = buildCsvHref([
    ["CUT-ELAMS Talent Intelligence"],
    ["Generated at", new Date().toISOString()],
    ["Date range", filters.range],
    ["Department filter", filters.department],
    ["Employment category filter", filters.employmentCategory],
    ["Employee type filter", filters.employeeType],
    ["Exit status filter", filters.exitStatus],
    [],
    ["Summary metric", "Value", "Description"],
    ...metrics.map((metric) => [metric.label, metric.value, metric.description]),
    [],
    ["Department", "Employees", "Exits", "Attrition rate (%)"],
    ...departmentRows.map((row) => [row.department, row.employees, row.exits, row.attrition]),
    [],
    ["Employment category", "Employees", "Exits", "Attrition rate (%)"],
    ...categoryRows.map((row) => [row.category, row.employees, row.exits, row.attrition]),
    [],
    ["Exit reason", "Requests", "Share (%)"],
    ...exitReasonRows.map((row) => [row.reason, row.count, row.percentage]),
    [],
    ["Month", "Exits"],
    ...monthlyTrend.map((row) => [row.label, row.value]),
    [],
    ["Clearance status", "Count"],
    ...Object.entries(clearanceStatusCounts),
    [],
    ["Clearance bottleneck department", "Pending steps"],
    ...bottleneckRows.map((row) => [row.department, row.count]),
    [],
    ["Data quality metric", "Coverage (%)"],
    ["Department assigned", dataQuality.departmentCoverage],
    ["Valid lifecycle dates", dataQuality.validDates],
    ["Exit reasons recorded", dataQuality.exitReasons],
    ["Assigned asset recovery rate (%)", assetRecoveryRate],
  ]);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Talent Intelligence"
        description="Review turnover, exit velocity, knowledge exposure, and operational risk across the workforce."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/reports"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
            >
              <FileText className="size-4" />
              Generate report
            </Link>
            <a href={exportHref} download={`cut-elams-talent-intelligence-${filters.range}.csv`} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
              <Download className="size-4" />
              Export CSV
            </a>
          </div>
        }
      >
        <div className="space-y-8">
          <div className="rounded-2xl border border-border/70 bg-card p-4 md:p-5">
            <form method="GET" className="grid gap-3 md:grid-cols-5">
              <label className="text-sm font-medium text-foreground">
                Date range
                <select
                  name="range"
                  defaultValue={filters.range}
                  className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {rangeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-foreground">
                Department
                <select
                  name="department"
                  defaultValue={filters.department}
                  className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All departments</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-foreground">
                Employment category
                <select
                  name="employmentCategory"
                  defaultValue={filters.employmentCategory}
                  className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All categories</option>
                  {[
                    ...new Set(
                      employeeList.map(
                        (employee) => employee.employment_category ?? "Other",
                      ),
                    ),
                  ].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-foreground">
                Employee type
                <select
                  name="employeeType"
                  defaultValue={filters.employeeType}
                  className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="exiting">Exiting</option>
                  <option value="exited">Exited</option>
                </select>
              </label>
              <label className="text-sm font-medium text-foreground">
                Exit status
                <select
                  name="exitStatus"
                  defaultValue={filters.exitStatus}
                  className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                >
                  <option value="all">All</option>
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under review</option>
                  <option value="clearance">Clearance</option>
                  <option value="blocked">Blocked</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </form>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, description, icon: Icon, tone }) => (
              <div
                key={label}
                className="rounded-2xl border border-border/70 bg-card p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <Status tone={tone as "green" | "amber" | "blue"}>
                    {label}
                  </Status>
                </div>
                <p className="mt-5 text-3xl font-semibold">{value}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">Attrition trend</h2>
                <Status
                  tone={
                    attritionDelta > 0
                      ? "amber"
                      : attritionDelta < 0
                        ? "green"
                        : "blue"
                  }
                >
                  {attritionDelta > 0
                    ? "Increasing"
                    : attritionDelta < 0
                      ? "Improving"
                      : "Stable"}
                </Status>
              </div>
              <div className="mt-6 flex h-52 items-end gap-3">
                {monthlyTrend.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex flex-1 flex-col items-center gap-2"
                  >
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-primary to-primary/40"
                      style={{
                        height: `${Math.max(12, (entry.value / maxTrend) * 100)}%`,
                      }}
                      title={`${entry.label}: ${entry.value} exits`}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {entry.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Period comparison</h2>
              <div className="mt-4 space-y-3">
                {comparisonRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/10 p-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {row.label}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-semibold">{row.value}</span>
                      {row.delta !== "Insufficient data" &&
                      row.delta !== "Operational view" &&
                      row.delta !== "Comparable" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <ArrowUpRight className="size-3" />
                          {row.delta}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {row.delta}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Turnover by department</h2>
              {departmentRows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <DataTable
                    columns={["Department", "Employees", "Exits", "Attrition"]}
                    rows={departmentRows.map((row) => [
                      row.department,
                      String(row.employees),
                      String(row.exits),
                      formatPercent(row.attrition),
                    ])}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="department analytics"
                    description="No department attrition data is available for the selected scope."
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Exit reasons</h2>
              {exitReasonRows.length ? (
                <div className="mt-4 space-y-3">
                  {exitReasonRows.map((row) => (
                    <div key={row.reason} className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{row.reason}</span>
                        <span className="font-medium">
                          {row.count} ({formatPercent(row.percentage)})
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(row.percentage, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="exit reasons"
                    description="No exit reasons are available for the selected period."
                  />
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">
                Attrition by employment category
              </h2>
              {categoryRows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <DataTable
                    columns={["Category", "Population", "Exits", "Attrition"]}
                    rows={categoryRows.map((row) => [
                      row.category,
                      String(row.employees),
                      String(row.exits),
                      formatPercent(row.attrition),
                    ])}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="category analytics"
                    description="No employment-category analytics are available in the current selection."
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Knowledge risk</h2>
              {knowledgeRiskRows.length ? (
                <div className="mt-4 overflow-x-auto">
                  <DataTable
                    columns={["Department", "Exiting staff", "Risk"]}
                    rows={knowledgeRiskRows.map((row) => [
                      row.department,
                      String(row.exiting),
                      row.risk,
                    ])}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="knowledge risk"
                    description="No knowledge risk pattern is visible in the selected cohort."
                  />
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Clearance performance</h2>
              <div className="mt-4 space-y-3">
                {Object.entries(clearanceStatusCounts).map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/10 p-3"
                  >
                    <span className="text-sm text-muted-foreground">
                      {label}
                    </span>
                    <span className="text-lg font-semibold">{value}</span>
                  </div>
                ))}
              </div>
              {bottleneckRows.length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Bottleneck departments
                  </h3>
                  <div className="mt-3 space-y-2">
                    {bottleneckRows.map((row) => (
                      <div
                        key={row.department}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{row.department}</span>
                        <span className="font-medium">{row.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No clearance bottleneck detected.
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Asset recovery</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Recovered
                  </p>
                  <p className="mt-3 text-2xl font-semibold">
                    {formatPercent(assetRecoveryRate)}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Outstanding
                  </p>
                  <p className="mt-3 text-2xl font-semibold">
                    {Math.max(
                      0,
                      assignedAssets.length -
                        assignedAssets.filter(
                          (asset) =>
                            String(asset.status ?? "").toLowerCase() ===
                            "verified",
                        ).length,
                    )}
                  </p>
                </div>
              </div>
              {assignedAssets.length ? (
                <div className="mt-4 overflow-x-auto">
                  <DataTable
                    columns={["Asset tag", "Status", "Assigned to"]}
                    rows={assignedAssets.slice(0, 6).map((asset) => {
                      const assetEmployee = Array.isArray(asset.employees)
                        ? (asset.employees[0] ?? null)
                        : (asset.employees ?? null);
                      return [
                        String(asset.asset_tag ?? "—"),
                        String(asset.status ?? "assigned"),
                        String(assetEmployee?.full_name ?? "Unassigned"),
                      ];
                    })}
                  />
                </div>
              ) : (
                <div className="mt-4">
                  <EmptyState
                    label="asset recovery data"
                    description="No assigned asset records are available for the selected scope."
                  />
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <h2 className="text-lg font-semibold">Analytics data quality</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Department coverage
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatPercent(dataQuality.departmentCoverage)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Valid joined dates
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatPercent(dataQuality.validDates)}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Exit reason coverage
                </p>
                <p className="mt-3 text-2xl font-semibold">
                  {formatPercent(dataQuality.exitReasons)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const { userName, userRole } = await resolveDashboardUserContext();
  if (!["hr", "administrator", "management"].some((role) => userRole.toLowerCase().includes(role))) {
    redirect("/dashboard");
  }
  const supabase = await createClient();

  const filters = {
    range: typeof params.range === "string" ? params.range : "90d",
    department:
      typeof params.department === "string" ? params.department : "all",
    employmentCategory:
      typeof params.employmentCategory === "string"
        ? params.employmentCategory
        : "all",
    employeeType:
      typeof params.employeeType === "string" ? params.employeeType : "all",
    exitStatus:
      typeof params.exitStatus === "string" ? params.exitStatus : "all",
  };

  const dateWindow = getAnalyticsDateWindow(filters);

  try {
    const [
      departmentsResult,
      employees,
      exitRequests,
      assets,
      knowledgeDocuments,
      knowledgeRequirements,
      clearanceSteps,
    ] = await Promise.all([
      supabase.from("departments").select("id, name").order("name"),
      getEmployees(),
      getExitRequests(),
      getAssets(),
      getKnowledgeDocuments(),
      getKnowledgeRequirements(),
      getClearanceSteps(),
    ]);

    if (departmentsResult.error) {
      throw new Error(departmentsResult.error.message);
    }

    const departments = departmentsResult.data ?? [];
    const employeeList = (Array.isArray(employees) ? employees : []).map(
      (employee) => ({
        id: String(employee.id ?? ""),
        department_id: employee.department_id ?? null,
        employment_category: employee.employment_category ?? null,
        employment_status: employee.employment_status ?? null,
        joined_on: employee.joined_on ?? null,
      }),
    );
    const exitList = Array.isArray(exitRequests) ? exitRequests : [];
    const assetList = Array.isArray(assets) ? assets : [];
    const documentList = Array.isArray(knowledgeDocuments)
      ? knowledgeDocuments
      : [];
    const requirementList = Array.isArray(knowledgeRequirements)
      ? knowledgeRequirements
      : [];
    const clearanceList = Array.isArray(clearanceSteps) ? clearanceSteps : [];

    const scopeEmployees = employeeList.filter((employee) => {
      const employeeRecord = Array.isArray(employee)
        ? (employee[0] ?? null)
        : employee;
      if (
        filters.department !== "all" &&
        employeeRecord?.department_id !== filters.department
      ) {
        return false;
      }
      if (
        filters.employmentCategory !== "all" &&
        (employeeRecord?.employment_category ?? "Other") !==
          filters.employmentCategory
      ) {
        return false;
      }
      if (filters.employeeType === "active") {
        if (normalizeStatus(employee.employment_status) === "exited")
          return false;
      }
      if (filters.employeeType === "exited") {
        if (normalizeStatus(employee.employment_status) !== "exited")
          return false;
      }
      if (filters.employeeType === "exiting") {
        const hasOpenExit = exitList.some(
          (request) =>
            request.employee_id === employee.id &&
            !["completed", "cancelled", "rejected"].includes(
              normalizeStatus(request.status),
            ),
        );
        if (!hasOpenExit) return false;
      }
      return true;
    });

    const relevantExitRequests = exitList.filter((request) => {
      const employeeRecord = Array.isArray(request.employees)
        ? (request.employees[0] ?? null)
        : (request.employees ?? null);
      const employee =
        employeeRecord ??
        employeeList.find((item) => {
          const candidate = Array.isArray(item) ? (item[0] ?? null) : item;
          return candidate?.id === request.employee_id;
        });
      if (
        filters.department !== "all" &&
        (Array.isArray(employee)
          ? employee[0]?.department_id
          : employee?.department_id) !== filters.department
      ) {
        return false;
      }
      if (
        filters.employmentCategory !== "all" &&
        ((Array.isArray(employee)
          ? employee[0]?.employment_category
          : employee?.employment_category) ?? "Other") !==
          filters.employmentCategory
      ) {
        return false;
      }
      if (filters.exitStatus !== "all") {
        if (
          normalizeStatus(request.status) !== filters.exitStatus.toLowerCase()
        ) {
          return false;
        }
      }
      const submitted = request.submitted_on ?? request.created_at;
      if (!submitted) return true;
      const value = new Date(submitted);
      return value >= dateWindow.start && value <= dateWindow.end;
    });

    const currentEmployees = scopeEmployees.filter(
      (employee) => normalizeStatus(employee.employment_status) !== "exited",
    );

    const exitsInPeriod = relevantExitRequests.length;
    const averageWorkforce =
      scopeEmployees.length > 0
        ? (scopeEmployees.length + currentEmployees.length) / 2
        : 0;
    const attritionRate =
      averageWorkforce > 0 ? (exitsInPeriod / averageWorkforce) * 100 : 0;

    const completedExits = relevantExitRequests.filter(
      (request) =>
        normalizeStatus(request.status) === "completed" &&
        request.submitted_on &&
        request.completed_at,
    );

    const averageClearanceDays = completedExits.length
      ? completedExits.reduce((sum, request) => {
          const start = new Date(request.submitted_on!).getTime();
          const end = new Date(request.completed_at!).getTime();
          return sum + Math.max(0, (end - start) / 86400000);
        }, 0) / completedExits.length
      : 0;

    const approvedKnowledgeDocuments = documentList.filter(
      (document) => normalizeStatus(document.status) === "approved",
    ).length;
    const knowledgeCompletion =
      requirementList.length > 0
        ? (approvedKnowledgeDocuments / requirementList.length) * 100
        : 0;

    const assignedAssets = assetList.filter((asset) => !!asset.assigned_to);
    const returnedAssets = assignedAssets.filter(
      (asset) => normalizeStatus(asset.status) === "verified",
    ).length;
    const assetRecoveryRate =
      assignedAssets.length > 0
        ? (returnedAssets / assignedAssets.length) * 100
        : 0;

    const activeExitRequests = relevantExitRequests.filter(
      (request) =>
        !["completed", "cancelled", "rejected"].includes(
          normalizeStatus(request.status),
        ),
    );

    const departmentRows = departments
      .map((department) => {
        const departmentEmployees = scopeEmployees.filter((employee) => {
          const employeeRecord = Array.isArray(employee)
            ? (employee[0] ?? null)
            : employee;
          return employeeRecord?.department_id === department.id;
        });
        const departmentExits = relevantExitRequests.filter((request) => {
          const employeeRecord = Array.isArray(request.employees)
            ? (request.employees[0] ?? null)
            : (request.employees ?? null);
          const employee =
            employeeRecord ??
            employeeList.find((item) => {
              const candidate = Array.isArray(item) ? (item[0] ?? null) : item;
              return candidate?.id === request.employee_id;
            });
          return (
            (Array.isArray(employee)
              ? employee[0]?.department_id
              : employee?.department_id) === department.id
          );
        }).length;
        const activeCount = departmentEmployees.filter(
          (employee) =>
            normalizeStatus(employee.employment_status) !== "exited",
        ).length;
        return {
          department: department.name,
          employees: activeCount,
          exits: departmentExits,
          attrition:
            activeCount > 0 ? (departmentExits / activeCount) * 100 : 0,
        };
      })
      .filter((row) => row.employees > 0 || row.exits > 0)
      .sort((a, b) => b.attrition - a.attrition);

    const exitReasonMap = new Map<string, number>();
    relevantExitRequests.forEach((request) => {
      const reason = String(request.reason ?? "Other").trim() || "Other";
      exitReasonMap.set(reason, (exitReasonMap.get(reason) ?? 0) + 1);
    });

    const exitReasonRows = [...exitReasonMap.entries()]
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: relevantExitRequests.length
          ? (count / relevantExitRequests.length) * 100
          : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const categoryRows = Array.from(
      new Set(
        scopeEmployees.map((employee) => {
          const employeeRecord = Array.isArray(employee)
            ? (employee[0] ?? null)
            : employee;
          return employeeRecord?.employment_category ?? "Other";
        }),
      ),
    )
      .map((category) => {
        const categoryEmployees = scopeEmployees.filter((employee) => {
          const employeeRecord = Array.isArray(employee)
            ? (employee[0] ?? null)
            : employee;
          return (employeeRecord?.employment_category ?? "Other") === category;
        });
        const exits = relevantExitRequests.filter((request) => {
          const employeeRecord = Array.isArray(request.employees)
            ? (request.employees[0] ?? null)
            : (request.employees ?? null);
          const employee =
            employeeRecord ??
            employeeList.find((item) => {
              const candidate = Array.isArray(item) ? (item[0] ?? null) : item;
              return candidate?.id === request.employee_id;
            });
          return (
            ((Array.isArray(employee)
              ? employee[0]?.employment_category
              : employee?.employment_category) ?? "Other") === category
          );
        }).length;
        return {
          category,
          employees: categoryEmployees.length,
          exits,
          attrition:
            categoryEmployees.length > 0
              ? (exits / categoryEmployees.length) * 100
              : 0,
        };
      })
      .sort((a, b) => b.attrition - a.attrition);

    const previousWindow = getAnalyticsDateWindow({
      ...filters,
      range: "30d",
    });
    const previousRangeStart = new Date(previousWindow.start);
    const previousRangeEnd = new Date(previousWindow.end);
    const previousPeriodExitCount = exitList.filter((request) => {
      const submitted = request.submitted_on ?? request.created_at;
      if (!submitted) return false;
      const value = new Date(submitted);
      return value >= previousRangeStart && value <= previousRangeEnd;
    }).length;

    const attritionDelta =
      previousPeriodExitCount > 0
        ? ((exitsInPeriod - previousPeriodExitCount) /
            previousPeriodExitCount) *
          100
        : 0;

    const monthlyTrend = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      const label = date.toLocaleDateString("en-US", { month: "short" });
      const value = relevantExitRequests.filter((request) => {
        const submitted = request.submitted_on ?? request.created_at;
        if (!submitted) return false;
        const requestDate = new Date(submitted);
        return (
          requestDate.getMonth() === date.getMonth() &&
          requestDate.getFullYear() === date.getFullYear()
        );
      }).length;
      return { label, value };
    });

    const maxTrend = Math.max(1, ...monthlyTrend.map((item) => item.value));

    const knowledgeRiskRows = departments
      .map((department) => {
        const departmentEmployees = scopeEmployees.filter(
          (employee) => employee.department_id === department.id,
        );
        const exitingEmployees = departmentEmployees.filter((employee) =>
          exitList.some(
            (request) =>
              request.employee_id === employee.id &&
              !["completed", "cancelled", "rejected"].includes(
                normalizeStatus(request.status),
              ),
          ),
        );
        return {
          department: department.name,
          exiting: exitingEmployees.length,
          risk:
            exitingEmployees.length > 2
              ? "High"
              : exitingEmployees.length > 0
                ? "Medium"
                : "Low",
        };
      })
      .filter((row) => row.exiting > 0)
      .sort((a, b) => b.exiting - a.exiting);

    const clearanceStatusCounts = {
      Completed: relevantExitRequests.filter(
        (request) => normalizeStatus(request.status) === "completed",
      ).length,
      Pending: relevantExitRequests.filter((request) =>
        ["submitted", "under_review", "clearance"].includes(
          normalizeStatus(request.status),
        ),
      ).length,
      Blocked: relevantExitRequests.filter(
        (request) => normalizeStatus(request.status) === "blocked",
      ).length,
    };

    const bottleneckRows = [
      ...clearanceList.reduce((map, step) => {
        const departmentName =
          String(step.department ?? "Unknown").trim() || "Unknown";
        const shouldCount = ["pending", "in_progress", "blocked"].includes(
          normalizeStatus(step.status),
        );
        if (shouldCount) {
          map.set(departmentName, (map.get(departmentName) ?? 0) + 1);
        }
        return map;
      }, new Map<string, number>()),
    ]
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const dataQuality = {
      departmentCoverage:
        scopeEmployees.length > 0
          ? (scopeEmployees.filter((employee) => !!employee.department_id)
              .length /
              scopeEmployees.length) *
            100
          : 0,
      validDates:
        scopeEmployees.length > 0
          ? (scopeEmployees.filter((employee) => !!employee.joined_on).length /
              scopeEmployees.length) *
            100
          : 0,
      exitReasons:
        relevantExitRequests.length > 0
          ? (relevantExitRequests.filter((request) => !!request.reason).length /
              relevantExitRequests.length) *
            100
          : 0,
    };

    const metrics = [
      {
        label: "Employee base",
        value: scopeEmployees.length.toLocaleString(),
        description: "Active employees in scope",
        icon: Users,
        tone: "blue",
      },
      {
        label: "Exits",
        value: exitsInPeriod.toLocaleString(),
        description: "Exit requests in the selected period",
        icon: BarChart3,
        tone: "amber",
      },
      {
        label: "Attrition",
        value: formatPercent(attritionRate),
        description: "Exits relative to workforce size",
        icon: TrendingUp,
        tone: "blue",
      },
      {
        label: "Pending exits",
        value: activeExitRequests.length.toLocaleString(),
        description: "Open cases yet to complete",
        icon: AlertTriangle,
        tone: "amber",
      },
      {
        label: "Knowledge completion",
        value: formatPercent(knowledgeCompletion),
        description: "Approved documents vs requirements",
        icon: BookOpen,
        tone: "blue",
      },
      {
        label: "Asset recovery",
        value: formatPercent(assetRecoveryRate),
        description: "Returned and verified equipment",
        icon: ShieldCheck,
        tone: "blue",
      },
      {
        label: "Clearance time",
        value: formatDays(averageClearanceDays),
        description: "Average time to close exits",
        icon: Activity,
        tone: "blue",
      },
    ];

    const comparisonRows = [
      {
        label: "Attrition",
        value: formatPercent(attritionRate),
        delta:
          previousPeriodExitCount > 0
            ? `${attritionDelta >= 0 ? "+" : ""}${attritionDelta.toFixed(1)}%`
            : "Insufficient data",
      },
      {
        label: "Exit volume",
        value: exitsInPeriod.toString(),
        delta:
          previousPeriodExitCount > 0
            ? `${exitsInPeriod - previousPeriodExitCount >= 0 ? "+" : ""}${exitsInPeriod - previousPeriodExitCount}`
            : "Insufficient data",
      },
      {
        label: "Clearance time",
        value: formatDays(averageClearanceDays),
        delta: previousPeriodExitCount > 0 ? "Comparable" : "Insufficient data",
      },
      {
        label: "Knowledge completion",
        value: formatPercent(knowledgeCompletion),
        delta: "Operational view",
      },
    ];

    return renderAnalyticsPage({
      userName,
      userRole,
      filters,
      departments,
      employeeList,
      rangeOptions,
      metrics,
      attritionDelta,
      monthlyTrend,
      maxTrend,
      comparisonRows,
      departmentRows,
      exitReasonRows,
      categoryRows,
      knowledgeRiskRows,
      clearanceStatusCounts,
      bottleneckRows,
      assetRecoveryRate,
      assignedAssets,
      dataQuality,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fetch analytics.";

    return renderAnalyticsError({ userName, userRole, message });
  }
}
