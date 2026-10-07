import {
  DashboardShell,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { reviewKnowledgeDocument } from "@/lib/supabase/actions";
import { redirect } from "next/navigation";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, userName, userRole } = await resolveDashboardUserContext();
  const { id } = await params;
  const supabase = await createClient();
  const { data: document } = await supabase
    .from("knowledge_documents")
    .select(
      "id, title, description, status, file_name, mime_type, file_size, version, created_at, updated_at, rejection_reason, employee_id, requirement_id, knowledge_requirements(name, reviewer_role)",
    )
    .eq("id", id)
    .maybeSingle();

  const [{ data: employee }, { data: ownEmployee }, { data: canReviewResult }] =
    document
      ? await Promise.all([
          supabase
            .from("knowledge_review_employee_directory")
            .select("id, full_name, employee_number")
            .eq("id", document.employee_id)
            .maybeSingle(),
          user
            ? supabase
                .from("employees")
                .select("id")
                .eq("user_id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.rpc("can_review_knowledge_document", {
            p_employee_id: document.employee_id,
            p_requirement_id: document.requirement_id,
          }),
        ])
      : [{ data: null }, { data: null }, { data: false }];
  const requirement = Array.isArray(document?.knowledge_requirements)
    ? (document.knowledge_requirements[0] ?? null)
    : (document?.knowledge_requirements ?? null);
  const isReviewer = canReviewResult === true;
  const isOwner = Boolean(document && ownEmployee?.id === document.employee_id);
  if (document && !isOwner && !isReviewer) redirect("/dashboard");
  const canReview = isReviewer && !isOwner;

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
                <dd>{requirement?.name ?? "General"}</dd>
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
