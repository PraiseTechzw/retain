import { createClient } from "@/lib/supabase/server";

export async function getEmployees() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employees")
    .select(
      "id, employee_number, full_name, email, job_title, employment_status, joined_on, exit_date, departments(name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getExitRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exit_requests")
    .select(
      "id, status, reason, submitted_on, last_day, employees!employee_id(full_name, employee_number)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAssets() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .select(
      "id, asset_tag, asset_type, description, status, returned_at, employees!assigned_to(full_name, employee_number)",
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
      "id, title, category, storage_path, created_at, employees!employee_id(full_name, employee_number)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClearanceSteps() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clearance_steps")
    .select(
      "id, department, status, step_order, comments, exit_requests!exit_request_id(id, employees!employee_id(full_name, employee_number))",
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
