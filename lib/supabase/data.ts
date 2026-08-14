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
    normalized.includes("does not exist") &&
    normalized.includes(columnName.toLowerCase())
  );
}

export async function getEmployees() {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("employees")
    .select(
      "id, employee_number, full_name, email, job_title, employment_status, employment_category, joined_on, exit_date, department_id, departments(name)",
    )
    .order("created_at", { ascending: false });

  const { data, error } = await baseQuery;
  if (!error) return data ?? [];

  if (isMissingColumnError(error.message, "employment_category")) {
    const fallback = await supabase
      .from("employees")
      .select(
        "id, employee_number, full_name, email, job_title, employment_status, joined_on, exit_date, department_id, departments(name)",
      )
      .order("created_at", { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  throw new Error(error.message);
}

export async function getExitRequests() {
  const supabase = await createClient();
  const baseQuery = supabase
    .from("exit_requests")
    .select(
      "id, status, reason, submitted_on, created_at, last_day, completed_at, employee_id, employees!employee_id(id, full_name, employee_number, department_id, employment_category, employment_status)",
    )
    .order("created_at", { ascending: false });

  const { data, error } = await baseQuery;
  if (!error) return data ?? [];

  if (isMissingColumnError(error.message, "employment_category")) {
    const fallback = await supabase
      .from("exit_requests")
      .select(
        "id, status, reason, submitted_on, created_at, last_day, completed_at, employee_id, employees!employee_id(id, full_name, employee_number, department_id)",
      )
      .order("created_at", { ascending: false });

    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
  }

  throw new Error(error.message);
}

export async function getAssets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, asset_tag, asset_type, description, status, returned_at, verified_at, assigned_to, employees!assigned_to(full_name, employee_number, department_id)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKnowledgeDocuments() {
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

export async function getKnowledgeRequirements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_requirements")
    .select(
      "id, name, description, is_required, active, reviewer_role, department_id, employment_category, category_id, knowledge_categories(name)",
    )
    .eq("active", true)
    .order("name");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getKnowledgeRequirementsForEmployee(employeeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_requirements")
    .select(
      "id, name, description, is_required, active, reviewer_role, allowed_file_types, max_file_size_mb, knowledge_categories(name, description), department_id, employment_category",
    )
    .eq("active", true)
    .order("name");

  if (error) throw new Error(error.message);

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
      "id, title, status, created_at, description, file_name, version, employee_id, requirement_id, employees!employee_id(full_name, employee_number), knowledge_requirements(name, reviewer_role)",
    )
    .in("status", [
      "submitted",
      "pending_review",
      "revision_required",
      "rejected",
    ])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
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

export async function getClearanceSteps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clearance_steps")
    .select(
      "id, department, status, step_order, comments, exit_request_id, exit_requests!exit_request_id(id, employee_id, status, submitted_on, completed_at)",
    )
    .order("step_order", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
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

export function friendlyError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to load Supabase records.";
}
