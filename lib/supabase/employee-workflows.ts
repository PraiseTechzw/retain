"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getRoleKey } from "@/lib/role-utils";
import { createClient } from "@/lib/supabase/server";

export type EmployeeWorkflowResult = {
  ok: boolean;
  message: string;
};

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
