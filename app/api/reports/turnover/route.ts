import { requireDashboardCapability } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

type TurnoverExportRow = {
  quarter_start: string;
  department: string;
  reportable_exits: number;
  active_headcount: number;
  attrition_rate_pct: number | null;
  top_exit_reason: string | null;
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
  const { user, userRole } = await requireDashboardCapability("viewReports");
  if (userRole !== "HR" && userRole !== "HR Manager") {
    return new Response("Only HR staff can export turnover reports.", { status: 403 });
  }

  const url = new URL(request.url);
  const from = validDate(url.searchParams.get("from"));
  const to = validDate(url.searchParams.get("to"));
  const department = (url.searchParams.get("department") ?? "").trim();
  if (from && to && from > to) {
    throw new Error("The report start date must be before its end date.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_turnover_report_export", {
    p_from: from,
    p_to: to,
    p_department: department || null,
  });
  if (error) {
    console.error("Turnover CSV could not load aggregated report data.", {
      code: error.code,
    });
    throw new Error("Unable to export the aggregated turnover report.");
  }

  const rows = (data ?? []) as TurnoverExportRow[];
  const header = [
    "quarter_start",
    "department",
    "reportable_exits",
    "average_active_headcount",
    "attrition_rate_pct",
    "top_exit_reason",
  ];
  const csv = [
    csvRow(header),
    ...rows.map((row) =>
      csvRow([
        row.quarter_start,
        row.department,
        row.reportable_exits,
        row.active_headcount,
        row.attrition_rate_pct,
        row.top_exit_reason,
      ]),
    ),
  ].join("\r\n");

  const { error: auditError } = await supabase.from("audit_events").insert({
    actor_id: user.id,
    action: "exported",
    entity_type: "turnover_report",
    entity_id: null,
    metadata: {
      group_count: rows.length,
      from,
      to,
      department: department || null,
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
