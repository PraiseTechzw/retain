import { PostExitSurveyForm } from "@/components/retention-forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSurveyToken } from "@/lib/supabase/retention-tokens";

type SurveyQuestion = {
  key: string;
  prompt: string;
};

export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return <Unavailable />;

  const adminClient = createAdminClient();
  const { data: invitation, error } = await adminClient
    .from("post_exit_survey_invitations")
    .select("id, wave, status, expires_on, template:post_exit_survey_templates(name, questions)")
    .eq("token_hash", await hashSurveyToken(token))
    .maybeSingle();

  if (error) {
    console.error("Unable to verify a post-exit survey link.", { code: error.code });
    throw new Error("The survey service is temporarily unavailable.");
  }
  if (
    !invitation ||
    invitation.status !== "sent" ||
    invitation.expires_on < new Date().toISOString().slice(0, 10)
  ) {
    return <Unavailable />;
  }

  const template = Array.isArray(invitation.template)
    ? invitation.template[0]
    : invitation.template;
  const questions = (Array.isArray(template?.questions) ? template.questions : [])
    .filter((question): question is SurveyQuestion =>
      typeof question?.key === "string" && typeof question?.prompt === "string",
    );
  if (questions.length === 0) throw new Error("The post-exit survey has no questions configured.");

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground sm:py-16">
      <article className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-card p-5 sm:p-8">
        <p className="text-sm font-medium text-primary">Chinhoyi University of Technology</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Former employee follow-up</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This {invitation.wave}-month follow-up helps HR understand staff departure experiences and improve retention.
        </p>
        <div className="mt-5 rounded-xl bg-muted/50 p-4 text-sm leading-6">
          Your responses are confidential and available to authorised HR staff. This survey is not anonymous. The invitation link is single-use and expires on{" "}
          {new Date(`${invitation.expires_on}T12:00:00`).toLocaleDateString()}.
        </div>
        <PostExitSurveyForm token={token} questions={questions} />
      </article>
    </main>
  );
}

function Unavailable() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <section className="max-w-lg rounded-2xl border border-border/70 bg-card p-7">
        <h1 className="text-2xl font-semibold">Survey link unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          This link may have expired or already been used. Contact the Human Resources Office if you need help.
        </p>
      </section>
    </main>
  );
}
