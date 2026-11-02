import {
  DashboardShell,
  EmptyState,
  PageFrame,
} from "@/components/dashboard-shell";
import {
  HandoverDownloadButton,
  HandoverGuideForm,
  HandoverGuideShareForm,
} from "@/components/retention-forms";
import { getRoleKey } from "@/lib/role-utils";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

type EmployeeRow = {
  id: string;
  employee_number: string;
  full_name: string;
  user_id: string | null;
  employment_status: string;
};

function assertLoaded<T>(result: { data: T | null; error: { code?: string } | null }, label: string) {
  if (result.error) {
    console.error(`Unable to load ${label}.`, { code: result.error.code });
    throw new Error(`Unable to load ${label}. Check that the handover-guide migration is applied.`);
  }
  return result.data;
}

export default async function Page() {
  const context = await resolveDashboardUserContext();
  const role = getRoleKey(context.userRole);
  const isHr = role === "hr" || role === "administrator";

  const supabase = await createClient();
  const [employeeResult, guideResult] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_number, full_name, user_id, employment_status")
      .order("full_name"),
    supabase
      .from("handover_guides")
      .select("id, employee_id, title, version, created_at, review_due_on, reminder_sent_at")
      .order("created_at", { ascending: false }),
  ]);
  const employees = (assertLoaded(employeeResult, "employee records") ?? []) as EmployeeRow[];
  const guides = assertLoaded(guideResult, "private handover guides") ?? [];
  const { data: shareRows, error: shareError } = isHr
    ? { data: [], error: null }
    : await supabase.from("handover_guide_shares").select("guide_id");
  if (shareError) {
    console.error("Unable to load successor guide shares.", { code: shareError.code });
    throw new Error("Unable to load the guides shared with your account.");
  }
  const sharedGuideIds = new Set((shareRows ?? []).map((share) => share.guide_id));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const currentEmployeeId = employees.find((employee) => employee.user_id === context.user.id)?.id;

  return (
    <DashboardShell userName={context.userName} userRole={context.userRole}>
      <PageFrame
        title="Work handover guides"
        description="Keep practical job knowledge with the employee record and make the latest guide available to an authorised successor."
      >
        <div className="grid gap-6">
          <section className="rounded-2xl bg-primary/5 p-5 md:p-6">
            <h2 className="text-base font-semibold">Private, versioned job knowledge</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Files are stored in a private Supabase bucket. Only the guide’s employee and HR staff can request a five-minute download link. Uploading an update creates a new version and keeps the previous versions available to HR.
            </p>
          </section>

          <HandoverGuideForm
            employees={isHr ? employees : []}
            isHr={isHr}
          />

          {isHr && (
            <HandoverGuideShareForm
              guides={guides}
              employees={employees
                .filter((employee) => employee.user_id && employee.employment_status !== "exited")
                .map(({ id, full_name, employee_number }) => ({ id, full_name, employee_number }))}
            />
          )}

          <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">
                {isHr ? "Employee guide library" : "My handover guides"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Previous versions are retained to preserve the handover history.
              </p>
            </div>
            {guides.length ? (
              <div className="grid gap-3">
                {guides.map((guide) => {
                  const employee = employeeById.get(guide.employee_id);
                  return (
                    <article
                      key={guide.id}
                      className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{guide.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {isHr
                            ? `${employee?.full_name ?? "Employee"} · ${employee?.employee_number ?? "-"} · `
                            : guide.employee_id === currentEmployeeId
                              ? "My guide · "
                              : sharedGuideIds.has(guide.id)
                                ? "Shared with me · "
                                : ""}
                          Version {guide.version} · Updated{" "}
                            {new Date(guide.created_at).toLocaleDateString()} · Review due{" "}
                            {new Date(`${guide.review_due_on}T12:00:00`).toLocaleDateString()}
                        </p>
                      </div>
                      <HandoverDownloadButton id={guide.id} />
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                label="handover guides"
                description={isHr
                  ? "Employees can upload their work instructions, or HR can record a guide for them."
                  : "Upload a concise guide to recurring tasks, key contacts, systems, and deadlines for your role."}
              />
            )}
          </section>

          {isHr && employees.length === 0 && (
            <EmptyState
              label="employee records"
              description="Add employee records before uploading guides on behalf of staff."
            />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
