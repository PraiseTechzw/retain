import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { reviewKnowledgeDocument } from "@/lib/supabase/actions";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { userName, userRole } = await resolveDashboardUserContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, description, status, file_name, mime_type, file_size, version, created_at, updated_at, rejection_reason, employee_id, employees!employee_id(full_name, employee_number), knowledge_requirements(name, reviewer_role)",
    )
    .eq("id", id)
    .maybeSingle();

  const canReview =
    userRole === "Administrator" ||
    userRole === "HR" ||
    userRole === "ICT" ||
    userRole === "Management";

  const employee = Array.isArray(document?.employees)
    ? document.employees[0]
    : document?.employees;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title={document?.title ?? "Knowledge document"}
        description="Review the document, validation status, and required handover evidence."
      >
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">
                {document?.title ?? "Document"}
              </h2>
              <Status
                tone={
                  document?.status === "approved"
                    ? "green"
                    : document?.status === "rejected"
                      ? "amber"
                      : "blue"
                }
              >
                {document?.status ?? "pending_review"}
              </Status>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Employee</dt>
                <dd>{employee?.full_name ?? "Unknown"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Requirement</dt>
                <dd>{document?.knowledge_requirements?.name ?? "General"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">File</dt>
                <dd>{document?.file_name ?? "Uploaded file"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Version</dt>
                <dd>{document?.version ?? 1}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd>
                  {document?.updated_at
                    ? new Date(document.updated_at).toLocaleDateString()
                    : "—"}
                </dd>
              </div>
            </dl>

            {document?.description ? (
              <div className="mt-6 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                {document.description}
              </div>
            ) : null}

            {document?.rejection_reason ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-medium">Rejection reason</p>
                <p className="mt-2">{document.rejection_reason}</p>
              </div>
            ) : null}
          </section>

          <aside className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Actions
            </p>
            {canReview ? (
              <form action={reviewKnowledgeDocument} className="mt-4 space-y-4">
                <input type="hidden" name="document_id" value={id} />
                <label className="block text-sm font-medium text-foreground">
                  Decision
                  <select
                    name="action"
                    defaultValue="approved"
                    className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="revision_required">Request revision</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-foreground">
                  Rejection reason
                  <textarea
                    name="rejection_reason"
                    rows={4}
                    placeholder="Add the reason for rejection or revision."
                    className="mt-2 w-full rounded-xl border border-input bg-background p-3 text-sm"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Save decision
                </button>
              </form>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                This document is viewable, but only authorized reviewers can
                make approval decisions.
              </p>
            )}
          </aside>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
