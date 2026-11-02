"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getRoleKey } from "@/lib/role-utils";
import { hashSurveyToken } from "@/lib/supabase/retention-tokens";

export type RetentionActionResult = {
  ok: boolean;
  message: string;
};

const failed = (message: string): RetentionActionResult => ({ ok: false, message });
const succeeded = (message: string): RetentionActionResult => ({ ok: true, message });

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
  if (actor.role !== "hr" && actor.role !== "administrator") {
    throw new Error("Only HR staff can manage this information.");
  }
  return actor;
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase.from("audit_events").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata,
  });
  if (error) {
    console.error("Could not write HR workflow audit event.", {
      action,
      entityType,
      code: error.code,
    });
    throw new Error(
      "The change was saved, but its audit event could not be recorded. Do not retry; contact an administrator.",
    );
  }
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("The CSV has an unclosed quoted field.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function parseBooleanCell(value: string, label: string, rowNumber: number) {
  if (!value) return false;
  if (["true", "yes", "1"].includes(value.toLowerCase())) return true;
  if (["false", "no", "0"].includes(value.toLowerCase())) return false;
  throw new Error(`CSV row ${rowNumber}: ${label} must be yes or no.`);
}

export async function importPastExitCsv(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase } = await requireHr();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 1_000_000) {
      return failed("Choose a CSV file smaller than 1 MB.");
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return failed("The historical import must be a .csv file.");
    }

    const rows = parseCsv(await file.text());
    if (rows.length < 2) return failed("The CSV needs a header and at least one data row.");
    if (rows.length > 501) return failed("Import up to 500 historical exits at a time.");

    const headers = rows[0].map((header) => header.trim().toLowerCase());
    const required = ["employee_number", "full_name", "staff_category", "exit_date", "reason_category"];
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) {
      return failed(`Missing required CSV columns: ${missing.join(", ")}.`);
    }

    const records = rows.slice(1).map((cells, index) => {
      const rowNumber = index + 2;
      const value = (key: string) => {
        const column = headers.indexOf(key);
        return column < 0 ? "" : (cells[column] ?? "").trim();
      };
      const employeeNumber = value("employee_number");
      const fullName = value("full_name");
      const staffCategory = value("staff_category").toLowerCase();
      const exitDate = value("exit_date");
      const reasonCategory = value("reason_category");
      if (!employeeNumber || !fullName || !exitDate || !reasonCategory) {
        throw new Error(`CSV row ${rowNumber}: employee number, name, exit date, and reason are required.`);
      }
      if (!["academic", "non_academic"].includes(staffCategory)) {
        throw new Error(`CSV row ${rowNumber}: staff_category must be academic or non_academic.`);
      }
      for (const [label, date] of [["exit_date", exitDate], ["joined_on", value("joined_on")]] as const) {
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(`CSV row ${rowNumber}: ${label} must use YYYY-MM-DD.`);
        }
      }
      return {
        employee_number: employeeNumber,
        full_name: fullName,
        email: value("email"),
        staff_category: staffCategory,
        department: value("department"),
        job_title: value("job_title"),
        employment_type: value("employment_type"),
        joined_on: value("joined_on"),
        exit_date: exitDate,
        reason_category: reasonCategory,
        reason_text: value("reason_text"),
        good_standing: parseBooleanCell(value("good_standing"), "good_standing", rowNumber),
        open_to_return: parseBooleanCell(value("open_to_return"), "open_to_return", rowNumber),
      };
    });

    const { data: importedCount, error } = await supabase.rpc("import_past_exits", {
      p_records: records,
    });
    if (error) {
      console.error("Historical exit import failed.", { code: error.code });
      return failed(error.message.includes("row ")
        ? error.message
        : "Historical exits could not be imported. Confirm the latest database migration is applied and department names match.");
    }
    revalidatePath("/dashboard/retention");
    revalidatePath("/dashboard/reports");
    return succeeded(`Imported ${importedCount} historical exit record${importedCount === 1 ? "" : "s"}.`);
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to import historical exits.");
  }
}

export async function saveExitInterview(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase, user } = await requireHr();
    const exitCaseId = String(formData.get("exit_case_id") ?? "");
    const interviewDate = String(formData.get("interview_date") ?? "");
    const responses = {
      reason_for_leaving: String(formData.get("reason_for_leaving") ?? "").trim(),
      university_improvements: String(formData.get("university_improvements") ?? "").trim(),
      role_experience: String(formData.get("role_experience") ?? "").trim(),
      additional_comments: String(formData.get("additional_comments") ?? "").trim(),
    };
    if (!exitCaseId || !/^\d{4}-\d{2}-\d{2}$/.test(interviewDate) || !responses.reason_for_leaving) {
      return failed("Select an exit case, interview date, and primary reason for leaving.");
    }
    if (Object.values(responses).some((value) => value.length > 2000)) {
      return failed("Each interview response must be 2,000 characters or fewer.");
    }
    const wouldReturnValue = String(formData.get("would_return") ?? "");
    const wouldReturn =
      wouldReturnValue === "yes" ? true : wouldReturnValue === "no" ? false : null;

    const { data: exitCase, error: caseError } = await supabase
      .from("exit_cases")
      .select("id, status")
      .eq("id", exitCaseId)
      .maybeSingle();
    if (caseError || !exitCase || !["completed", "finalized"].includes(exitCase.status)) {
      return failed("Exit interviews can only be recorded for a completed HR exit case.");
    }

    const { data, error } = await supabase
      .from("exit_interviews")
      .upsert(
        {
          exit_case_id: exitCaseId,
          interviewer_id: user.id,
          interview_date: interviewDate,
          responses,
          would_return: wouldReturn,
        },
        { onConflict: "exit_case_id" },
      )
      .select("id")
      .single();
    if (error) return failed("Unable to save the structured exit interview.");
    await writeAudit(supabase, user.id, "recorded", "exit_interview", data.id);
    revalidatePath("/dashboard/retention");
    return succeeded("Exit interview saved.");
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to save the exit interview.");
  }
}

export async function updateExitRehireDetails(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase, user } = await requireHr();
    const exitCaseId = String(formData.get("exit_case_id") ?? "");
    const goodStanding = formData.get("good_standing") === "on";
    const openToReturn = formData.get("open_to_return") === "on";
    if (!exitCaseId || (openToReturn && !goodStanding)) {
      return failed("A former employee must be in good standing before being marked open to return.");
    }

    const { data: exitCase, error: caseError } = await supabase
      .from("exit_cases")
      .select("id, status")
      .eq("id", exitCaseId)
      .maybeSingle();
    if (caseError || !exitCase || !["completed", "finalized"].includes(exitCase.status)) {
      return failed("Only a completed exit can be added to the rehire pool.");
    }

    const { error } = await supabase
      .from("exit_cases")
      .update({ good_standing: goodStanding, open_to_return: openToReturn })
      .eq("id", exitCaseId);
    if (error) return failed("Unable to update former-employee rehire eligibility.");
    await writeAudit(supabase, user.id, "updated", "rehire_eligibility", exitCaseId, {
      goodStanding,
      openToReturn,
    });
    revalidatePath("/dashboard/retention");
    return succeeded("Rehire eligibility updated.");
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to update rehire eligibility.");
  }
}

export async function createRetentionFollowup(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase, user } = await requireHr();
    const employeeId = String(formData.get("employee_id") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    const followUpOn = String(formData.get("follow_up_on") ?? "") || null;
    if (!employeeId || !reason || reason.length > 1000) {
      return failed("Select an employee and enter a follow-up reason of up to 1,000 characters.");
    }
    const { data, error } = await supabase
      .from("retention_followup_flags")
      .insert({
        employee_id: employeeId,
        reason,
        follow_up_on: followUpOn,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) return failed("Unable to create the HR follow-up record.");
    await writeAudit(supabase, user.id, "created", "retention_followup_flag", data.id);
    revalidatePath("/dashboard/retention");
    return succeeded("HR follow-up recorded.");
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to create the follow-up.");
  }
}

export async function updateRetentionFollowup(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase, user } = await requireHr();
    const id = String(formData.get("flag_id") ?? "");
    const status = String(formData.get("status") ?? "");
    const outcome = String(formData.get("outcome") ?? "").trim();
    if (!id || !["open", "in_progress", "resolved"].includes(status)) {
      return failed("Choose a valid follow-up status.");
    }
    if (status === "resolved" && !outcome) {
      return failed("Add an outcome before resolving the follow-up.");
    }
    const { error } = await supabase
      .from("retention_followup_flags")
      .update({ status, outcome: outcome || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return failed("Unable to update the HR follow-up.");
    await writeAudit(supabase, user.id, "updated", "retention_followup_flag", id, { status });
    revalidatePath("/dashboard/retention");
    return succeeded("Follow-up updated.");
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to update the follow-up.");
  }
}

export async function runRetentionEarlyWarningAnalysis(): Promise<RetentionActionResult> {
  try {
    const { supabase } = await requireHr();
    const { data: baselineCount, error: baselineError } = await supabase.rpc(
      "compute_retention_baseline",
    );
    if (baselineError) {
      console.error("Could not compute the retention analysis baseline.", {
        code: baselineError.code,
      });
      return failed(baselineError.message);
    }

    const { data: flagCount, error: flagError } = await supabase.rpc(
      "refresh_early_warning_flags",
    );
    if (flagError) {
      console.error("Could not refresh early-warning analysis.", {
        code: flagError.code,
      });
      return failed(
        `Baseline updated for ${baselineCount ?? 0} departments, but the early-warning analysis could not be refreshed: ${flagError.message}`,
      );
    }

    revalidatePath("/dashboard/retention");
    revalidatePath("/dashboard/reports");
    return succeeded(
      `Baseline updated for ${baselineCount ?? 0} departments. ${flagCount ?? 0} department${flagCount === 1 ? "" : "s"} currently meet the advisory warning threshold.`,
    );
  } catch (error) {
    return failed(
      error instanceof Error ? error.message : "Unable to run retention analysis.",
    );
  }
}

export async function uploadHandoverGuide(
  formData: FormData,
): Promise<RetentionActionResult> {
  let uploadedPath = "";
  try {
    const { supabase, user, role } = await getActor();
    const title = String(formData.get("title") ?? "").trim();
    const file = formData.get("file");
    const requestedEmployeeId = String(formData.get("employee_id") ?? "");
    const isHr = role === "hr" || role === "administrator";
    if (!title || title.length > 160) return failed("Enter a guide title of up to 160 characters.");
    if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      return failed("Choose a guide smaller than 10 MB.");
    }
    const allowedTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
    ]);
    if (!allowedTypes.has(file.type)) {
      return failed("Upload a PDF, Word document, or plain-text guide.");
    }

    let employeeQuery = supabase
      .from("employees")
      .select("id, user_id")
      .limit(1);
    employeeQuery = isHr
      ? employeeQuery.eq("id", requestedEmployeeId)
      : employeeQuery.eq("user_id", user.id);
    const { data: employee, error: employeeError } = await employeeQuery.maybeSingle();
    if (employeeError || !employee) {
      return failed("Your employee record could not be matched to this guide.");
    }

    const { data: latest, error: latestError } = await supabase
      .from("handover_guides")
      .select("version")
      .eq("employee_id", employee.id)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) return failed("Unable to check the guide version history.");

    const version = (latest?.version ?? 0) + 1;
    const ownerFolder = employee.user_id ?? user.id;
    const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, "_").slice(-120);
    uploadedPath = `${ownerFolder}/${crypto.randomUUID()}/v${version}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("handover-guides")
      .upload(uploadedPath, file, { contentType: file.type, upsert: false });
    if (uploadError) return failed("The private handover guide could not be uploaded.");

    const { data, error } = await supabase
      .from("handover_guides")
      .insert({
        employee_id: employee.id,
        uploaded_by: user.id,
        title,
        storage_path: uploadedPath,
        version,
      })
      .select("id")
      .single();
    if (error) {
      const { error: cleanupError } = await supabase.storage
        .from("handover-guides")
        .remove([uploadedPath]);
      if (cleanupError) {
        console.error("Could not remove an orphaned handover upload.", {
          code: cleanupError.name,
        });
      }
      return failed("The guide file uploaded but its version record could not be saved.");
    }

    uploadedPath = "";
    await writeAudit(supabase, user.id, "uploaded", "handover_guide", data.id, { version });
    revalidatePath("/dashboard/handover");
    return succeeded(`Handover guide version ${version} uploaded.`);
  } catch (error) {
    if (uploadedPath) {
      const supabase = await createClient();
      const { error: cleanupError } = await supabase.storage
        .from("handover-guides")
        .remove([uploadedPath]);
      if (cleanupError) {
        console.error("Could not remove an orphaned handover upload.", {
          code: cleanupError.name,
        });
      }
    }
    return failed(error instanceof Error ? error.message : "Unable to upload the handover guide.");
  }
}

export async function getHandoverGuideUrl(guideId: string) {
  const { supabase } = await getActor();
  const { data: guide, error: guideError } = await supabase
    .from("handover_guides")
    .select("storage_path")
    .eq("id", guideId)
    .maybeSingle();
  if (guideError || !guide) throw new Error("This guide is unavailable to your account.");

  const { data, error } = await supabase.storage
    .from("handover-guides")
    .createSignedUrl(guide.storage_path, 300);
  if (error || !data?.signedUrl) throw new Error("Unable to create a private download link.");
  return data.signedUrl;
}

export async function shareHandoverGuide(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const { supabase, user } = await requireHr();
    const guideId = String(formData.get("guide_id") ?? "");
    const successorId = String(formData.get("successor_employee_id") ?? "");
    if (!guideId || !successorId) return failed("Choose a guide and a successor.");

    const [{ data: guide, error: guideError }, { data: successor, error: successorError }] =
      await Promise.all([
        supabase.from("handover_guides").select("id").eq("id", guideId).maybeSingle(),
        supabase
          .from("employees")
          .select("id, user_id, employment_status")
          .eq("id", successorId)
          .maybeSingle(),
      ]);
    if (guideError || !guide || successorError || !successor?.user_id) {
      return failed("The selected guide or successor is not available.");
    }
    if (successor.employment_status === "exited") {
      return failed("Choose an employee who is currently employed.");
    }

    const { data: existing, error: existingError } = await supabase
      .from("handover_guide_shares")
      .select("id")
      .eq("guide_id", guideId)
      .eq("successor_employee_id", successorId)
      .maybeSingle();
    if (existingError) return failed("Unable to check existing guide access.");
    if (existing) return succeeded("This successor already has guide access.");

    const { data: share, error } = await supabase
      .from("handover_guide_shares")
      .insert({
        guide_id: guideId,
        successor_employee_id: successorId,
        shared_by: user.id,
      })
      .select("id")
      .single();
    if (error) return failed("Unable to share the guide with this successor.");
    await writeAudit(supabase, user.id, "shared", "handover_guide", guideId, {
      successorEmployeeId: successorId,
      shareId: share.id,
    });
    revalidatePath("/dashboard/handover");
    return succeeded("The successor can now access this guide from their Handover guides page.");
  } catch (error) {
    return failed(error instanceof Error ? error.message : "Unable to share the handover guide.");
  }
}

export async function submitPostExitSurvey(
  token: string,
  formData: FormData,
): Promise<RetentionActionResult> {
  if (!/^[a-f0-9]{64}$/.test(token)) return failed("This survey link is invalid or has expired.");
  try {
    const adminClient = createAdminClient();
    const tokenHash = await hashSurveyToken(token);
    const { data: invitation, error: invitationError } = await adminClient
      .from("post_exit_survey_invitations")
      .select("id, status, expires_on, template:post_exit_survey_templates(questions)")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (invitationError) {
      console.error("Unable to verify a post-exit survey submission.", { code: invitationError.code });
      return failed("The survey service is temporarily unavailable.");
    }
    if (!invitation || invitation.status !== "sent" ||
      invitation.expires_on < new Date().toISOString().slice(0, 10)) {
      return failed("This survey link is invalid or has expired.");
    }

    const template = Array.isArray(invitation.template)
      ? invitation.template[0]
      : invitation.template;
    const questions = (Array.isArray(template?.questions) ? template.questions : [])
      .filter((question): question is { key: string; options?: unknown } =>
        typeof question?.key === "string",
      );
    const answers: Record<string, string> = {};
    for (const question of questions) {
      const answer = String(formData.get(question.key) ?? "").trim();
      if (!answer || answer.length > 2000) {
        return failed("Please answer every question using no more than 2,000 characters each.");
      }
      if (
        Array.isArray(question.options) &&
        (!question.options.every((option) => typeof option === "string") ||
          !question.options.includes(answer))
      ) {
        return failed("Choose one of the available options for each selection question.");
      }
      answers[question.key] = answer;
    }
    if (Object.keys(answers).length !== questions.length || questions.length === 0) {
      return failed("The survey questions are unavailable.");
    }

    const confirmedReason = String(formData.get("confirmed_reason") ?? "").trim();
    if (confirmedReason.length > 2000) {
      return failed("The additional reason must be 2,000 characters or fewer.");
    }
    const { data: accepted, error } = await adminClient.rpc("submit_post_exit_survey", {
      p_token_hash: tokenHash,
      p_answers: answers,
      p_confirmed_reason: confirmedReason || null,
    });
    if (error) {
      console.error("Post-exit survey submission failed.", { code: error.code });
      return failed("Your survey could not be submitted. Please try again or contact HR.");
    }
    return accepted
      ? succeeded("Thank you. Your feedback has been submitted.")
      : failed("This survey link has already been used or has expired.");
  } catch (error) {
    console.error("Post-exit survey submission was unavailable.", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return failed("Your survey could not be submitted. Please try again later.");
  }
}
