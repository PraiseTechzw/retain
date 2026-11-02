import {
  CloseEngagementSurveyForm,
  EngagementSurveyBuilder,
  EngagementSurveyResponse,
  RetentionActionForm,
  RetentionActionUpdateForm,
  type EngagementQuestion,
  type EngagementSurvey,
  type RetentionAction,
} from "@/components/employee-workflow-forms";
import {
  DashboardShell,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { getRoleKey } from "@/lib/role-utils";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type SurveyAggregate = {
  survey_id: string;
  question_key: string;
  answer_value: string;
  response_count: number;
};

function assertQuery<T>(
  result: { data: T | null; error: { code?: string } | null },
  label: string,
) {
  if (result.error) {
    console.error(`Unable to load ${label}.`, { code: result.error.code });
    throw new Error(`Unable to load ${label}. Apply the latest Supabase migration and try again.`);
  }
  return result.data;
}

function parseQuestions(value: unknown): EngagementQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): EngagementQuestion[] => {
    if (
      typeof item === "object" &&
      item !== null &&
      "key" in item &&
      "prompt" in item &&
      "type" in item &&
      typeof item.key === "string" &&
      typeof item.prompt === "string" &&
      item.type === "rating"
    ) {
      return [{ key: item.key, prompt: item.prompt, type: "rating" }];
    }
    return [];
  });
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString();
}

function StatusLabel({ status }: { status: string }) {
  return (
    <Status tone={status === "completed" || status === "open" ? "green" : "amber"}>
      {status.replaceAll("_", " ")}
    </Status>
  );
}

function SurveySummary({
  survey,
  aggregates,
  responseCount,
}: {
  survey: EngagementSurvey;
  aggregates: SurveyAggregate[];
  responseCount: number;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{survey.title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(survey.opens_on)} – {formatDate(survey.closes_on)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusLabel status={survey.status} />
          <span className="text-sm tabular-nums text-muted-foreground">
            {responseCount} {responseCount === 1 ? "response" : "responses"}
          </span>
        </div>
      </div>
      {survey.status === "open" && (
        <div className="mt-4">
          <CloseEngagementSurveyForm surveyId={survey.id} />
        </div>
      )}
      {responseCount < 5 ? (
        <p className="mt-5 rounded-xl bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
          Response distributions are withheld until at least five employees have responded. Responses are confidential and identified to authorised HR staff; do not describe this survey as anonymous.
        </p>
      ) : (
        <div className="mt-5 grid gap-5">
          {survey.questions.map((question) => {
            const rows = aggregates.filter((row) => row.question_key === question.key);
            const counts = new Map(rows.map((row) => [row.answer_value, row.response_count]));
            return (
              <div key={question.key}>
                <h4 className="text-sm font-semibold">{question.prompt}</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-5">
                  {[
                    ["1", "Strongly disagree"],
                    ["2", "Disagree"],
                    ["3", "Neither"],
                    ["4", "Agree"],
                    ["5", "Strongly agree"],
                  ].map(([value, label]) => (
                    <div key={value} className="rounded-lg bg-muted/45 px-3 py-2">
                      <p className="text-sm font-semibold tabular-nums">
                        {counts.get(value) ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default async function Page() {
  const context = await resolveDashboardUserContext();
  const role = getRoleKey(context.userRole);
  if (role !== "hr" && role !== "administrator") {
    redirect("/dashboard");
  }
  const isHr = true;
  const supabase = await createClient();

  const surveysQuery = supabase
    .from("engagement_surveys")
    .select("id, title, opens_on, closes_on, status, questions")
    .order("opens_on", { ascending: false });
  if (!isHr) surveysQuery.eq("status", "open");

  const surveyResult = await surveysQuery;
  const surveyRows = assertQuery(surveyResult, "engagement surveys") ?? [];
  const surveys: EngagementSurvey[] = surveyRows.map((survey) => ({
    id: survey.id,
    title: survey.title,
    opens_on: survey.opens_on,
    closes_on: survey.closes_on,
    status: survey.status,
    questions: parseQuestions(survey.questions),
  }));
  const surveyIds = surveys.map((survey) => survey.id);

  const employeeResult = isHr
    ? null
    : await supabase
        .from("employees")
        .select("id, employment_status")
        .eq("user_id", context.user.id)
        .maybeSingle();
  const employeeRecord = employeeResult
    ? assertQuery(employeeResult, "your employee record")
    : null;

  const submittedResult =
    !isHr && surveyIds.length
      ? await supabase
          .from("survey_responses")
          .select("survey_id")
          .in("survey_id", surveyIds)
      : null;
  const submittedRows = submittedResult
    ? assertQuery(submittedResult, "your survey responses") ?? []
    : [];
  const submittedSurveyIds = new Set(
    submittedRows.map((response) => response.survey_id),
  );

  let aggregates: SurveyAggregate[] = [];
  let actions: RetentionAction[] = [];
  if (isHr) {
    const [aggregateResult, actionResult] = await Promise.all([
      surveyIds.length
        ? supabase.rpc("get_engagement_survey_aggregates", {
            p_survey_ids: surveyIds,
          })
        : Promise.resolve({
            data: [] as SurveyAggregate[],
            error: null,
          }),
      supabase
        .from("retention_actions")
        .select("id, title, concern, owner_id, due_on, status, outcome, created_at")
        .order("created_at", { ascending: false }),
    ]);
    const aggregateRows =
      assertQuery<SurveyAggregate[]>(aggregateResult, "survey summaries") ?? [];
    aggregates = aggregateRows.map((row) => ({
      survey_id: row.survey_id,
      question_key: row.question_key,
      answer_value: row.answer_value,
      response_count: Number(row.response_count),
    }));
    actions = assertQuery(actionResult, "retention actions") ?? [];
  }

  const responseCounts = new Map<string, number>();
  for (const survey of surveys) {
    const firstQuestion = survey.questions[0]?.key;
    if (!firstQuestion) continue;
    responseCounts.set(
      survey.id,
      aggregates
        .filter((row) => row.survey_id === survey.id && row.question_key === firstQuestion)
        .reduce((total, row) => total + row.response_count, 0),
    );
  }

  return (
    <DashboardShell userName={context.userName} userRole={context.userRole}>
      <PageFrame
        title="Staff engagement"
        description={
          isHr
            ? "Schedule confidential staff feedback and track HR-owned responses to recurring concerns."
            : "Complete available staff surveys and review what has been submitted."
        }
      >
        {isHr ? (
          <div className="grid gap-6">
            <EngagementSurveyBuilder />
            <section className="grid gap-4">
              <div>
                <h2 className="text-xl font-semibold">Survey results</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Results show group counts only. Distribution is withheld below five respondents.
                </p>
              </div>
              {surveys.length ? (
                surveys.map((survey) => (
                  <SurveySummary
                    key={survey.id}
                    survey={survey}
                    aggregates={aggregates.filter((row) => row.survey_id === survey.id)}
                    responseCount={responseCounts.get(survey.id) ?? 0}
                  />
                ))
              ) : (
                <EmptyState
                  label="surveys scheduled"
                  description="Create a survey above to begin collecting staff feedback."
                />
              )}
            </section>

            <RetentionActionForm />
            <section className="grid gap-4">
              <div>
                <h2 className="text-xl font-semibold">Retention actions</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Follow progress and record outcomes without including confidential employee case details.
                </p>
              </div>
              {actions.length ? (
                actions.map((action) => (
                  <article
                    key={action.id}
                    className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold">{action.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                          {action.concern}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusLabel status={action.status} />
                        <span className="text-sm text-muted-foreground">
                          Due {formatDate(action.due_on)}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <RetentionActionUpdateForm action={action} />
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  label="retention actions recorded"
                  description="Create an action when HR decides a recurring concern needs follow-up."
                />
              )}
            </section>
          </div>
        ) : (
          <div className="grid gap-5">
            {employeeRecord?.employment_status === "exited" ? (
              <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                This employee record is no longer active and cannot submit staff surveys.
              </p>
            ) : !employeeRecord ? (
              <p role="alert" className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                No employee record is linked to this account. Contact HR to resolve your staff profile before submitting surveys.
              </p>
            ) : surveys.length ? (
              surveys.map((survey) => (
                <EngagementSurveyResponse
                  key={survey.id}
                  survey={survey}
                  submitted={submittedSurveyIds.has(survey.id)}
                />
              ))
            ) : (
              <EmptyState
                label="open surveys"
                description="When HR schedules a staff survey, it will appear here during its response period."
              />
            )}
          </div>
        )}
      </PageFrame>
    </DashboardShell>
  );
}
