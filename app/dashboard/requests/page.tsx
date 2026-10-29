import { DashboardShell, EmptyState, PageFrame, Status } from "@/components/dashboard-shell";
import { HrRequestForm, HrRequestUpdateForm } from "@/components/hr-request-form";
import {
  roleHasCapability,
  resolveDashboardUserContext,
} from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  const supabase = await createClient();
  const isHr = roleHasCapability(userRole, "manageHrRequests");
  const { data: requests } = await supabase.from("employee_requests").select("id,request_type,details,status,resolution,created_at,employees!employee_id(full_name,employee_number)").order("created_at", { ascending: false });
  return <DashboardShell userName={userName} userRole={userRole}><PageFrame title={isHr ? "HR requests" : "My HR requests"} description={isHr ? "Assign, respond to, and close employee requests." : "Submit a request to HR and track its progress."}><div className="grid gap-6 xl:grid-cols-[360px_1fr]">{!isHr && <HrRequestForm />}<section className="space-y-3">{requests?.length ? requests.map((request) => { const employee = Array.isArray(request.employees) ? request.employees[0] : request.employees; return <article key={request.id} className="rounded-2xl border bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold capitalize">{request.request_type.replaceAll("_", " ")}</h2>{isHr && <p className="mt-1 text-sm text-muted-foreground">{employee?.employee_number} · {employee?.full_name}</p>}<p className="mt-3 max-w-2xl text-sm text-muted-foreground">{request.details}</p>{request.resolution && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">HR response: {request.resolution}</p>}</div><Status tone={request.status === "resolved" ? "green" : "amber"}>{request.status.replaceAll("_", " ")}</Status></div>{isHr && <div className="mt-4 border-t pt-4"><HrRequestUpdateForm id={request.id} currentStatus={request.status} /></div>}</article>; }) : <EmptyState label="HR requests" />}</section></div></PageFrame></DashboardShell>;
}
