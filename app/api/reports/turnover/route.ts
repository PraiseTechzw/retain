import { requireDashboardCapability } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

type ExportEmployee = {
  id: string;
  employee_number: string;
  full_name: string;
  staff_category: string;
  employment_type: string;
  joined_on: string | null;
  appointment_date: string | null;
  department_id: string | null;
};

type ExportExit = {
  employee_id: string;
  exit_date: string;
  exit_type: string;
  classification: string;
  reason_category: string;
  reason_text: string;
  source: string;
};

function validDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Report dates must use YYYY-MM-DD.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("Report dates must be valid calendar dates.");
  }
  return value;
}

function csvCell(value: string | number | null | undefined) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

export async function GET(request: Request) {
  const { user } = await requireDashboardCapability("viewReports");
  const supabase = await createClient();
  const url = new URL(request.url);
  const from = validDate(url.searchParams.get("from"));
  const to = validDate(url.searchParams.get("to"));
  const departmentFilter = (url.searchParams.get("department") ?? "").trim().toLowerCase();
  if (from && to && from > to) throw new Error("The report start date must be before its end date.");

  const pastExits: Array<{
    employee_id: string;
    exit_date: string;
    reason_category: string;
    reason_text: string | null;
  }> = [];
  for (let offset = 0; offset < 20_000; offset += 1_000) {
    let query = supabase
      .from("past_exit_records")
      .select("employee_id, exit_date, reason_category, reason_text")
      .order("exit_date", { ascending: true })
      .range(offset, offset + 999);
    if (from) query = query.gte("exit_date", from);
    if (to) query = query.lte("exit_date", to);
    const { data, error } = await query;
    if (error) {
      console.error("Turnover CSV could not load historical exits.", { code: error.code });
      throw new Error("Unable to export historical turnover data.");
    }
    pastExits.push(...(data ?? []));
    if ((data?.length ?? 0) < 1_000) break;
    if (offset === 19_000) throw new Error("Narrow the report period; exports are limited to 20,000 exit records.");
  }

  const completedExits: Array<{
    employee_id: string;
    exit_type: string;
    classification: string;
    reason_category: string | null;
    reason: string | null;
    last_day: string | null;
    completed_at: string | null;
    created_at: string;
  }> = [];
  for (let offset = 0; offset < 20_000; offset += 1_000) {
    const { data, error } = await supabase
      .from("exit_cases")
      .select("employee_id, exit_type, classification, reason_category, reason, last_day, completed_at, created_at")
      .in("status", ["completed", "finalized"])
      .order("created_at", { ascending: true })
      .range(offset, offset + 999);
    if (error) {
      console.error("Turnover CSV could not load completed exits.", { code: error.code });
      throw new Error("Unable to export completed exit data.");
    }
    completedExits.push(...(data ?? []));
    if ((data?.length ?? 0) < 1_000) break;
    if (offset === 19_000) throw new Error("Narrow the report period; exports are limited to 20,000 exit records.");
  }

  const records: ExportExit[] = [
    ...pastExits.map((exit) => ({
      employee_id: exit.employee_id,
      exit_date: exit.exit_date,
      exit_type: "Historical",
      classification: "Not recorded",
      reason_category: exit.reason_category,
      reason_text: exit.reason_text ?? "",
      source: "Historical import",
    })),
    ...completedExits.map((exit) => ({
      employee_id: exit.employee_id,
      exit_date: (exit.completed_at ?? exit.last_day ?? exit.created_at).slice(0, 10),
      exit_type: exit.exit_type,
      classification: exit.classification,
      reason_category: exit.reason_category ?? "Not recorded",
      reason_text: exit.reason ?? "",
      source: "HR exit case",
    })),
  ].filter((record) => (!from || record.exit_date >= from) && (!to || record.exit_date <= to));

  const employeeIds = [...new Set(records.map((record) => record.employee_id))];
  const employeeRows: ExportEmployee[] = [];
  for (let offset = 0; offset < employeeIds.length; offset += 500) {
    const batch = employeeIds.slice(offset, offset + 500);
    if (!batch.length) continue;
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_number, full_name, staff_category, employment_type, joined_on, appointment_date, department_id")
      .in("id", batch);
    if (error) {
      console.error("Turnover CSV could not load employee dimensions.", { code: error.code });
      throw new Error("Unable to export employee report dimensions.");
    }
    employeeRows.push(...(data ?? []) as ExportEmployee[]);
  }
  const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee]));
  const departmentIds = [...new Set(employeeRows.flatMap((employee) => employee.department_id ? [employee.department_id] : []))];
  const departments: Array<{ id: string; name: string; school: string | null }> = [];
  for (let offset = 0; offset < departmentIds.length; offset += 500) {
    const batch = departmentIds.slice(offset, offset + 500);
    if (!batch.length) continue;
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, school")
      .in("id", batch);
    if (error) {
      console.error("Turnover CSV could not load department dimensions.", { code: error.code });
      throw new Error("Unable to export department report dimensions.");
    }
    departments.push(...(data ?? []));
  }
  const departmentById = new Map(departments.map((department) => [department.id, department]));

  const rows = records.flatMap((record) => {
    const employee = employeeById.get(record.employee_id);
    const department = employee?.department_id
      ? departmentById.get(employee.department_id)
      : undefined;
    if (departmentFilter && department?.name.toLowerCase() !== departmentFilter &&
      department?.school?.toLowerCase() !== departmentFilter) return [];
    const startDate = employee?.joined_on ?? employee?.appointment_date;
    const tenure = startDate
      ? Math.max(0, (Date.parse(`${record.exit_date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 31_557_600_000)
      : null;
    return [[
      record.exit_date,
      employee?.employee_number ?? "Not linked",
      employee?.full_name ?? "Not linked",
      department?.school ?? "Not recorded",
      department?.name ?? "Unassigned",
      employee?.staff_category ?? "Not recorded",
      employee?.employment_type ?? "Not recorded",
      record.exit_type,
      record.classification,
      record.reason_category,
      record.reason_text,
      tenure == null ? "Not recorded" : tenure.toFixed(1),
      record.source,
    ]];
  });

  const header = [
    "exit_date", "employee_number", "employee_name", "school", "department",
    "staff_category", "employment_type", "exit_type", "classification",
    "reason_category", "reason_text", "tenure_years", "record_source",
  ];
  const csv = [csvRow(header), ...rows.map(csvRow)].join("\r\n");
  const { error: auditError } = await supabase.from("audit_events").insert({
    actor_id: user.id,
    action: "exported",
    entity_type: "turnover_report",
    entity_id: null,
    metadata: {
      record_count: rows.length,
      from,
      to,
      department: departmentFilter || null,
    },
  });
  if (auditError) {
    console.error("Turnover CSV export audit failed.", { code: auditError.code });
    throw new Error("The report export could not be audited and was not completed.");
  }

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cut-turnover-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
