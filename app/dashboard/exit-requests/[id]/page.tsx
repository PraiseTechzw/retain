import { DashboardShell, PageFrame, Status } from "@/components/dashboard-shell";
import {
  requireDashboardCapability,
  roleHasCapability,
} from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { userName, userRole } =
    await requireDashboardCapability("manageExitCases");
  const { id } = await params;
  const supabase = await createClient();
  const { data: exitCase } = await supabase.from("exit_cases").select("id,status,exit_type,classification,reason,notice_date,last_day,interview_notes,completed_at,employees!employee_id(full_name,employee_number)").eq("id", id).single();
  if (!exitCase) notFound();
  const employee = Array.isArray(exitCase.employees) ? exitCase.employees[0] : exitCase.employees;
  const { data: checklist } = await supabase.from("exit_checklist_items").select("id,label,required,completed_at,notes").eq("exit_case_id", id).order("label");
  const isHr = roleHasCapability(userRole, "manageExitCases");
  return <DashboardShell userName={userName} userRole={userRole}><PageFrame title="HR exit case" description="HR-managed employee exit, interview, and completion checklist."><div className="space-y-6 rounded-2xl border border-border/70 bg-card p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{employee?.full_name ?? "Employee"}</h2><p className="mt-1 text-sm text-muted-foreground">{employee?.employee_number ?? ""} · Last working day: {exitCase.last_day ?? "Not set"}</p></div><Status tone={exitCase.status === "completed" ? "green" : "amber"}>{exitCase.status}</Status></div><div className="grid gap-4 md:grid-cols-3"><Detail label="Exit type" value={exitCase.exit_type.replaceAll("_", " ")} /><Detail label="Classification" value={exitCase.classification} /><Detail label="Notice date" value={exitCase.notice_date ?? "Not recorded"} /></div><Detail label="Reason for leaving" value={exitCase.reason ?? "Not recorded"} /><section><h3 className="font-semibold">HR completion checklist</h3><p className="mt-1 text-sm text-muted-foreground">Only HR manages these internal completion steps.</p><div className="mt-3 space-y-2">{(checklist ?? []).map((item) => <div key={item.id} className="flex items-center justify-between rounded-xl border p-3"><span className="text-sm font-medium">{item.label}</span><Status tone={item.completed_at ? "green" : "amber"}>{item.completed_at ? "completed" : "pending"}</Status></div>)}</div></section>{isHr && <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">HR will complete the checklist and finalise this case. There are no departmental, asset, or clearance steps.</p>}</div></PageFrame></DashboardShell>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-sm capitalize">{value}</p></div>; }
