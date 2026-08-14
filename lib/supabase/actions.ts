"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { normalizeUserRole } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";

const DEFAULT_CLEARANCE_DEPARTMENTS = [
  "ICT",
  "Library",
  "Finance",
  "Department head",
  "Knowledge",
];

function userFriendlyAuthMessage(
  rawMessage?: string | null,
  fallback = "Something went wrong. Please try again.",
) {
  const message = (rawMessage ?? "").trim();
  if (!message) return fallback;

  const lower = message.toLowerCase();

  if (
    /rate limit|too many requests|too many sign|request limit|email rate/i.test(
      lower,
    )
  ) {
    return "Too many sign-up attempts for this email. Please wait a few minutes and try again.";
  }

  if (/already.*(registered|exists)|duplicate|user already/i.test(lower)) {
    return "An account with this email already exists. Please sign in instead.";
  }

  if (
    /invalid login|invalid credentials|wrong password|email or password|auth user not found|user not found|invalid email/i.test(
      lower,
    )
  ) {
    return "We could not sign you in with those details. Please check your email and password.";
  }

  if (/confirm.*email|email.*verified|verification/i.test(lower)) {
    return "Please check your inbox and confirm your email before signing in.";
  }

  if (
    /weak password|password.*(at least|minimum|length)|password.*too short/i.test(
      lower,
    )
  ) {
    return "Please choose a stronger password with at least 8 characters.";
  }

  if (/network|timed out|failed to fetch|unexpected|server/i.test(lower)) {
    return "Something went wrong on our side. Please try again in a moment.";
  }

  return fallback;
}

async function ensureUserProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  preferredRole?: string,
) {
  const fullName =
    String(
      user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        appConfig.defaultUserName,
    ).trim() || appConfig.defaultUserName;

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, full_name, role, department_id")
    .eq("id", user.id)
    .maybeSingle();

  // Auth metadata is the assigned role. Keep the public profile copy in sync
  // so the same user is not shown as (for example) both Employee and
  // Administrator in different areas of the app.
  const assignedRole = String(
    preferredRole ??
      user.user_metadata?.role ??
      existingProfile?.role ??
      appConfig.defaultRole,
  ).trim();
  const role = assignedRole || appConfig.defaultRole;

  console.log("[profile-role-debug]", {
    userId: user.id,
    preferredRole,
    authRole: user.user_metadata?.role ?? null,
    existingProfileRole: existingProfile?.role ?? null,
    assignedRole,
    resolvedRole: role,
  });

  if (!existingProfile) {
    const { error } = await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      role,
      department_id: null,
    });

    if (error && !/duplicate key|already exists/i.test(error.message)) {
      throw new Error("Unable to create profile for this user.");
    }
  } else {
    const updates: Record<string, string | null> = {};
    if (!existingProfile.full_name) updates.full_name = fullName;
    if (existingProfile.role !== role) updates.role = role;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (error) throw new Error("Unable to update user profile.");
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, department_id")
    .eq("id", user.id)
    .single();

  return profile;
}

async function ensureEmployeeRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  overrides: { fullName?: string; departmentId?: string | null } = {},
) {
  const email = String(user.email ?? "").trim();
  const fullName =
    String(
      overrides.fullName ??
        user.user_metadata?.full_name ??
        email.split("@")[0] ??
        appConfig.defaultUserName,
    ).trim() || appConfig.defaultUserName;

  const { data: existingEmployee } = await supabase
    .from("employees")
    .select(
      "id, employee_number, full_name, email, department_id, job_title, employment_status",
    )
    .eq("email", email)
    .maybeSingle();

  if (existingEmployee) {
    return existingEmployee;
  }

  const employeeNumber = `USER-${user.id.slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_number: employeeNumber,
      full_name: fullName,
      email: email || `${user.id}@local.invalid`,
      department_id: overrides.departmentId ?? null,
      employment_status: "active",
      job_title: "Onboarded user",
    })
    .select(
      "id, employee_number, full_name, email, department_id, job_title, employment_status",
    )
    .single();

  if (error) {
    if (/duplicate key|already exists|duplicate/i.test(error.message)) {
      return existingEmployee;
    }
    throw new Error("Unable to create employee record for this user.");
  }

  return data;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent("Email and password are required."),
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent(
          userFriendlyAuthMessage(
            error.message,
            "We could not sign you in with those details. Please check your email and password.",
          ),
        ),
    );
  }

  const profile = await ensureUserProfile(supabase, data.user);
  await ensureEmployeeRecord(supabase, data.user, {
    fullName: profile?.full_name ?? undefined,
  });

  if (!profile?.department_id) {
    redirect("/onboard?next=/dashboard");
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = appConfig.defaultRole;

  if (!fullName || !email || !password) {
    redirect(
      "/auth/register?message=" +
        encodeURIComponent("Full name, email, and password are required."),
    );
  }

  if (password.length < 8) {
    redirect(
      "/auth/register?message=" +
        encodeURIComponent(
          "Please choose a stronger password with at least 8 characters.",
        ),
    );
  }

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

  if (error) {
    redirect(
      "/auth/register?message=" +
        encodeURIComponent(
          userFriendlyAuthMessage(
            error.message,
            "We could not create your account right now. Please try again.",
          ),
        ),
    );
  }

  if (data.user && data.session) {
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName,
      role,
    });

    if (profileError) {
      redirect(
        "/auth/register?message=" +
          encodeURIComponent(
            "Your account was created, but we could not finish setting up your profile. Please sign in and try again.",
          ),
      );
    }
  }

  if (data.user && !data.session) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent(
          "Check your email to confirm your account before signing in.",
        ),
    );
  }

  redirect("/dashboard");
}

export async function resetPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent(
          "Please enter your email address to reset your password.",
        ),
    );
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/reset-password`,
  });

  if (error) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent(
          userFriendlyAuthMessage(
            error.message,
            "We could not send a password reset email right now. Please try again.",
          ),
        ),
    );
  }
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

async function requireAdminRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
) {
  const metadataRole =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).trim()
      : "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const combinedRole = normalizeUserRole(
    metadataRole || (typeof profile?.role === "string" ? profile.role : ""),
  );

  if (
    !combinedRole.toLowerCase().includes("administrator") &&
    !combinedRole.toLowerCase().includes("hr")
  ) {
    throw new Error("You are not authorized to change system settings.");
  }
}

async function resolveEffectiveUserRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
) {
  const metadataRole =
    typeof user.user_metadata?.role === "string"
      ? String(user.user_metadata.role).trim()
      : "";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return normalizeUserRole(
    metadataRole || (typeof profile?.role === "string" ? profile.role : ""),
  );
}

type ClearanceStep = { department: string; status: string; comments?: string };
type AssetRow = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
  returned_at?: string | null;
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

  const { data: configurationRow } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "default_clearance_departments")
    .maybeSingle();

  let defaultDepartments = [...DEFAULT_CLEARANCE_DEPARTMENTS];
  if (configurationRow?.value) {
    try {
      const parsed = JSON.parse(configurationRow.value) as unknown;
      if (Array.isArray(parsed)) {
        defaultDepartments = parsed
          .map((item) => String(item).trim())
          .filter(Boolean);
      }
    } catch {
      const splitValue = configurationRow.value
        .split(/[\n,]+/)
        .map((item: string) => item.trim())
        .filter(Boolean);
      if (splitValue.length) defaultDepartments = splitValue;
    }
  }

  const { data, error } = await supabase
    .from("exit_requests")
    .insert({ employee_id: employeeId, reason, last_day: lastDay })
    .select("id")
    .single();
  if (error) throw new Error("Unable to submit exit request.");
  await audit(supabase, user.id, "created", "exit_request", data.id);
  try {
    await createClearanceSteps(data.id, defaultDepartments);
  } catch (err) {
    await audit(supabase, user.id, "warn", "clearance_steps", data.id, {
      message: "Unable to create configured clearance steps",
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
  const userRole = await resolveEffectiveUserRole(supabase, user);
  const allowed =
    userRole === appConfig.defaultRole ||
    userRole.toLowerCase().includes(stepDept.toLowerCase()) ||
    userRole.toLowerCase().includes("hr") ||
    userRole.toLowerCase().includes("administrator");
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
    .select("id,asset_tag,asset_type,status,returned_at")
    .eq("assigned_to", employeeId);
  const outstandingAssets = (assets ?? []).filter(
    (a: AssetRow) => a.status !== "returned" || !a.returned_at,
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

export async function canFinalizeExit(exitRequestId: string) {
  const { blocked, blockers } = await checkExitBlockers(exitRequestId);

  const reasons: Array<{ type: string; message: string; department?: string }> =
    [];

  if (Array.isArray((blockers as Record<string, unknown>)?.clearance)) {
    const clearanceBlocks = (blockers as Record<string, unknown>)
      .clearance as Array<Record<string, unknown>>;
    clearanceBlocks.forEach((block) => {
      reasons.push({
        type: "clearance",
        department:
          typeof block.department === "string" ? block.department : undefined,
        message:
          typeof block.comments === "string" && block.comments.trim()
            ? block.comments
            : `Clearance for ${block.department ?? "department"} is still pending.`,
      });
    });
  }

  if (Array.isArray((blockers as Record<string, unknown>)?.assets)) {
    const assetBlocks = (blockers as Record<string, unknown>).assets as Array<
      Record<string, unknown>
    >;
    assetBlocks.forEach((block) => {
      reasons.push({
        type: "asset",
        department: "ICT",
        message: `Asset ${String(block.tag ?? block.id ?? "unknown")} is not yet returned or verified.`,
      });
    });
  }

  if ((blockers as Record<string, unknown>)?.knowledge === "no_documents") {
    reasons.push({
      type: "knowledge",
      message: "Required knowledge handover documents are missing.",
    });
  }

  return {
    eligible: !blocked,
    blocked,
    blockers: reasons,
  };
}

export async function finalizeExit(formData: FormData) {
  const exitRequestId = String(formData.get("exit_request_id") ?? "");
  if (!exitRequestId) throw new Error("Exit request is required.");
  const { supabase, user } = await actor();

  const userRole = await resolveEffectiveUserRole(supabase, user);
  if (
    !userRole.toLowerCase().includes("administrator") &&
    !userRole.toLowerCase().includes("hr")
  ) {
    throw new Error("You are not authorized to finalize exits.");
  }

  const readiness = await canFinalizeExit(exitRequestId);
  if (!readiness.eligible) {
    await audit(
      supabase,
      user.id,
      "finalization_blocked",
      "exit_request",
      exitRequestId,
      { blockers: readiness.blockers },
    );
    throw new Error(
      readiness.blockers.map((blocker) => blocker.message).join("; ") ||
        "Exit request is blocked and cannot be finalized.",
    );
  }

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

export async function createKnowledgeCategory(formData: FormData) {
  const { supabase, user } = await actor();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) throw new Error("Category name is required.");

  const { error } = await supabase.from("knowledge_categories").insert({
    name,
    description,
    created_by: user.id,
  });

  if (error) throw new Error("Unable to create category.");
  await audit(supabase, user.id, "created", "knowledge_category", name, {
    name,
    description,
  });
  revalidatePath("/dashboard/knowledge-hub");
}

export async function createKnowledgeRequirement(formData: FormData) {
  const { supabase, user } = await actor();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category_id") ?? "").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim();
  const reviewerRole = String(formData.get("reviewer_role") ?? "HR").trim();
  if (!name) throw new Error("Requirement name is required.");

  const { error } = await supabase.from("knowledge_requirements").insert({
    name,
    description,
    category_id: category || null,
    department_id: departmentId || null,
    reviewer_role: reviewerRole || "HR",
    created_by: user.id,
  });

  if (error) throw new Error("Unable to create requirement.");
  await audit(supabase, user.id, "created", "knowledge_requirement", name, {
    name,
    category,
    departmentId,
    reviewerRole,
  });
  revalidatePath("/dashboard/knowledge-hub");
}

export async function reviewKnowledgeDocument(formData: FormData) {
  const { supabase, user } = await actor();
  const documentId = String(formData.get("document_id") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();
  if (!documentId || !action)
    throw new Error("Document and decision are required.");

  const { data: doc } = await supabase
    .from("knowledge_documents")
    .select("id, employee_id, status")
    .eq("id", documentId)
    .single();

  if (!doc) throw new Error("Document not found.");

  if (doc.employee_id === user.id) {
    throw new Error(
      "Employees cannot approve their own knowledge submissions.",
    );
  }

  const nextStatus =
    action === "approved"
      ? "approved"
      : action === "rejected"
        ? "rejected"
        : "revision_required";

  const { error } = await supabase
    .from("knowledge_documents")
    .update({
      status: nextStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason:
        action === "rejected" ? rejectionReason || "No reason provided." : null,
    })
    .eq("id", documentId);

  if (error) throw new Error("Unable to update document review.");

  await audit(supabase, user.id, action, "knowledge_document", documentId, {
    employee_id: doc.employee_id,
    rejection_reason: rejectionReason || null,
  });

  revalidatePath("/dashboard/knowledge-hub");
  revalidatePath(`/dashboard/knowledge-hub/${documentId}`);
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

export async function completeOnboarding(formData: FormData) {
  const { supabase, user } = await actor();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim();

  if (!fullName) throw new Error("Full name is required.");
  if (!departmentId) throw new Error("Please select your department.");

  const { data: departmentRow, error: departmentLookupError } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .maybeSingle();

  if (departmentLookupError || !departmentRow) {
    throw new Error("Please select a valid department.");
  }

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) throw new Error("Unable to load your profile.");

  // The assigned role is never accepted from onboarding form data. This stops
  // a user from creating a conflicting or elevated role for themselves.
  const role =
    String(
      user.user_metadata?.role ??
        existingProfile?.role ??
        appConfig.defaultRole,
    ).trim() || appConfig.defaultRole;

  const profile = {
    full_name: fullName,
    role: role || appConfig.defaultRole,
    department_id: departmentRow.id,
  };

  // Do not use upsert here. PostgREST evaluates an upsert against INSERT RLS
  // policies even when it resolves to an update, while an onboarding user will
  // normally already have a profile created during sign-in.
  const { data: updatedProfile, error: profileUpdateError } = await supabase
    .from("profiles")
    .update(profile)
    .eq("id", user.id)
    .select("id")
    .maybeSingle();

  if (profileUpdateError) {
    console.error("Unable to update onboarding profile", {
      code: profileUpdateError.code,
      message: profileUpdateError.message,
      details: profileUpdateError.details,
    });
    throw new Error("Unable to save your onboarding details.");
  }

  if (!updatedProfile) {
    const { error: profileInsertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, ...profile });

    if (profileInsertError) {
      console.error("Unable to create onboarding profile", {
        code: profileInsertError.code,
        message: profileInsertError.message,
        details: profileInsertError.details,
      });
      throw new Error("Unable to save your onboarding details.");
    }
  }

  const { data: existingEmployee } = await supabase
    .from("employees")
    .select("id")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (!existingEmployee) {
    const employeeNumber = `USER-${user.id.slice(0, 8).toUpperCase()}`;
    const { error: employeeError } = await supabase.from("employees").insert({
      employee_number: employeeNumber,
      full_name: fullName,
      email: user.email,
      department_id: departmentId,
      employment_status: "active",
      job_title: "Onboarded user",
    });

    if (employeeError) {
      throw new Error(
        "Profile saved, but the employee record could not be created.",
      );
    }
  }

  await audit(supabase, user.id, "onboarded", "profile", user.id, {
    role,
    department_id: departmentId,
  });

  revalidatePath("/dashboard");
  revalidatePath("/profile");
  revalidatePath("/dashboard/settings");

  redirect("/dashboard");
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
  revalidatePath("/dashboard/settings");
}

function normalizeDepartmentCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "DEPT";

  const slug = trimmed
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);

  return slug || "DEPT";
}

export async function createDepartment(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAdminRole(supabase, user);

  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) throw new Error("Department name is required.");

  const departmentCode = normalizeDepartmentCode(code || name);
  const { error } = await supabase.from("departments").insert({
    name,
    code: departmentCode,
    description: description || null,
  });

  if (error) {
    throw new Error(error.message || "Unable to create department.");
  }

  await audit(supabase, user.id, "created", "department", name, {
    name,
    code: departmentCode,
    description,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/employees");
}

export async function updateDepartment(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAdminRole(supabase, user);

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!id || !name) throw new Error("Department name is required.");

  const departmentCode = normalizeDepartmentCode(code || name);
  const { error } = await supabase
    .from("departments")
    .update({
      name,
      code: departmentCode,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Unable to update department.");
  }

  await audit(supabase, user.id, "updated", "department", id, {
    name,
    code: departmentCode,
    description,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/employees");
}

export async function deleteDepartment(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAdminRole(supabase, user);

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Department is required.");

  const [{ data: employeeRef }, { data: profileRef }] = await Promise.all([
    supabase.from("employees").select("id").eq("department_id", id).limit(1),
    supabase.from("profiles").select("id").eq("department_id", id).limit(1),
  ]);

  if ((employeeRef?.length ?? 0) > 0 || (profileRef?.length ?? 0) > 0) {
    throw new Error(
      "This department is still assigned to employees or profiles. Reassign them first.",
    );
  }

  const { error } = await supabase.from("departments").delete().eq("id", id);

  if (error) {
    throw new Error(error.message || "Unable to delete department.");
  }

  await audit(supabase, user.id, "deleted", "department", id);

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/employees");
}

export async function saveSystemSetting(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAdminRole(supabase, user);

  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key) throw new Error("Setting key is required.");

  const { error } = await supabase
    .from("system_settings")
    .upsert({ key, value }, { onConflict: "key" });

  if (error) throw new Error("Unable to save system setting.");

  await audit(supabase, user.id, "updated", "system_setting", key, {
    key,
    value,
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

export async function restoreDefaultWorkflow() {
  const { supabase, user } = await actor();
  await requireAdminRole(supabase, user);

  const defaults = [...DEFAULT_CLEARANCE_DEPARTMENTS];
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      { key: "default_clearance_departments", value: JSON.stringify(defaults) },
      { onConflict: "key" },
    );

  if (error) throw new Error("Unable to restore workflow defaults.");

  await audit(
    supabase,
    user.id,
    "reset",
    "system_setting",
    "default_clearance_departments",
    {
      defaults,
    },
  );

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
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
  await supabase.from("asset_history").insert({
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

export async function updateUserRole(formData: FormData) {
  const { supabase, user } = await actor();

  // Verify admin role
  await requireAdminRole(supabase, user);

  const userId = String(formData.get("user_id") ?? "");
  const newRole = String(formData.get("role") ?? "");

  if (!userId || !newRole) {
    throw new Error("User ID and role are required.");
  }

  // Update profile role
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);

  if (profileError) {
    throw new Error("Unable to update user role.");
  }

  // Log audit event
  await audit(supabase, user.id, "updated_user_role", "system_user", userId, {
    new_role: newRole,
  });

  revalidatePath("/dashboard/user-management");
}

export async function disableUserAccount(formData: FormData) {
  const { supabase, user } = await actor();

  // Verify admin role
  await requireAdminRole(supabase, user);

  const userId = String(formData.get("user_id") ?? "");

  if (!userId) {
    throw new Error("User ID is required.");
  }

  // Prevent self-disable
  if (userId === user.id) {
    throw new Error("You cannot disable your own account.");
  }

  // Mark as disabled in profile
  const { error } = await supabase
    .from("profiles")
    .update({ active: false })
    .eq("id", userId);

  if (error) {
    throw new Error("Unable to disable user account.");
  }

  // Log audit event
  await audit(
    supabase,
    user.id,
    "disabled_user_account",
    "system_user",
    userId,
    {},
  );

  revalidatePath("/dashboard/user-management");
}

export async function activateUserAccount(formData: FormData) {
  const { supabase, user } = await actor();

  // Verify admin role
  await requireAdminRole(supabase, user);

  const userId = String(formData.get("user_id") ?? "");

  if (!userId) {
    throw new Error("User ID is required.");
  }

  // Mark as active in profile
  const { error } = await supabase
    .from("profiles")
    .update({ active: true })
    .eq("id", userId);

  if (error) {
    throw new Error("Unable to activate user account.");
  }

  // Log audit event
  await audit(
    supabase,
    user.id,
    "activated_user_account",
    "system_user",
    userId,
    {},
  );

  revalidatePath("/dashboard/user-management");
}

export async function updateUserProfile(formData: FormData) {
  const { supabase, user } = await actor();

  // Verify admin role
  await requireAdminRole(supabase, user);

  const userId = String(formData.get("user_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!userId || !fullName) {
    throw new Error("User ID and name are required.");
  }

  // Update profile (only full_name exists in profiles table)
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", userId);

  if (error) {
    throw new Error("Unable to update user profile.");
  }

  // Log audit event
  await audit(
    supabase,
    user.id,
    "updated_user_profile",
    "system_user",
    userId,
    {
      full_name: fullName,
    },
  );

  revalidatePath("/dashboard/user-management");
}
