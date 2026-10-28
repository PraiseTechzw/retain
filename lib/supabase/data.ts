import { createClient } from "@/lib/supabase/server";

export type AnalyticsFilterState = {
  range?: string;
  department?: string;
  employmentCategory?: string;
  employeeType?: string;
  exitStatus?: string;
  from?: string;
  to?: string;
};

export type DepartmentRecord = {
  id?: string | null;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type EmployeeRecord = {
  id?: string | null;
  user_id?: string | null;
  employee_number?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  employment_status?: string | null;
  employment_category?: string | null;
  joined_on?: string | null;
  exit_date?: string | null;
  home_area?: string | null;
  commute_distance_km?: number | null;
  is_technical?: boolean | null;
  department_id?: string | null;
  departments?: DepartmentRecord | DepartmentRecord[] | null;
};

export type ExitRequestRecord = {
  id?: string | null;
  status?: string | null;
  reason?: string | null;
  submitted_on?: string | null;
  created_at?: string | null;
  last_day?: string | null;
  completed_at?: string | null;
  employee_id?: string | null;
  employees?: EmployeeRecord | EmployeeRecord[] | null;
};

export type AssetRecord = {
  id?: string | null;
  asset_tag?: string | null;
  asset_type?: string | null;
  description?: string | null;
  status?: string | null;
  returned_at?: string | null;
  verified_at?: string | null;
  current_location?: string | null;
  assigned_to?: string | null;
  employees?: EmployeeRecord | EmployeeRecord[] | null;
};

export type LeaveRequestRecord = {
  id: string;
  employee_id: string;
  leave_type: string;
  starts_on: string;
  ends_on: string;
  requested_days: number;
  reason: string | null;
  status: string;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  employees?:
    | { full_name?: string | null; employee_number?: string | null; department_id?: string | null }
    | Array<{ full_name?: string | null; employee_number?: string | null; department_id?: string | null }>
    | null;
};

export type LeaveBalanceRecord = {
  id: string;
  employee_id: string;
  leave_year: number;
  leave_type: string;
  entitled_days: number;
  carried_over_days: number;
  updated_at: string;
};

export type AssetDailyLogRecord = {
  id: string;
  asset_id: string;
  employee_id: string | null;
  event_type: string;
  logged_on: string;
  location: string | null;
  notes: string | null;
  created_at: string;
  assets?: { asset_tag?: string | null; asset_type?: string | null } | null;
  employees?: { full_name?: string | null } | null;
};

export type RecruitmentOpeningRecord = {
  id: string;
  job_title: string;
  employment_category: string;
  status: string;
  positions: number;
  target_start_date: string | null;
  notes: string | null;
  created_at: string;
  departments?: { name?: string | null } | null;
};

export type QuarterlyTurnoverRecord = {
  quarter_start: string;
  department: string;
  exits: number;
  active_headcount: number;
  attrition_rate_pct: number | null;
  top_exit_reason?: string | null;
  generated_at?: string | null;
};

export type RetentionInterventionRecord = {
  id: string;
  employee_id: string;
  risk_score: number;
  intervention_type: string;
  action_notes: string;
  follow_up_on: string | null;
  created_at: string;
};

export type KnowledgeDocumentRecord = {
  id?: string | null;
  title?: string | null;
  category?: string | null;
  storage_path?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  description?: string | null;
  requirement_id?: string | null;
  employee_id?: string | null;
  employees?: EmployeeRecord | EmployeeRecord[] | null;
  knowledge_requirements?:
    | Array<{ name?: string | null; reviewer_role?: string | null }>
    | { name?: string | null; reviewer_role?: string | null }
    | null;
  knowledge_categories?:
    | Array<{ name?: string | null; description?: string | null }>
    | { name?: string | null; description?: string | null }
    | null;
};

export type KnowledgeRequirementRecord = {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  is_required?: boolean | null;
  active?: boolean | null;
  reviewer_role?: string | null;
  department_id?: string | null;
  employment_category?: string | null;
  category_id?: string | null;
  knowledge_categories?:
    | Array<{ name?: string | null; description?: string | null }>
    | { name?: string | null; description?: string | null }
    | null;
};

export type ClearanceStepRecord = {
  id?: string | null;
  department?: string | null;
  status?: string | null;
  step_order?: number | null;
  comments?: string | null;
  exit_request_id?: string | null;
  exit_requests?: ExitRequestRecord | ExitRequestRecord[] | null;
};

export function getAnalyticsDateWindow(filters: AnalyticsFilterState = {}) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const range = filters.range ?? "90d";
  const start = new Date(end);

  if (filters.from) {
    start.setTime(new Date(filters.from).getTime());
  } else {
    switch (range) {
      case "30d":
        start.setDate(end.getDate() - 30);
        break;
      case "90d":
        start.setDate(end.getDate() - 90);
        break;
      case "180d":
        start.setDate(end.getDate() - 180);
        break;
      case "365d":
        start.setFullYear(end.getFullYear() - 1);
        break;
      case "cy":
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        break;
      case "py": {
        const year = end.getFullYear() - 1;
        start.setFullYear(year, 0, 1);
        start.setHours(0, 0, 0, 0);
        end.setFullYear(year, 11, 31);
        end.setHours(23, 59, 59, 999);
        break;
      }
      default:
        start.setDate(end.getDate() - 90);
    }
  }

  if (filters.to) {
    const parsedEnd = new Date(filters.to);
    if (!Number.isNaN(parsedEnd.getTime())) {
      end.setTime(parsedEnd.getTime());
      end.setHours(23, 59, 59, 999);
    }
  }

  return {
    start,
    end,
    range,
    label: `From ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
  };
}

function isMissingColumnError(errorMessage: string, columnName: string) {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes("column") &&
    normalized.includes(columnName.toLowerCase()) &&
    (normalized.includes("does not exist") ||
      normalized.includes("could not find") ||
      normalized.includes("schema cache"))
  );
}

export async function getEmployees(): Promise<EmployeeRecord[]> {
  const supabase = await createClient();
  const optionalColumns = [
    "user_id",
    "employment_category",
    "home_area",
    "commute_distance_km",
    "is_technical",
  ];
  const selectedOptionalColumns = new Set(optionalColumns);

  // Production databases can lag the app deployment. Retry only when Postgres
  // explicitly identifies one of these additive employee columns as missing.
  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const columns = [
      "id",
      "user_id",
      "employee_number",
      "full_name",
      "email",
      "job_title",
      "employment_status",
      ...optionalColumns.filter((column) => selectedOptionalColumns.has(column)),
      "joined_on",
      "exit_date",
      "department_id",
      "departments(name)",
    ];
    const { data, error } = await supabase
      .from("employees")
      .select(columns.join(", "))
      .order("created_at", { ascending: false });

    if (!error) return (data ?? []) as unknown as EmployeeRecord[];
    const missingColumn = optionalColumns.find(
      (column) =>
        selectedOptionalColumns.has(column) &&
        isMissingColumnError(error.message, column),
    );
    if (missingColumn) {
      selectedOptionalColumns.delete(missingColumn);
      continue;
    }
    throw new Error(error.message);
  }

  throw new Error("Unable to load employee records.");
}

export async function getEmployeeByLookup(
  lookupValue: string,
): Promise<EmployeeRecord | null> {
  const supabase = await createClient();
  const optionalColumns = [
    "user_id",
    "employment_category",
    "home_area",
    "commute_distance_km",
    "is_technical",
  ];
  const selectedOptionalColumns = new Set(optionalColumns);

  for (let attempt = 0; attempt <= optionalColumns.length; attempt += 1) {
    const columns = [
      "id",
      "employee_number",
      "full_name",
      "email",
      "phone",
      "job_title",
      "employment_status",
      ...optionalColumns.filter((column) => selectedOptionalColumns.has(column)),
      "joined_on",
      "exit_date",
      "department_id",
      "departments(name)",
    ];
    const { data, error } = await supabase
      .from("employees")
      .select(columns.join(", "))
      .or(
        `id.eq.${lookupValue},employee_number.eq.${lookupValue},email.eq.${lookupValue}`,
      )
      .maybeSingle();

    if (!error) return (data ?? null) as unknown as EmployeeRecord | null;
    const missingColumn = optionalColumns.find(
      (column) =>
        selectedOptionalColumns.has(column) &&
        isMissingColumnError(error.message, column),
    );
    if (missingColumn) {
      selectedOptionalColumns.delete(missingColumn);
      continue;
    }
    throw new Error(error.message);
  }

  throw new Error("Unable to load this employee record.");
}

export async function getDepartments(): Promise<DepartmentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("departments")
    .select("id, name, code, description, created_at, updated_at")
    .order("name", { ascending: true });

  if (error) {
    if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as DepartmentRecord[];
}

export async function getExitRequests(): Promise<ExitRequestRecord[]> {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("exit_requests")
    .select(
      "id, status, reason, submitted_on, created_at, last_day, completed_at, employee_id, employees!employee_id(id, full_name, employee_number, department_id, employment_category, employment_status)",
    )
    .order("created_at", { ascending: false });

  const { data, error } = await baseQuery;
  if (!error) return data ?? [];

  // Fallback for missing employment_category
  if (isMissingColumnError(error.message, "employment_category")) {
    const fallback = await supabase
      .from("exit_requests")
      .select(
        "id, status, reason, submitted_on, created_at, last_day, completed_at, employee_id, employees!employee_id(id, full_name, employee_number, department_id)",
      )
      .order("created_at", { ascending: false });

    if (fallback.error) {
      // Fallback for missing completed_at
      if (isMissingColumnError(fallback.error.message, "completed_at")) {
        const fallback2 = await supabase
          .from("exit_requests")
          .select(
            "id, status, reason, submitted_on, created_at, last_day, employee_id, employees!employee_id(id, full_name, employee_number, department_id)",
          )
          .order("created_at", { ascending: false });
        if (fallback2.error) throw new Error(fallback2.error.message);
        return fallback2.data ?? [];
      }
      throw new Error(fallback.error.message);
    }
    return fallback.data ?? [];
  }

  // Fallback for missing completed_at
  if (isMissingColumnError(error.message, "completed_at")) {
    const fallback = await supabase
      .from("exit_requests")
      .select(
        "id, status, reason, submitted_on, created_at, last_day, employee_id, employees!employee_id(id, full_name, employee_number, department_id, employment_category, employment_status)",
      )
      .order("created_at", { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  throw new Error(error.message);
}

export async function getAssets(): Promise<AssetRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, asset_tag, asset_type, description, status, returned_at, verified_at, current_location, assigned_to",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const assets = data ?? [];
  const employeeIds = [
    ...new Set(
      assets
        .map((asset) => asset.assigned_to)
        .filter((employeeId): employeeId is string => Boolean(employeeId)),
    ),
  ];
  const { data: directory, error: directoryError } = employeeIds.length
    ? await supabase
        .from("asset_employee_directory")
        .select("id, full_name, employee_number, department_id")
        .in("id", employeeIds)
    : { data: [], error: null };
  if (directoryError) throw new Error(directoryError.message);
  const employeesById = new Map(
    (directory ?? []).map((employee) => [employee.id, employee]),
  );

  return assets.map((asset) => ({
    ...asset,
    employees: asset.assigned_to
      ? employeesById.get(asset.assigned_to) ?? null
      : null,
  }));
}

export async function getLeaveRequests(): Promise<LeaveRequestRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, employee_id, leave_type, starts_on, ends_on, requested_days, reason, status, reviewed_at, review_notes, created_at, employees!employee_id(full_name, employee_number, department_id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveRequestRecord[];
}

export async function getLeaveBalances(): Promise<LeaveBalanceRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_balances")
    .select("id, employee_id, leave_year, leave_type, entitled_days, carried_over_days, updated_at")
    .order("leave_year", { ascending: false })
    .order("leave_type");
  if (error) throw new Error(error.message);
  return (data ?? []) as LeaveBalanceRecord[];
}

export async function getAssetDailyLogs(limit = 50): Promise<AssetDailyLogRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_daily_logs")
    .select(
      "id, asset_id, employee_id, event_type, logged_on, location, notes, created_at, assets!asset_id(asset_tag, asset_type)",
    )
    .order("logged_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const logs = data ?? [];
  const employeeIds = [
    ...new Set(
      logs
        .map((log) => log.employee_id)
        .filter((employeeId): employeeId is string => Boolean(employeeId)),
    ),
  ];
  const { data: directory, error: directoryError } = employeeIds.length
    ? await supabase
        .from("asset_employee_directory")
        .select("id, full_name")
        .in("id", employeeIds)
    : { data: [], error: null };
  if (directoryError) throw new Error(directoryError.message);
  const employeeNames = new Map(
    (directory ?? []).map((employee) => [employee.id, employee.full_name]),
  );

  return logs.map((log) => ({
    ...log,
    employees: log.employee_id
      ? { full_name: employeeNames.get(log.employee_id) ?? null }
      : null,
  })) as AssetDailyLogRecord[];
}

export async function getDailyAssetCheckIds(loggedOn: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_daily_logs")
    .select("asset_id")
    .eq("event_type", "daily_check")
    .eq("logged_on", loggedOn);

  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.asset_id))];
}

export async function getAssetActivityCount(loggedOn: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("asset_daily_logs")
    .select("id", { count: "exact", head: true })
    .eq("logged_on", loggedOn);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getRecruitmentOpenings(): Promise<RecruitmentOpeningRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recruitment_openings")
    .select(
      "id, job_title, employment_category, status, positions, target_start_date, notes, created_at, departments(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RecruitmentOpeningRecord[];
}

export async function getQuarterlyTurnoverSummary(): Promise<QuarterlyTurnoverRecord[]> {
  const supabase = await createClient();
  const [liveResult, snapshotsResult] = await Promise.all([
    supabase.rpc("get_quarterly_turnover_summary"),
    supabase
      .from("quarterly_turnover_reports")
      .select("quarter_start, department, exits, active_headcount, top_exit_reason, attrition_rate_pct, generated_at")
      .order("quarter_start", { ascending: false })
      .limit(500),
  ]);
  if (liveResult.error) throw new Error(liveResult.error.message);
  if (snapshotsResult.error) throw new Error(snapshotsResult.error.message);
  const snapshots = new Map(
    ((snapshotsResult.data ?? []) as QuarterlyTurnoverRecord[]).map((report) => [
      `${report.quarter_start}:${report.department}`,
      report,
    ]),
  );
  return ((liveResult.data ?? []) as QuarterlyTurnoverRecord[])
    .map((report) => ({
      ...report,
      ...(snapshots.get(`${report.quarter_start}:${report.department}`) ?? {}),
    }))
    .sort(
      (a, b) =>
        b.quarter_start.localeCompare(a.quarter_start) ||
        a.department.localeCompare(b.department),
    );
}

export async function getRetentionInterventions(): Promise<RetentionInterventionRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("retention_interventions")
    .select("id, employee_id, risk_score, intervention_type, action_notes, follow_up_on, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as RetentionInterventionRecord[];
}

export async function getKnowledgeDocuments(): Promise<
  KnowledgeDocumentRecord[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, category, storage_path, status, created_at, updated_at, file_name, mime_type, description, requirement_id, employee_id, employees!employee_id(full_name, employee_number, department_id), knowledge_requirements(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKnowledgeRequirements(): Promise<
  KnowledgeRequirementRecord[]
> {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("knowledge_requirements")
    .select(
      "id, name, description, is_required, active, reviewer_role, department_id, employment_category, category_id, knowledge_categories(name)",
    )
    .eq("active", true)
    .order("name");

  const { data, error } = await baseQuery;
  if (!error) return data ?? [];

  if (isMissingColumnError(error.message, "employment_category")) {
    const fallback = await supabase
      .from("knowledge_requirements")
      .select(
        "id, name, description, is_required, active, reviewer_role, department_id, category_id, knowledge_categories(name)",
      )
      .eq("active", true)
      .order("name");

    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  throw new Error(error.message);
}

export async function getKnowledgeRequirementsForEmployee(employeeId: string) {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("knowledge_requirements")
    .select(
      "id, name, description, is_required, active, reviewer_role, allowed_file_types, max_file_size_mb, knowledge_categories(name, description), department_id, employment_category",
    )
    .eq("active", true)
    .order("name");

  const { data, error } = await baseQuery;
  if (error) {
    if (isMissingColumnError(error.message, "employment_category")) {
      const fallbackRequirements = await supabase
        .from("knowledge_requirements")
        .select(
          "id, name, description, is_required, active, reviewer_role, allowed_file_types, max_file_size_mb, knowledge_categories(name, description), department_id",
        )
        .eq("active", true)
        .order("name");

      if (fallbackRequirements.error) {
        throw new Error(fallbackRequirements.error.message);
      }

      const { data: employee } = await supabase
        .from("employees")
        .select("id, department_id")
        .eq("id", employeeId)
        .maybeSingle();

      if (!employee) return fallbackRequirements.data ?? [];

      const departmentId = employee.department_id;
      return (fallbackRequirements.data ?? []).filter((requirement) => {
        const matchesDepartment =
          !requirement.department_id ||
          requirement.department_id === departmentId;
        return matchesDepartment;
      });
    }

    throw new Error(error.message);
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, department_id, employment_category")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) return data ?? [];

  const departmentId = employee.department_id;
  const category = employee.employment_category;

  return (data ?? []).filter((requirement) => {
    const matchesDepartment =
      !requirement.department_id || requirement.department_id === departmentId;
    const matchesEmployment =
      !requirement.employment_category ||
      requirement.employment_category === category;
    return matchesDepartment && matchesEmployment;
  });
}

export async function getKnowledgeDocumentsForEmployee(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, status, description, file_name, mime_type, file_size, version, created_at, updated_at, requirement_id, category_id, knowledge_requirements(name), knowledge_categories(name)",
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKnowledgeReviewQueue() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, status, created_at, description, file_name, version, employee_id, requirement_id, knowledge_requirements(name, reviewer_role)",
    )
    .in("status", [
      "submitted",
      "pending_review",
      "revision_required",
      "rejected",
    ])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  const documents = data ?? [];
  const employeeIds = [
    ...new Set(
      documents
        .map((document) => document.employee_id)
        .filter((employeeId): employeeId is string => Boolean(employeeId)),
    ),
  ];
  const { data: employeeDirectory, error: directoryError } = employeeIds.length
    ? await supabase
        .from("knowledge_review_employee_directory")
        .select("id, full_name, employee_number")
        .in("id", employeeIds)
    : { data: [], error: null };
  if (directoryError) throw new Error(directoryError.message);

  const employeesById = new Map(
    (employeeDirectory ?? []).map((employee) => [employee.id, employee]),
  );
  return documents.map((document) => ({
    ...document,
    employees: employeesById.get(document.employee_id) ?? null,
  }));
}

export async function getKnowledgeOverviewForEmployee(employeeId: string) {
  const requirements = await getKnowledgeRequirementsForEmployee(employeeId);
  const documents = await getKnowledgeDocumentsForEmployee(employeeId);
  const approved = documents.filter(
    (document) => document.status === "approved",
  ).length;
  const pending = documents.filter((document) =>
    ["submitted", "pending_review", "revision_required"].includes(
      document.status ?? "",
    ),
  ).length;

  return {
    totalRequirements: requirements.length,
    approved,
    pending,
    rejected: documents.filter((document) => document.status === "rejected")
      .length,
    completion: requirements.length
      ? Math.round((approved / requirements.length) * 100)
      : 0,
  };
}

export async function getClearanceSteps(): Promise<ClearanceStepRecord[]> {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("clearance_steps")
    .select(
      "id, department, status, step_order, comments, exit_request_id, exit_requests!exit_request_id(id, employee_id, status, submitted_on, completed_at)",
    )
    .order("step_order", { ascending: true });

  const { data, error } = await baseQuery;
  if (!error) return data ?? [];

  if (isMissingColumnError(error.message, "completed_at")) {
    const fallback = await supabase
      .from("clearance_steps")
      .select(
        "id, department, status, step_order, comments, exit_request_id, exit_requests!exit_request_id(id, employee_id, status, submitted_on)",
      )
      .order("step_order", { ascending: true });

    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  throw new Error(error.message);
}

export async function getSystemSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("system_settings")
    .select("key, value, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      return [] as {
        key: string;
        value: string | null;
        updated_at: string | null;
      }[];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as {
    key: string;
    value: string | null;
    updated_at: string | null;
  }[];
}

export async function getAuditEvents(limit = 8) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (error.code === "42P01" || /does not exist/i.test(error.message)) {
      return [] as {
        id: string;
        action: string;
        entity_type: string;
        entity_id: string | null;
        created_at: string | null;
        metadata: Record<string, unknown> | null;
      }[];
    }
    throw new Error(error.message);
  }

  return (data ?? []) as {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    created_at: string | null;
    metadata: Record<string, unknown> | null;
  }[];
}

export type ReportDashboardSnapshot = {
  employees: Awaited<ReturnType<typeof getEmployees>>;
  exitRequests: Awaited<ReturnType<typeof getExitRequests>>;
  assets: Awaited<ReturnType<typeof getAssets>>;
  knowledgeDocuments: Awaited<ReturnType<typeof getKnowledgeDocuments>>;
  knowledgeRequirements: Awaited<ReturnType<typeof getKnowledgeRequirements>>;
  clearanceSteps: Awaited<ReturnType<typeof getClearanceSteps>>;
  totalEmployees: number;
  activeEmployees: number;
  exitingEmployees: number;
  openExitRequests: number;
  completedExits: number;
  pendingClearanceSteps: number;
  approvedClearanceSteps: number;
  knowledgeCoverage: number;
  assetRecoveryRate: number;
  assetRecoveryCount: number;
  currentYearAttritionRate: number;
};

export type AdminOverviewSnapshot = {
  totalEmployees: number;
  activeEmployees: number;
  openExitRequests: number;
  pendingClearanceSteps: number;
  assignedAssets: number;
  knowledgeDocuments: number;
  knowledgeCoverage: number;
  assetRecoveryRate: number;
  unreadNotifications: number;
  recentAuditEvents: number;
};

export async function getAdminOverviewSnapshot(): Promise<AdminOverviewSnapshot> {
  const [
    employees,
    exitRequests,
    assets,
    knowledgeDocuments,
    knowledgeRequirements,
    clearanceSteps,
    notifications,
    auditEvents,
  ] = await Promise.all([
    getEmployees(),
    getExitRequests(),
    getAssets(),
    getKnowledgeDocuments(),
    getKnowledgeRequirements(),
    getClearanceSteps(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("notifications")
        .select("id")
        .is("read_at", null);
      if (error) return 0;
      return data?.length ?? 0;
    })(),
    (async () => {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("audit_events")
        .select("id")
        .limit(10);
      if (error) return 0;
      return data?.length ?? 0;
    })(),
  ]);

  const activeEmployees = employees.filter(
    (employee) =>
      String(employee.employment_status ?? "").toLowerCase() === "active",
  ).length;

  const openExitRequests = exitRequests.filter((request) => {
    const status = String(request.status ?? "").toLowerCase();
    return [
      "draft",
      "submitted",
      "under_review",
      "clearance",
      "blocked",
      "eligible_for_finalization",
    ].includes(status);
  }).length;

  const pendingClearanceSteps = clearanceSteps.filter((step) => {
    const status = String(step.status ?? "").toLowerCase();
    return ["pending", "in_progress", "blocked"].includes(status);
  }).length;

  const assignedAssets = assets.filter((asset) => {
    const status = String(asset.status ?? "").toLowerCase();
    return status === "assigned" || status === "in_transit";
  }).length;

  const approvedKnowledgeDocuments = knowledgeDocuments.filter((document) => {
    const status = String(document.status ?? "").toLowerCase();
    return status === "verified" || status === "approved";
  }).length;

  const knowledgeCoverage = knowledgeRequirements.length
    ? Math.round(
        (approvedKnowledgeDocuments / knowledgeRequirements.length) * 100,
      )
    : 0;

  const returnedAssets = assets.filter((asset) => {
    const status = String(asset.status ?? "").toLowerCase();
    return status === "verified";
  }).length;

  const assetRecoveryRate = assets.length
    ? Math.round((returnedAssets / assets.length) * 100)
    : 0;

  return {
    totalEmployees: employees.length,
    activeEmployees,
    openExitRequests,
    pendingClearanceSteps,
    assignedAssets,
    knowledgeDocuments: knowledgeDocuments.length,
    knowledgeCoverage,
    assetRecoveryRate,
    unreadNotifications: notifications,
    recentAuditEvents: auditEvents,
  };
}

export async function getReportDashboardSnapshot(): Promise<ReportDashboardSnapshot> {
  const [
    employees,
    exitRequests,
    assets,
    knowledgeDocuments,
    knowledgeRequirements,
    clearanceSteps,
  ] = await Promise.all([
    getEmployees(),
    getExitRequests(),
    getAssets(),
    getKnowledgeDocuments(),
    getKnowledgeRequirements(),
    getClearanceSteps(),
  ]);

  const activeEmployees = employees.filter(
    (employee) =>
      String(employee.employment_status ?? "").toLowerCase() === "active",
  ).length;

  const exitingEmployees = employees.filter((employee) => {
    const status = String(employee.employment_status ?? "").toLowerCase();
    return (
      status === "exiting" || status === "resigned" || status === "departing"
    );
  }).length;

  const openExitRequests = exitRequests.filter((request) => {
    const status = String(request.status ?? "").toLowerCase();
    return [
      "draft",
      "submitted",
      "under_review",
      "clearance",
      "blocked",
      "eligible_for_finalization",
    ].includes(status);
  }).length;

  const completedExits = exitRequests.filter((request) => {
    const status = String(request.status ?? "").toLowerCase();
    return status === "completed" || status === "finalized";
  }).length;

  const pendingClearanceSteps = clearanceSteps.filter((step) => {
    const status = String(step.status ?? "").toLowerCase();
    return ["pending", "in_progress", "blocked"].includes(status);
  }).length;

  const approvedClearanceSteps = clearanceSteps.filter((step) => {
    const status = String(step.status ?? "").toLowerCase();
    return status === "approved";
  }).length;

  const approvedKnowledgeDocuments = knowledgeDocuments.filter((document) => {
    const status = String(document.status ?? "").toLowerCase();
    return status === "verified" || status === "approved";
  }).length;

  const knowledgeCoverage = knowledgeRequirements.length
    ? Math.round(
        (approvedKnowledgeDocuments / knowledgeRequirements.length) * 100,
      )
    : 0;

  const returnedAssets = assets.filter((asset) => {
    const status = String(asset.status ?? "").toLowerCase();
    return status === "verified";
  }).length;

  const assetRecoveryRate = assets.length
    ? Math.round((returnedAssets / assets.length) * 100)
    : 0;

  const totalEmployees = employees.length;
  const employeeExitTotal = exitRequests.filter((request) => {
    const status = String(request.status ?? "").toLowerCase();
    return (
      status === "completed" ||
      status === "rejected" ||
      status === "cancelled" ||
      status === "finalized"
    );
  }).length;
  const currentYearAttritionRate = totalEmployees
    ? Math.round((employeeExitTotal / totalEmployees) * 100)
    : 0;

  return {
    employees,
    exitRequests,
    assets,
    knowledgeDocuments,
    knowledgeRequirements,
    clearanceSteps,
    totalEmployees,
    activeEmployees,
    exitingEmployees,
    openExitRequests,
    completedExits,
    pendingClearanceSteps,
    approvedClearanceSteps,
    knowledgeCoverage,
    assetRecoveryRate,
    assetRecoveryCount: returnedAssets,
    currentYearAttritionRate,
  };
}

export type SystemUserRecord = {
  id?: string | null;
  full_name?: string | null;
  role?: string | null;
  active?: boolean | null;
  department_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export async function getSystemUsers(): Promise<SystemUserRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, active, department_id, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Unable to load system users: ${error.message}`);
  return (data ?? []) as SystemUserRecord[];
}

export function friendlyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load Supabase records.";
}
