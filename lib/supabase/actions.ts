"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";

const DEFAULT_CLEARANCE_DEPARTMENTS = [
  "ICT",
  "Library",
  "Finance",
  "Department head",
  "Knowledge",
];

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) throw new Error("Email and password are required.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role =
    String(formData.get("role") ?? appConfig.defaultRole).trim() ||
    appConfig.defaultRole;

  if (!fullName || !email || !password)
    throw new Error("Full name, email, and password are required.");
  if (password.length < 8)
    throw new Error("Password must be at least 8 characters long.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role,
      },
    },
  });

  if (error) throw new Error(error.message);
  if (data.user && !data.session) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent("Check your email to confirm your account."),
    );
  }

  redirect("/dashboard");
}

export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) throw new Error("Email is required.");

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  });

  if (error) throw new Error(error.message);
  redirect(
    "/auth/login?message=" + encodeURIComponent("Password reset email sent."),
  );
}

async function actor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("You must be signed in to continue.");
  return { supabase, user };
}

type ClearanceStep = { department: string; status: string; comments?: string };
type AssetRow = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
};

async function audit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_events").insert({
    actor_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata,
  });
}

export async function createEmployee(formData: FormData) {
  const { supabase, user } = await actor();
  const employee = {
    employee_number: String(formData.get("employee_number") ?? "").trim(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim() || null,
    job_title: String(formData.get("job_title") ?? "").trim() || null,
    employment_status: "active",
  };
  if (!employee.employee_number || !employee.full_name)
    throw new Error("Employee number and full name are required.");
  const { data, error } = await supabase
    .from("employees")
    .insert(employee)
    .select("id")
    .single();
  if (error) throw new Error("Unable to create employee record.");
  await audit(supabase, user.id, "created", "employee", data.id, {
    employee_number: employee.employee_number,
  });
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard");
}

export async function createExitRequest(formData: FormData) {
  const { supabase, user } = await actor();
  const employeeId = String(formData.get("employee_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const lastDay = String(formData.get("last_day") ?? "") || null;
  if (!employeeId || !reason)
    throw new Error("Employee and reason are required.");
  const { data, error } = await supabase
    .from("exit_requests")
    .insert({ employee_id: employeeId, reason, last_day: lastDay })
    .select("id")
    .single();
  if (error) throw new Error("Unable to submit exit request.");
  await audit(supabase, user.id, "created", "exit_request", data.id);
  // Automatically create clearance workflow using default departments
  try {
    await createClearanceSteps(data.id, DEFAULT_CLEARANCE_DEPARTMENTS);
  } catch (err) {
    // If step creation fails, audit but don't block exit request creation
    await audit(supabase, user.id, "warn", "clearance_steps", data.id, {
      message: "Unable to create default clearance steps",
      error: err instanceof Error ? err.message : String(err),
    });
  }
  revalidatePath("/dashboard/exit-requests");
  revalidatePath("/dashboard");
}

export async function updateAssetStatus(formData: FormData) {
  const { supabase, user } = await actor();
  const id = String(formData.get("asset_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["assigned", "available", "returned", "retired"].includes(status))
    throw new Error("Invalid asset update.");
  const { error } = await supabase
    .from("assets")
    .update({
      status,
      returned_at: status === "returned" ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) throw new Error("Unable to update asset status.");
  await supabase.from("asset_history").insert({
    asset_id: id,
    action: status,
    actor_id: user.id,
    notes: "Status updated from operations workspace.",
  });
  await audit(supabase, user.id, "updated", "asset", id, { status });
  revalidatePath("/dashboard/assets");
  revalidatePath("/dashboard/assets/returns");
}

export async function approveClearance(formData: FormData) {
  const { supabase, user } = await actor();
  const id = String(formData.get("clearance_id") ?? "");
  if (!id) throw new Error("Clearance step is required.");
  // Role-based check: only allow department officers or admins/HR
  const { data: stepData } = await supabase
    .from("clearance_steps")
    .select("id,department,exit_request_id")
    .eq("id", id)
    .single();
  const stepDept = stepData?.department ?? "";
  const _meta = user.user_metadata as Record<string, unknown> | undefined;
  const userRole =
    typeof _meta?.role === "string" ? (_meta.role as string) : undefined;
  const allowed =
    userRole === appConfig.defaultRole ||
    (userRole && userRole.toLowerCase().includes(stepDept.toLowerCase())) ||
    userRole?.toLowerCase().includes("hr");
  if (!allowed)
    throw new Error("You are not authorized to approve this clearance.");

  const { data, error } = await supabase
    .from("clearance_steps")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .single();
  if (error) throw new Error("Unable to approve clearance step.");
  await audit(supabase, user.id, "approved", "clearance_step", data.id);
  revalidatePath("/dashboard/clearances");
}

// Helper: check blockers for an exit request
export async function checkExitBlockers(exitRequestId: string) {
  const supabase = await createClient();
  // Get exit request and employee
  const { data: exitReq, error: exitErr } = await supabase
    .from("exit_requests")
    .select("id, employee_id, status")
    .eq("id", exitRequestId)
    .single();
  if (exitErr || !exitReq) throw new Error("Exit request not found.");

  const employeeId = exitReq.employee_id;

  // Clearance steps pending/rejected
  const { data: steps } = await supabase
    .from("clearance_steps")
    .select("department,status,comments")
    .eq("exit_request_id", exitRequestId)
    .order("step_order", { ascending: true });

  const pending = (steps ?? []).filter(
    (s: ClearanceStep) => s.status !== "approved",
  );

  // Outstanding assets assigned to employee (not returned)
  const { data: assets } = await supabase
    .from("assets")
    .select("id,asset_tag,asset_type,status")
    .eq("assigned_to", employeeId);
  const outstandingAssets = (assets ?? []).filter(
    (a: AssetRow) => a.status !== "returned",
  );

  // Knowledge documents count
  const { data: docs } = await supabase
    .from("knowledge_documents")
    .select("id")
    .eq("employee_id", employeeId);

  const blockers: Record<string, unknown> = {};
  if (pending.length)
    blockers.clearance = pending.map((p: ClearanceStep) => ({
      department: p.department,
      status: p.status,
      comments: p.comments,
    }));
  if (outstandingAssets.length)
    blockers.assets = outstandingAssets.map((a: AssetRow) => ({
      id: a.id,
      tag: a.asset_tag,
      type: a.asset_type,
      status: a.status,
    }));
  if (!docs || docs.length === 0) blockers.knowledge = "no_documents";

  return { blocked: Object.keys(blockers).length > 0, blockers };
}

export async function finalizeExit(formData: FormData | string) {
  const isString = typeof formData === "string";
  const exitRequestId = isString
    ? (formData as string)
    : String((formData as FormData).get("exit_request_id") ?? "");
  if (!exitRequestId) throw new Error("Exit request is required.");
  const { supabase, user } = await actor();

  // Role check: only Administrators or HR roles
  const _meta2 = user.user_metadata as Record<string, unknown> | undefined;
  const userRole =
    typeof _meta2?.role === "string" ? (_meta2.role as string) : undefined;
  if (
    !userRole ||
    (!userRole.toLowerCase().includes("admin") &&
      !userRole.toLowerCase().includes("hr"))
  ) {
    throw new Error("You are not authorized to finalize exits.");
  }

  // Re-check blockers
  const { blocked, blockers } = await checkExitBlockers(exitRequestId);
  if (blocked) {
    await audit(
      supabase,
      user.id,
      "finalization_blocked",
      "exit_request",
      exitRequestId,
      { blockers },
    );
    return { success: false, blockers };
  }

  // Proceed to finalize
  const now = new Date().toISOString();
  const { data: exitReq, error: exitErr } = await supabase
    .from("exit_requests")
    .update({ status: "completed", completed_at: now, finalized_by: user.id })
    .eq("id", exitRequestId)
    .select("id,employee_id")
    .single();
  if (exitErr || !exitReq) throw new Error("Unable to finalize exit request.");

  // Update employee status
  const { error: empErr } = await supabase
    .from("employees")
    .update({ employment_status: "exited", exit_date: now })
    .eq("id", exitReq.employee_id);
  if (empErr) throw new Error("Unable to update employee status.");

  await audit(supabase, user.id, "finalized", "exit_request", exitRequestId);
  // Optionally trigger notifications here (left as an integration point)
  revalidatePath("/dashboard/exit-requests");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function uploadKnowledgeDocument(formData: FormData) {
  const { supabase, user } = await actor();
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "");
  if (!(file instanceof File) || file.size === 0 || !title || !employeeId)
    throw new Error("Title, employee, and a file are required.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Files must be smaller than 10 MB.");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `private/${employeeId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("knowledge-documents")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error("Unable to upload document.");
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      employee_id: employeeId,
      title,
      storage_path: path,
      category: String(formData.get("category") ?? "").trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from("knowledge-documents").remove([path]);
    throw new Error("Unable to save document record.");
  }
  await audit(supabase, user.id, "uploaded", "knowledge_document", data.id, {
    title,
  });
  revalidatePath("/dashboard/knowledge-hub");
}

export async function getKnowledgeDownloadUrl(id: string) {
  const { supabase } = await actor();
  const { data: document, error } = await supabase
    .from("knowledge_documents")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (error || !document) throw new Error("Document not found.");
  const { data, error: urlError } = await supabase.storage
    .from("knowledge-documents")
    .createSignedUrl(document.storage_path, 300);
  if (urlError || !data?.signedUrl)
    throw new Error("Unable to prepare document download.");
  return data.signedUrl;
}

export async function getEmployeeOptions() {
  const { supabase } = await actor();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_number, full_name")
    .eq("employment_status", "active")
    .order("full_name");
  if (error) throw new Error("Unable to load employees.");
  return data ?? [];
}

export async function getCurrentUser() {
  const { user } = await actor();
  return { id: user.id, email: user.email ?? "" };
}

export async function signOut() {
  const { supabase } = await actor();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/auth/login");
}

export async function createClearanceSteps(
  exitRequestId: string,
  departments: string[],
) {
  const { supabase, user } = await actor();
  const rows = departments.map((department, index) => ({
    exit_request_id: exitRequestId,
    department,
    step_order: index + 1,
  }));
  const { error } = await supabase
    .from("clearance_steps")
    .upsert(rows, { onConflict: "exit_request_id,department" });
  if (error) throw new Error("Unable to create clearance steps.");
  await audit(supabase, user.id, "created", "clearance_steps", exitRequestId, {
    departments,
  });
  revalidatePath("/dashboard/clearances");
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await actor();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) throw new Error("Full name is required.");
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, full_name: fullName });
  if (error) throw new Error("Unable to update profile.");
  await audit(supabase, user.id, "updated", "profile", user.id);
  revalidatePath("/profile");
}

export async function createInterview(formData: FormData) {
  const { supabase, user } = await actor();
  const exitRequestId = String(formData.get("exit_request_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const scheduledFor = String(formData.get("scheduled_for") ?? "") || null;
  if (!exitRequestId) throw new Error("Exit request is required.");
  const { data, error } = await supabase
    .from("exit_interviews")
    .insert({
      exit_request_id: exitRequestId,
      interviewer_id: user.id,
      scheduled_for: scheduledFor,
      notes,
    })
    .select("id")
    .single();
  if (error) throw new Error("Unable to schedule interview.");
  await audit(supabase, user.id, "scheduled", "exit_interview", data.id);
  revalidatePath(`/dashboard/exit-requests/${exitRequestId}`);
}

export async function createAsset(formData: FormData) {
  const { supabase, user } = await actor();
  const asset = {
    asset_tag: String(formData.get("asset_tag") ?? "").trim(),
    asset_type: String(formData.get("asset_type") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    status: "available",
  };
  if (!asset.asset_tag || !asset.asset_type)
    throw new Error("Asset tag and type are required.");
  const { data, error } = await supabase
    .from("assets")
    .insert(asset)
    .select("id")
    .single();
  if (error) throw new Error("Unable to create asset.");
  await audit(supabase, user.id, "created", "asset", data.id, {
    asset_tag: asset.asset_tag,
  });
  revalidatePath("/dashboard/assets");
}

export async function assignAsset(formData: FormData) {
  const { supabase, user } = await actor();
  const assetId = String(formData.get("asset_id") ?? "");
  const employeeId = String(formData.get("employee_id") ?? "");
  if (!assetId || !employeeId)
    throw new Error("Asset and employee are required.");
  const { error } = await supabase
    .from("assets")
    .update({ assigned_to: employeeId, status: "assigned" })
    .eq("id", assetId);
  if (error) throw new Error("Unable to assign asset.");
  await supabase
    .from("asset_history")
    .insert({
      asset_id: assetId,
      action: "assigned",
      actor_id: user.id,
      notes: `Assigned to ${employeeId}`,
    });
  await audit(supabase, user.id, "assigned", "asset", assetId, {
    assigned_to: employeeId,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
}

export async function verifyAsset(formData: FormData) {
  const { supabase, user } = await actor();
  const assetId = String(formData.get("asset_id") ?? "");
  const status = String(formData.get("status") ?? "returned");
  const notes = String(formData.get("notes") ?? "");
  if (!assetId) throw new Error("Asset is required.");
  const update: Record<string, unknown> = { status };
  if (status === "returned") update["returned_at"] = new Date().toISOString();
  const { error } = await supabase
    .from("assets")
    .update(update)
    .eq("id", assetId);
  if (error) throw new Error("Unable to update asset verification.");
  await supabase
    .from("asset_history")
    .insert({ asset_id: assetId, action: status, actor_id: user.id, notes });
  await audit(supabase, user.id, "verified", "asset", assetId, {
    status,
    notes,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
}

export async function createHandover(formData: FormData) {
  const { supabase, user } = await actor();
  const employeeId = String(formData.get("employee_id") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  if (!employeeId || !notes)
    throw new Error("Employee and handover notes are required.");
  const { data: assets } = await supabase
    .from("assets")
    .select("id")
    .eq("assigned_to", employeeId);
  await supabase
    .from("employees")
    .update({ employment_status: "exiting" })
    .eq("id", employeeId);
  await audit(supabase, user.id, "handover_started", "employee", employeeId, {
    notes,
    asset_count: assets?.length ?? 0,
  });
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/assets");
}
