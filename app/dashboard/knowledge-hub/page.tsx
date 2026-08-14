import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  getEmployees,
  getKnowledgeDocuments,
  getKnowledgeDocumentsForEmployee,
  getKnowledgeOverviewForEmployee,
  getKnowledgeRequirementsForEmployee,
  getKnowledgeReviewQueue,
} from "@/lib/supabase/data";

function toneForStatus(status?: string | null) {
  if (status === "approved") return "green";
  if (status === "rejected" || status === "revision_required") return "amber";
  if (status === "pending_review" || status === "submitted") return "blue";
  return "default";
}

export default async function Page() {
  const { userName, userRole, user } = await resolveDashboardUserContext();
  const employeeId = user?.id;
  const isReviewer =
    userRole === "Administrator" ||
    userRole === "HR" ||
    userRole === "ICT" ||
    userRole === "Management";

  const [documents, employeeRows, reviewQueue, requirements, myDocuments] =
    await Promise.all([
      getKnowledgeDocuments(),
      getEmployees(),
      isReviewer ? getKnowledgeReviewQueue() : Promise.resolve([]),
      employeeId
        ? getKnowledgeRequirementsForEmployee(employeeId)
        : Promise.resolve([]),
      employeeId
        ? getKnowledgeDocumentsForEmployee(employeeId)
        : Promise.resolve([]),
    ]);

  const employeeOptions = employeeRows.flatMap((employee) => {
    if (!employee.id || !employee.employee_number || !employee.full_name)
      return [];
    return [
      {
        id: employee.id,
        employee_number: employee.employee_number,
        full_name: employee.full_name,
      },
    ];
  });

  const overview = employeeId
    ? await getKnowledgeOverviewForEmployee(employeeId)
    : {
        totalRequirements: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        completion: 0,
      };

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Knowledge Hub"
        description="Capture and verify the knowledge required to preserve continuity and protect institutional memory."
        action={
          <OperationsPanel mode="knowledge" employees={employeeOptions} />
        }
      >
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Completion
              </p>
              <p className="mt-4 text-3xl font-semibold">
                {overview.completion}%
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {overview.approved} of {overview.totalRequirements} required
                items
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Approved
              </p>
              <p className="mt-4 text-3xl font-semibold">{overview.approved}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Ready for continuity review
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Pending
              </p>
              <p className="mt-4 text-3xl font-semibold">{overview.pending}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Awaiting review or revision
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Rejected
              </p>
              <p className="mt-4 text-3xl font-semibold">{overview.rejected}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Needs re-submission
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Documents
              </p>
              <p className="mt-4 text-3xl font-semibold">{documents.length}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Submitted records
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-lg font-semibold">My Requirements</h2>
                <span className="text-sm text-muted-foreground">
                  {requirements.length} assigned
                </span>
              </div>
              {requirements.length ? (
                <div className="mt-4 space-y-3">
                  {requirements.map((requirement) => {
                    const isComplete = myDocuments.some(
                      (document) =>
                        document.requirement_id === requirement.id &&
                        document.status === "approved",
                    );
                    return (
                      <div
                        key={requirement.id}
                        className="rounded-xl border border-border/70 bg-muted/20 p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{requirement.name}</p>
                          {isComplete ? (
                            <Status tone="green">Complete</Status>
                          ) : (
                            <Status tone="amber">Required</Status>
                          )}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {requirement.description ?? "No description added."}
                        </p>
                        <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                          <span>
                            {requirement.knowledge_categories?.[0]?.name ??
                              "General"}
                          </span>
                          <span>•</span>
                          <span>{requirement.reviewer_role ?? "HR"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState label="knowledge requirements" />
              )}
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="text-lg font-semibold">Pending Review</h2>
              {isReviewer && reviewQueue.length ? (
                <div className="mt-4 space-y-3">
                  {reviewQueue.slice(0, 5).map((document) => {
                    const reviewEmployee = Array.isArray(document.employees)
                      ? (document.employees[0] ?? null)
                      : (document.employees ?? null);
                    return (
                      <Link
                        href={`/dashboard/knowledge-hub/${document.id}`}
                        key={document.id}
                        className="block rounded-xl border border-border/70 bg-muted/20 p-3"
                      >
                        <p className="font-medium">{document.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {reviewEmployee?.full_name ?? "Unknown employee"}
                        </p>
                        <div className="mt-2">
                          <Status tone={toneForStatus(document.status)}>
                            {document.status}
                          </Status>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No items awaiting review for your scope.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">My Documents</h2>
              <Link
                href="/profile"
                className="text-sm font-medium text-primary"
              >
                View profile
              </Link>
            </div>
            {myDocuments.length ? (
              <div className="mt-4 overflow-x-auto">
                <DataTable
                  columns={["Document", "Requirement", "Status", "Updated"]}
                  rows={myDocuments.map((document) => {
                    const requirement = Array.isArray(
                      document.knowledge_requirements,
                    )
                      ? (document.knowledge_requirements[0] ?? null)
                      : (document.knowledge_requirements ?? null);
                    return [
                      <Link
                        key={document.id}
                        href={`/dashboard/knowledge-hub/${document.id}`}
                        className="font-semibold text-foreground hover:text-primary"
                      >
                        {document.title}
                      </Link>,
                      requirement?.name ?? "General",
                      <Status
                        key={`${document.id}-status`}
                        tone={toneForStatus(document.status)}
                      >
                        {document.status ?? "submitted"}
                      </Status>,
                      new Date(
                        document.updated_at ?? document.created_at,
                      ).toLocaleDateString(),
                    ];
                  })}
                />
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="knowledge documents" />
              </div>
            )}
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
