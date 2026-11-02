"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRoleKey } from "@/lib/role-utils";
import { createClient } from "@/lib/supabase/server";

export type EmployeeWorkflowResult = {
  ok: boolean;
  message: string;
};

type EngagementQuestion = {
  key: string;
  prompt: string;
  type: "rating";
};

function isEngagementQuestion(value: unknown): value is EngagementQuestion {
  return (
    typeof value === "object" &&
    value !== null &&
    "key" in value &&
    "prompt" in value &&
    "type" in value &&
    typeof value.key === "string" &&
    /^q(?:[1-9]|1[0-2])$/.test(value.key) &&
    typeof value.prompt === "string" &&
    value.type === "rating"
  );
}

const failed = (message: string): EmployeeWorkflowResult => ({ ok: false, message });
const succeeded = (message: string): EmployeeWorkflowResult => ({ ok: true, message });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedDocumentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const documentCategories = new Set(["appointment", "contract", "policy", "other"]);
const retentionStatuses = new Set(["open", "in_progress", "completed", "cancelled"]);

async function getActor() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in before using this feature.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !profile || profile.active !== true) {
    throw new Error("Your active account profile could not be verified.");
  }

  return { supabase, user, role: getRoleKey(profile.role) };
}

async function requireHr() {
  const actor = await getActor();
  if (actor.role !== "hr" && actor.role !== "hr_manager") {
    throw new Error("Only HR staff can manage this information.");
  }
  return actor;
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, string | number | null>,
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) {
    console.error("Could not write employee workflow audit event.", {
      action,
      entityType,
      code: error.code,
    });
    throw new Error(
      "The change was saved, but its audit event could not be recorded. Do not retry; contact an administrator.",
    );
  }
}

function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function parseQuestions(value: FormDataEntryValue | null): EngagementQuestion[] {
  if (typeof value !== "string") throw new Error("Add at least one survey question.");
  const prompts = value
    .split(/\r?\n/)
    .map((prompt) => prompt.trim())
    .filter(Boolean);
  if (prompts.length < 1 || prompts.length > 12) {
    throw new Error("Add between 1 and 12 survey questions.");
  }
  if (prompts.some((prompt) => prompt.length > 240)) {
    throw new Error("Each survey question must be 240 characters or fewer.");
  }
  return prompts.map((prompt, index) => ({
    key: `q${index + 1}`,
    prompt,
    type: "rating",
  }));
}

export async function createEngagementSurvey(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase, user } = await requireHr();
    const title = String(formData.get("title") ?? "").trim();
    const opensOn = String(formData.get("opens_on") ?? "").trim();
    const closesOn = String(formData.get("closes_on") ?? "").trim();
    const questions = parseQuestions(formData.get("questions"));
    if (title.length < 3 || title.length > 160) {
      return failed("The survey title must be between 3 and 160 characters.");
    }
    if (!isRealDate(opensOn) || !isRealDate(closesOn) || closesOn < opensOn) {
      return failed("Choose valid survey dates; the close date cannot be before the open date.");
    }

    const { data, error } = await supabase
      .from("engagement_surveys")
      .insert({
        title,
        opens_on: opensOn,
        closes_on: closesOn,
        questions,
        status: "open",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error("Unable to create the engagement survey.");

    await writeAudit(supabase, user.id, "created", "engagement_survey", data.id, {
      title,
      opens_on: opensOn,
      closes_on: closesOn,
    });
    revalidatePath("/dashboard/engagement");
    return succeeded("Engagement survey created.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the survey.";
    if (message !== "The change was saved, but its audit event could not be recorded. Do not retry; contact an administrator.") {
      console.error("Could not create engagement survey.", error);
    }
    return failed(message);
  }
}

export async function closeEngagementSurvey(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase, user } = await requireHr();
    const surveyId = String(formData.get("survey_id") ?? "").trim();
    if (!uuidPattern.test(surveyId)) return failed("Choose a valid survey.");

    const { data, error } = await supabase
      .from("engagement_surveys")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", surveyId)
      .eq("status", "open")
      .select("id, title")
      .maybeSingle();
    if (error) throw new Error("Unable to close the engagement survey.");
    if (!data) return failed("This survey is already closed or no longer available.");

    await writeAudit(supabase, user.id, "closed", "engagement_survey", data.id, {
      title: data.title,
    });
    revalidatePath("/dashboard/engagement");
    return succeeded("Engagement survey closed.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to close the survey.";
    if (!message.startsWith("The change was saved,")) {
      console.error("Could not close engagement survey.", error);
    }
    return failed(message);
  }
}

export async function submitEngagementSurvey(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase } = await getActor();
    const surveyId = String(formData.get("survey_id") ?? "").trim();
    if (!uuidPattern.test(surveyId)) return failed("Choose a valid survey.");

    const { data: survey, error: surveyError } = await supabase
      .from("engagement_surveys")
      .select("id, questions")
      .eq("id", surveyId)
      .maybeSingle();
    if (surveyError || !survey) {
      return failed("This survey is no longer available.");
    }

    const storedQuestions: unknown = survey.questions;
    if (!Array.isArray(storedQuestions)) {
      return failed("This survey has no valid questions.");
    }
    const questions = storedQuestions.filter(isEngagementQuestion);
    if (!questions.length || questions.length !== storedQuestions.length) {
      return failed("This survey has no valid questions.");
    }
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const answer = String(formData.get(`answer_${question.key}`) ?? "");
      if (!["1", "2", "3", "4", "5"].includes(answer)) {
        return failed("Answer every question before submitting.");
      }
      answers[question.key] = answer;
    }

    const { data: submitted, error } = await supabase.rpc(
      "submit_engagement_survey",
      { p_survey_id: surveyId, p_answers: answers },
    );
    if (error) {
      console.error("Could not submit engagement survey.", { code: error.code });
      return failed("Your response could not be submitted. Confirm the survey is open and try again.");
    }
    if (!submitted) return failed("This survey is closed or you have already responded.");

    revalidatePath("/dashboard/engagement");
    return succeeded("Your response was submitted.");
  } catch (error) {
    console.error("Could not submit engagement survey.", error);
    return failed("Your response could not be submitted. Sign in again and try once more.");
  }
}

export async function createRetentionAction(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase, user } = await requireHr();
    const title = String(formData.get("title") ?? "").trim();
    const concern = String(formData.get("concern") ?? "").trim();
    const dueOn = String(formData.get("due_on") ?? "").trim();
    if (title.length < 3 || title.length > 160) {
      return failed("The action title must be between 3 and 160 characters.");
    }
    if (concern.length < 3 || concern.length > 2000) {
      return failed("Describe the concern in 3 to 2,000 characters.");
    }
    if (dueOn && !isRealDate(dueOn)) return failed("Choose a valid due date.");

    const { data, error } = await supabase
      .from("retention_actions")
      .insert({
        title,
        concern,
        owner_id: user.id,
        due_on: dueOn || null,
        status: "open",
      })
      .select("id")
      .single();
    if (error) throw new Error("Unable to create the retention action.");

    await writeAudit(supabase, user.id, "created", "retention_action", data.id, {
      title,
      due_on: dueOn || null,
    });
    revalidatePath("/dashboard/engagement");
    return succeeded("Retention action created.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create the retention action.";
    if (!message.startsWith("The change was saved,")) {
      console.error("Could not create retention action.", error);
    }
    return failed(message);
  }
}

export async function updateRetentionAction(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase, user } = await requireHr();
    const actionId = String(formData.get("action_id") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const outcome = String(formData.get("outcome") ?? "").trim();
    if (!uuidPattern.test(actionId)) return failed("Choose a valid retention action.");
    if (!retentionStatuses.has(status)) return failed("Choose a valid action status.");
    if (outcome.length > 2000) return failed("Outcome must be 2,000 characters or fewer.");

    const { data, error } = await supabase
      .from("retention_actions")
      .update({ status, outcome: outcome || null })
      .eq("id", actionId)
      .select("id, title")
      .maybeSingle();
    if (error) throw new Error("Unable to update the retention action.");
    if (!data) return failed("This retention action is no longer available.");

    await writeAudit(supabase, user.id, "updated", "retention_action", data.id, {
      title: data.title,
      status,
    });
    revalidatePath("/dashboard/engagement");
    return succeeded("Retention action updated.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the retention action.";
    if (!message.startsWith("The change was saved,")) {
      console.error("Could not update retention action.", error);
    }
    return failed(message);
  }
}

export async function uploadEmployeeDocument(
  formData: FormData,
): Promise<EmployeeWorkflowResult> {
  try {
    const { supabase, user } = await requireHr();
    const employeeId = String(formData.get("employee_id") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim();
    const file = formData.get("file");
    if (!uuidPattern.test(employeeId)) return failed("Choose a valid employee.");
    if (title.length < 1 || title.length > 160) {
      return failed("Document title must be between 1 and 160 characters.");
    }
    if (!documentCategories.has(category)) return failed("Choose a valid document category.");
    if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024) {
      return failed("Choose a document no larger than 10 MB.");
    }
    if (!allowedDocumentTypes.has(file.type)) {
      return failed("Only PDF, Word, or plain-text documents are allowed.");
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
    if (!safeName) return failed("The file name is invalid.");
    const storagePath = `${employeeId}/${randomUUID()}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("employee-hr-documents")
      .upload(storagePath, file, { contentType: file.type, upsert: false });
    if (uploadError) {
      console.error("Could not upload employee document.", { message: uploadError.message });
      return failed("The document could not be uploaded. Check the file type and try again.");
    }

    const { data, error: insertError } = await supabase
      .from("employee_documents")
      .insert({
        employee_id: employeeId,
        uploaded_by: user.id,
        category,
        title,
        file_name: safeName,
        mime_type: file.type,
        storage_path: storagePath,
      })
      .select("id")
      .single();
    if (insertError) {
      const { error: cleanupError } = await supabase.storage
        .from("employee-hr-documents")
        .remove([storagePath]);
      if (cleanupError) {
        console.error("Could not remove orphaned employee document.", {
          code: cleanupError.name,
        });
        throw new Error(
          "The document record failed to save and its uploaded file could not be removed. Contact an administrator.",
        );
      }
      throw new Error("The document record could not be saved.");
    }

    await writeAudit(supabase, user.id, "uploaded", "employee_document", data.id, {
      employee_id: employeeId,
      title,
      category,
    });
    revalidatePath(`/dashboard/employees/${encodeURIComponent(employeeId)}`);
    return succeeded("Employee document uploaded.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to upload the document.";
    if (!message.startsWith("The change was saved,")) {
      console.error("Could not upload employee document.", error);
    }
    return failed(message);
  }
}
