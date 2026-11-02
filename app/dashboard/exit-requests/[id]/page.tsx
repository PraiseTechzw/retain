import { DashboardShell, PageFrame, Status } from "@/components/dashboard-shell";
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, ClipboardCheck, FileText, UserRound } from "lucide-react";
import Link from "next/link";
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
  const { data: exitCase } = await supabase.from("exit_cases").select("id,status,exit_type,classification,reason_category,reason,notice_date,last_day,interview_notes,completed_at,employees!employee_id(full_name,employee_number)").eq("id", id).single();
  if (!exitCase) notFound();
  const employee = Array.isArray(exitCase.employees) ? exitCase.employees[0] : exitCase.employees;
  const { data: checklist } = await supabase.from("exit_checklist_items").select("id,label,required,completed_at,notes").eq("exit_case_id", id).order("label");
  const isHr = roleHasCapability(userRole, "manageExitCases");
  const completedItems = (checklist ?? []).filter((item) => item.completed_at).length;
  const isComplete = ["completed", "finalized"].includes(String(exitCase.status).toLowerCase());
  return <DashboardShell userName={userName} userRole={userRole}><PageFrame title="Exit case details" description="Review the employee departure record and HR completion progress." action={<Link href="/dashboard/exit-requests" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"><ArrowLeft className="size-4" /> Back to exit cases</Link>}><div className="space-y-6">
    <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound className="size-6" /></span>
          <div><p className="text-sm text-muted-foreground">{employee?.employee_number ?? "No employee number"}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">{employee?.full_name ?? "Employee"}</h2><p className="mt-1 text-sm text-muted-foreground">{exitCase.last_day ? `Last working day ${formatDate(exitCase.last_day)}` : "Last working day not set"}</p></div>
        </div>
        <Status tone={isComplete ? "green" : exitCase.status === "under_review" ? "blue" : "amber"}>{String(exitCase.status).replaceAll("_", " ")}</Status>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3"><Detail icon={ClipboardCheck} label="Exit type" value={String(exitCase.exit_type).replaceAll("_", " ")} /><Detail icon={UserRound} label="Classification" value={String(exitCase.classification).replaceAll("_", " ")} /><Detail icon={CalendarDays} label="Notice date" value={exitCase.notice_date ? formatDate(exitCase.notice_date) : "Not recorded"} /></div>
    </section>
    <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-center gap-3"><FileText className="size-5 text-primary" /><div><h2 className="font-semibold">Departure record</h2><p className="mt-1 text-sm text-muted-foreground">The reason captured for turnover analysis.</p></div></div><div className="mt-6 space-y-4"><Detail label="Main reason" value={String(exitCase.reason_category ?? "Not recorded").replaceAll("_", " ")} /><div><p className="text-xs font-medium text-muted-foreground">Additional details</p><p className="mt-2 rounded-xl bg-muted/60 p-4 text-sm leading-6">{exitCase.reason ?? "No additional details were recorded."}</p></div><div><p className="text-xs font-medium text-muted-foreground">Interview notes</p><p className="mt-2 rounded-xl bg-muted/60 p-4 text-sm leading-6">{exitCase.interview_notes ?? "No interview notes were recorded."}</p></div></div></section>
      <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-3"><ClipboardCheck className="size-5 text-primary" /><h2 className="font-semibold">HR completion checklist</h2></div><p className="mt-1 text-sm text-muted-foreground">Internal steps for closing this case.</p></div><span className="text-sm font-semibold tabular-nums">{completedItems}/{checklist?.length ?? 0}</span></div><div className="mt-6 space-y-2">{checklist?.length ? checklist.map((item) => <div key={item.id} className="flex items-start gap-3 rounded-xl border border-border/70 p-3"><span className={item.completed_at ? "text-emerald-600" : "text-muted-foreground"}>{item.completed_at ? <CheckCircle2 className="mt-0.5 size-5" /> : <Circle className="mt-0.5 size-5" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.label}{item.required && <span className="ml-1 text-xs text-muted-foreground">Required</span>}</p>{item.notes && <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.notes}</p>}</div><Status tone={item.completed_at ? "green" : "amber"}>{item.completed_at ? "Complete" : "Pending"}</Status></div>) : <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">No checklist items have been added.</p>}</div>{isHr && <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">HR manages these completion steps. Once the required items are complete, the case can be finalised through the HR workflow.</p>}</section>
    </div>
  </div></PageFrame></DashboardShell>;
}

function Detail({ icon: Icon, label, value }: { icon?: typeof CalendarDays; label: string; value: string }) { return <div className="rounded-xl border border-border/70 p-4">{Icon && <Icon className="size-4 text-primary" aria-hidden="true" />}<p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-sm capitalize">{value}</p></div>; }

function formatDate(value: string) { return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
