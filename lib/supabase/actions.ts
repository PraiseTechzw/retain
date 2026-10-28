"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAssetBusinessDate } from "@/lib/asset-date";
import { normalizeUserRole } from "@/lib/auth-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";
import { assessFlightRisk, type FlightRiskLeave } from "@/lib/analytics/flight-risk";

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
) {
  const fullName =
    String(
      user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        appConfig.defaultUserName,
    ).trim() || appConfig.defaultUserName;

  const { data: existingProfile, error: profileLookupError } = await supabase
    .from("profiles")
    .select("id, full_name, role, department_id, active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) throw new Error("Unable to verify your account profile.");
  if (!existingProfile) {
    await supabase.auth.signOut();
    redirect(
      "/auth/login?message=" +
        encodeURIComponent("Your account has no active profile. Contact an administrator."),
    );
  } else {
    if (existingProfile.active !== true) {
      redirect(
        "/auth/login?message=" +
          encodeURIComponent("This account has been deactivated. Contact HR or an administrator."),
      );
    }
    const updates: Record<string, string | null> = {};
    if (!existingProfile.full_name) updates.full_name = fullName;

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

  const { data: existingEmployee, error: existingEmployeeError } = await supabase
    .from("employees")
    .select(
      "id, employee_number, full_name, email, department_id, job_title, employment_status, user_id",
    )
    .eq("email", email)
    .maybeSingle();
  if (existingEmployeeError) {
    if (existingEmployeeError.code === "42703" || existingEmployeeError.code === "PGRST204") {
      throw new Error("Employee account setup is incomplete. Ask your administrator to apply the latest Supabase migrations.");
    }
    throw new Error("Unable to check for an existing employee account.");
  }

  if (existingEmployee) {
    if (existingEmployee.user_id && existingEmployee.user_id !== user.id) {
      throw new Error("This employee email is already linked to another account.");
    }
    if (!existingEmployee.user_id) {
      const { data: linkedEmployee, error } = await supabase
        .from("employees")
        .update({ user_id: user.id })
        .eq("id", existingEmployee.id)
        .is("user_id", null)
        .select("id,user_id")
        .maybeSingle();
      if (error) throw new Error("Unable to link your employee record to this account.");
      if (!linkedEmployee) {
        const { data: verifiedLink, error: linkError } = await supabase
          .from("employees")
          .select("user_id")
          .eq("id", existingEmployee.id)
          .single();
        if (linkError || verifiedLink?.user_id !== user.id) {
          throw new Error("Employee record link changed while signing in.");
        }
      }
    }
    return existingEmployee;
  }

  const employeeNumber = `USER-${user.id.slice(0, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from("employees")
    .insert({
      employee_number: employeeNumber,
      user_id: user.id,
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
    if (error.code === "42703" || error.code === "PGRST204") {
      throw new Error("Employee account setup is incomplete. Ask your administrator to apply the latest Supabase migrations.");
    }
    console.error("Employee account provisioning failed", { code: error.code });
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", data.user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !profile) {
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
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to verify account status.");
  if (!profile || profile.active !== true) {
    throw new Error("This account is inactive or has no authorized profile.");
  }
  return { supabase, user };
}

export async function getMyNotifications() {
  const { supabase, user } = await actor();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, message, entity_type, entity_id, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw new Error("Unable to load notifications.");
  return data ?? [];
}

export async function markMyNotificationRead(formData: FormData) {
  const { supabase, user } = await actor();
  const id = String(formData.get("notification_id") ?? "").trim();
  if (!id) throw new Error("Notification ID is required.");

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) throw new Error("Unable to mark notification as read.");
}

export async function markAllMyNotificationsRead() {
  const { supabase, user } = await actor();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) throw new Error("Unable to mark notifications as read.");
}

async function requireAdminRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  const role =
    profile?.active === true && typeof profile.role === "string"
      ? profile.role.trim().toLowerCase()
      : "";

  if (!["administrator", "hr"].includes(role)) {
    throw new Error("You are not authorized to change system settings.");
  }
}

async function resolveEffectiveUserRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.active === true && typeof profile.role === "string"
    ? profile.role.trim() || "Employee"
    : "Employee";
}

async function requireAnyRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
  allowedRoles: string[],
) {
  const role = (await resolveEffectiveUserRole(supabase, user)).toLowerCase();
  if (!allowedRoles.some((allowedRole) => role === allowedRole.toLowerCase())) {
    throw new Error("You are not authorized to perform this action.");
  }
}

type ClearanceStep = { department: string; status: string; comments?: string };
type AssetRow = {
  id: string;
  asset_tag: string;
  asset_type: string;
  status: string;
  returned_at?: string | null;
  verified_at?: string | null;
};

async function audit(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    const adminClient = createAdminClient();
    const { error } = await adminClient.from("audit_events").insert({
      actor_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      metadata,
    });
    if (error) {
      console.error("Audit event write failed", {
        code: error.code,
        action,
        entityType,
      });
    }
  } catch (error) {
    console.error("Audit event write failed", {
      message: error instanceof Error ? error.message : "Unknown audit error",
      action,
      entityType,
    });
  }
}

function parseOptionalDate(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`${label} must be a valid date.`);
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(`${label} must be a valid date.`);
  }
  return normalized;
}

async function saveEmployeeRecord(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
  const commuteDistanceValue = String(
    formData.get("commute_distance_km") ?? "",
  ).trim();
  const commuteDistance = commuteDistanceValue
    ? Number(commuteDistanceValue)
    : null;
  const employmentCategory =
    String(formData.get("employment_category") ?? "").trim().toLowerCase() ||
    "support";
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const employee = {
    employee_number: String(formData.get("employee_number") ?? "").trim(),
    full_name: String(formData.get("full_name") ?? "").trim(),
    email,
    phone: String(formData.get("phone") ?? "").trim() || null,
    department_id: String(formData.get("department_id") ?? "").trim() || null,
    job_title: String(formData.get("job_title") ?? "").trim() || null,
    employment_category: employmentCategory,
    joined_on: parseOptionalDate(
      String(formData.get("joined_on") ?? ""),
      "Start date",
    ),
    home_area:
      String(formData.get("home_area") ?? "").trim().replace(/\s+/g, " ") ||
      null,
    commute_distance_km: commuteDistance,
    is_technical: formData.get("is_technical") === "on",
    employment_status: "active",
  };
  if (!employee.employee_number || !employee.full_name)
    throw new Error("Employee number and full name are required.");
  if (employee.home_area && employee.home_area.length > 80)
    throw new Error("Home area must be a broad locality name under 80 characters.");
  if (
    !["academic", "academic_attaché", "support"].includes(
      employee.employment_category,
    )
  ) {
    throw new Error("Select a valid employment category.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  if (
    commuteDistance !== null &&
    (!Number.isFinite(commuteDistance) || commuteDistance < 0)
  ) {
    throw new Error("Commute distance must be a non-negative number.");
  }
  let employeeInsert = await supabase
    .from("employees")
    .insert(employee)
    .select("id")
    .single();
  const missingLifecycleColumn =
    employeeInsert.error &&
    (employeeInsert.error.code === "42703" || employeeInsert.error.code === "PGRST204") &&
    /phone|home_area|commute_distance_km|is_technical/i.test(employeeInsert.error.message);
  const hasLifecycleDetails = Boolean(
    employee.phone || employee.home_area || commuteDistance !== null || employee.is_technical,
  );
  if (missingLifecycleColumn && !hasLifecycleDetails) {
    const {
      phone,
      home_area,
      commute_distance_km,
      is_technical,
      ...coreEmployee
    } = employee;
    void phone;
    void home_area;
    void commute_distance_km;
    void is_technical;
    employeeInsert = await supabase
      .from("employees")
      .insert(coreEmployee)
      .select("id")
      .single();
  }
  const { data, error } = employeeInsert;
  if (error?.code === "23505") {
    throw new Error("That employee number is already in use. Check it and try again.");
  }
  if (missingLifecycleColumn && hasLifecycleDetails) {
    throw new Error("Optional employee fields aren’t available in the database yet. Ask your administrator to apply the latest Supabase migrations before saving those details.");
  }
  if (error?.code === "42703" || error?.code === "PGRST204") {
    throw new Error("Employee setup is incomplete in the database. Ask your administrator to apply the latest Supabase migrations.");
  }
  if (error) {
    console.error("Employee creation failed", { code: error.code });
    throw new Error("We couldn’t add this employee. Check the required details and try again, or contact your administrator.");
  }
  await audit(supabase, user.id, "created", "employee", data.id, {
    employee_number: employee.employee_number,
  });
}

export async function createEmployee(
  formData: FormData,
): Promise<{ ok: boolean; message?: string }> {
  let saved = false;
  try {
    await saveEmployeeRecord(formData);
    saved = true;
    try {
      revalidatePath("/dashboard/employees");
      revalidatePath("/dashboard");
    } catch (error) {
      console.error("Employee record saved, but page refresh failed", {
        message: error instanceof Error ? error.message : "Unknown refresh error",
      });
      return {
        ok: true,
        message: "Employee added. Refresh the employee list if the new record doesn’t appear yet.",
      };
    }
    return { ok: true };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    if (saved) {
      return {
        ok: true,
        message: "Employee added. Refresh the employee list if the new record doesn’t appear yet.",
      };
    }
    return {
      ok: false,
      message: /Server Components render|Minified React error|digest/i.test(rawMessage)
        ? "We couldn’t complete the employee request. Please try again or contact your administrator."
        : rawMessage || "We couldn’t add this employee. Please try again.",
    };
  }
}

export async function updateEmployeeRecord(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const employeeNumber = String(formData.get("employee_number") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const departmentId =
    String(formData.get("department_id") ?? "").trim() || null;
  const employmentCategory = String(
    formData.get("employment_category") ?? "",
  ).trim().toLowerCase();
  const supportedCategories = ["academic", "academic_attaché", "support"];

  if (!employeeId || !employeeNumber || !fullName) {
    throw new Error("Employee number and full name are required.");
  }
  if (!supportedCategories.includes(employmentCategory)) {
    const { data: existing, error: existingError } = await supabase
      .from("employees")
      .select("employment_category")
      .eq("id", employeeId)
      .maybeSingle();
    if (
      existingError ||
      String(existing?.employment_category ?? "").trim().toLowerCase() !==
        employmentCategory
    ) {
      throw new Error("Select a valid employment category.");
    }
  }
  if (!employmentCategory) {
    throw new Error("Select a valid employment category.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  const { data, error } = await supabase
    .from("employees")
    .update({
      employee_number: employeeNumber,
      full_name: fullName,
      email,
      phone: String(formData.get("phone") ?? "").trim() || null,
      department_id: departmentId,
      job_title: String(formData.get("job_title") ?? "").trim() || null,
      employment_category: employmentCategory,
      joined_on: parseOptionalDate(
        String(formData.get("joined_on") ?? ""),
        "Start date",
      ),
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId)
    .select("id")
    .single();

  if (error || !data) throw new Error("Unable to update employee record.");
  await audit(supabase, user.id, "updated_lifecycle_record", "employee", employeeId, {
    fields: [
      "employee_number",
      "full_name",
      "email",
      "phone",
      "department_id",
      "job_title",
      "employment_category",
      "joined_on",
    ],
  });
  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard");
}

export async function updateEmployeeRiskProfile(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const homeArea =
    String(formData.get("home_area") ?? "").trim().replace(/\s+/g, " ") ||
    null;
  const commuteValue = String(formData.get("commute_distance_km") ?? "").trim();
  const commuteDistance = commuteValue ? Number(commuteValue) : null;
  const isTechnical = formData.get("is_technical") === "on";
  if (
    !employeeId ||
    (homeArea !== null && homeArea.length > 80) ||
    (commuteDistance !== null &&
      (!Number.isFinite(commuteDistance) || commuteDistance < 0))
  ) {
    throw new Error("Enter a valid employee and non-negative commute distance.");
  }
  const { error } = await supabase
    .from("employees")
    .update({
      home_area: homeArea,
      commute_distance_km: commuteDistance,
      is_technical: isTechnical,
      updated_at: new Date().toISOString(),
    })
    .eq("id", employeeId);
  if (error) throw new Error("Unable to update commute details.");
  await audit(supabase, user.id, "updated_commute", "employee", employeeId, {
    home_area_updated: true,
    commute_distance_km: commuteDistance,
    is_technical: isTechnical,
  });
  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/talent-risk");
}

export async function recordRetentionIntervention(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const interventionType = String(formData.get("intervention_type") ?? "").trim();
  const actionNotes = String(formData.get("action_notes") ?? "").trim();
  const followUpOn = String(formData.get("follow_up_on") ?? "").trim() || null;
  if (
    !employeeId ||
    !["career_conversation", "workload_review", "development", "commute_support", "other"].includes(interventionType) ||
    !actionNotes
  ) {
    throw new Error("Enter an employee, intervention type, and action notes.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, full_name, employee_number, employment_status, job_title, joined_on, home_area, commute_distance_km, departments(name)")
    .eq("id", employeeId)
    .single();
  if (employeeError || !employee) throw new Error("Employee record not found.");
  if (String(employee.employment_status).toLowerCase() !== "active") {
    throw new Error("Retention interventions can only be recorded for active employees.");
  }
  const { data: leaveRequests, error: leaveError } = await supabase
    .from("leave_requests")
    .select("employee_id, requested_days, starts_on, status")
    .eq("employee_id", employeeId)
    .eq("status", "approved");
  if (leaveError) throw new Error("Unable to calculate the current review signal.");
  const department = Array.isArray(employee.departments)
    ? employee.departments[0]
    : employee.departments;
  const assessment = assessFlightRisk(
    {
      id: employee.id,
      full_name: employee.full_name,
      employee_number: employee.employee_number,
      employment_status: employee.employment_status,
      job_title: employee.job_title,
      joined_on: employee.joined_on,
      department_name: department?.name ?? null,
      home_area: employee.home_area,
      commute_distance_km: employee.commute_distance_km,
    },
    (leaveRequests ?? []) as FlightRiskLeave[],
  );

  const { data: intervention, error } = await supabase
    .from("retention_interventions")
    .insert({
      employee_id: employeeId,
      risk_score: assessment.score,
      intervention_type: interventionType,
      action_notes: actionNotes,
      follow_up_on: followUpOn,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error("Unable to save the retention intervention.");
  await audit(supabase, user.id, "recorded", "retention_intervention", intervention.id, {
    employee_id: employeeId,
    risk_score: assessment.score,
    intervention_type: interventionType,
  });
  revalidatePath("/dashboard/talent-risk");
}

export async function createExitRequest(formData: FormData) {
  const { supabase, user } = await actor();
  const employeeId = String(formData.get("employee_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const lastDay = String(formData.get("last_day") ?? "") || null;
  if (!employeeId || !reason)
    throw new Error("Employee and reason are required.");
  const role = await resolveEffectiveUserRole(supabase, user);
  if (!["administrator", "hr"].includes(role.toLowerCase())) {
    const { data: ownEmployee, error: ownEmployeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("id", employeeId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownEmployeeError) throw new Error("Unable to verify the employee record.");
    if (!ownEmployee) {
      throw new Error("You can only start an exit request for your own employee record.");
    }
  }

  const { data, error } = await supabase
    .from("exit_requests")
    .insert({ employee_id: employeeId, reason, last_day: lastDay })
    .select("id")
    .single();
  if (error) throw new Error("Unable to submit exit request.");
  await audit(supabase, user.id, "created", "exit_request", data.id);
  revalidatePath("/dashboard/exit-requests");
  revalidatePath("/dashboard");
}

export async function updateAssetStatus(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
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

export async function submitLeaveRequest(formData: FormData) {
  const { supabase, user } = await actor();
  const leaveType = String(formData.get("leave_type") ?? "").trim();
  const startsOn = parseOptionalDate(
    String(formData.get("starts_on") ?? ""),
    "Leave start date",
  );
  const endsOn = parseOptionalDate(
    String(formData.get("ends_on") ?? ""),
    "Leave end date",
  );
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!leaveType || !startsOn || !endsOn) {
    throw new Error("Leave type and date range are required.");
  }
  const start = new Date(`${startsOn}T00:00:00.000Z`);
  const end = new Date(`${endsOn}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    throw new Error("Enter a valid leave date range.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (employeeError) throw new Error("Unable to find your employee record.");
  if (!employee) throw new Error("Your account is not linked to an employee record.");

  const { data: conflicts, error: conflictError } = await supabase
    .from("leave_requests")
    .select("id")
    .eq("employee_id", employee.id)
    .in("status", ["pending", "approved"])
    .lte("starts_on", endsOn)
    .gte("ends_on", startsOn)
    .limit(1);
  if (conflictError) throw new Error("Unable to check for overlapping leave.");
  if (conflicts?.length) throw new Error("You already have a pending or approved leave request for these dates.");

  let requestedDays = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) requestedDays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!requestedDays) throw new Error("Leave must include at least one weekday.");

  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: employee.id,
      leave_type: leaveType,
      starts_on: startsOn,
      ends_on: endsOn,
      requested_days: requestedDays,
      reason,
    })
    .select("id")
    .single();
  if (error) {
    if (/leave balance|available .* balance|at least one weekday/i.test(error.message)) {
      throw new Error(error.message);
    }
    throw new Error("Unable to submit leave request.");
  }
  await audit(supabase, user.id, "submitted", "leave_request", data.id, {
    starts_on: startsOn,
    ends_on: endsOn,
    requested_days: requestedDays,
  });
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/analytics");
}

export async function reviewLeaveRequest(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
  const requestId = String(formData.get("request_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const reviewNotes = String(formData.get("review_notes") ?? "").trim() || null;
  if (!requestId || !["approved", "rejected"].includes(decision)) {
    throw new Error("A leave request and valid decision are required.");
  }
  const { data: request, error: requestError } = await supabase
    .from("leave_requests")
    .select("id, employee_id, status")
    .eq("id", requestId)
    .single();
  if (requestError || !request) throw new Error("Leave request not found.");
  if (request.status !== "pending") throw new Error("Only pending leave requests can be reviewed.");
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("email")
    .eq("id", request.employee_id)
    .maybeSingle();
  if (employeeError) throw new Error("Unable to verify the employee record.");
  if (employee?.email && employee.email.toLowerCase() === String(user.email ?? "").toLowerCase()) {
    throw new Error("You cannot review your own leave request.");
  }
  const { data: updated, error } = await supabase
    .from("leave_requests")
    .update({
      status: decision,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to update the leave request.");
  if (!updated) throw new Error("The request was reviewed by another user.");
  await audit(supabase, user.id, decision, "leave_request", requestId);
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/analytics");
}

export async function cancelLeaveRequest(formData: FormData) {
  const { supabase, user } = await actor();
  const requestId = String(formData.get("request_id") ?? "").trim();
  if (!requestId) throw new Error("A leave request is required.");

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (employeeError) throw new Error("Unable to verify your employee record.");
  if (!employee) throw new Error("Your account is not linked to an employee record.");

  const { data: cancelled, error } = await supabase
    .from("leave_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("employee_id", employee.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to cancel the leave request.");
  if (!cancelled) throw new Error("Only your pending leave request can be cancelled.");

  await audit(supabase, user.id, "cancelled", "leave_request", requestId);
  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/analytics");
}

export async function setLeaveBalance(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const leaveType = String(formData.get("leave_type") ?? "").trim();
  const leaveYear = Number(formData.get("leave_year") ?? new Date().getFullYear());
  const entitledDays = Number(formData.get("entitled_days") ?? "");
  const carriedOverDays = Number(formData.get("carried_over_days") ?? "0");
  if (
    !employeeId ||
    !leaveType ||
    !Number.isInteger(leaveYear) ||
    leaveYear < 2000 ||
    leaveYear > 2200 ||
    !Number.isFinite(entitledDays) ||
    entitledDays < 0 ||
    !Number.isFinite(carriedOverDays) ||
    carriedOverDays < 0
  ) {
    throw new Error("Enter a valid employee, year, leave type, and non-negative balance.");
  }
  const { error } = await supabase.from("leave_balances").upsert(
    {
      employee_id: employeeId,
      leave_year: leaveYear,
      leave_type: leaveType,
      entitled_days: entitledDays,
      carried_over_days: carriedOverDays,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,leave_year,leave_type" },
  );
  if (error) throw new Error("Unable to save leave balance.");
  await audit(supabase, user.id, "updated", "leave_balance", employeeId, {
    leave_year: leaveYear,
    leave_type: leaveType,
    entitled_days: entitledDays,
    carried_over_days: carriedOverDays,
  });
  revalidatePath("/dashboard/leave");
}

export async function recordAssetDailyLog(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "management", "ict", "library"]);
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const eventType = String(formData.get("event_type") ?? "").trim();
  const loggedOn = String(formData.get("logged_on") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!assetId || !["daily_check", "movement", "maintenance", "issue", "return"].includes(eventType)) {
    throw new Error("An asset and valid activity type are required.");
  }
  if (["movement", "issue"].includes(eventType)) {
    await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  }
  if (eventType === "movement" && !location) {
    throw new Error("A destination is required when recording asset movement.");
  }
  const dateValue = loggedOn || getAssetBusinessDate();
  const parsedDate = new Date(`${dateValue}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dateValue) {
    throw new Error("Enter a valid activity date.");
  }
  if (eventType === "return") {
    throw new Error("Use Asset return verification to receive and verify an issued asset.");
  }
  const todayInHarare = getAssetBusinessDate();
  if (eventType === "daily_check" && dateValue !== todayInHarare) {
    throw new Error("Daily checks can only be logged for today.");
  }
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, assigned_to, status")
    .eq("id", assetId)
    .single();
  if (assetError || !asset) throw new Error("Asset not found.");
  if (eventType === "daily_check" && (!asset.assigned_to || asset.status !== "assigned")) {
    throw new Error("Daily checks are only required for assets currently assigned to an employee.");
  }
  if (eventType === "issue" && !["available", "assigned"].includes(asset.status)) {
    throw new Error("This asset can’t be reported as damaged in its current status.");
  }
  if (eventType === "issue" && !notes) {
    throw new Error("Add a short note describing the reported damage.");
  }
  const { data, error } = await supabase
    .from("asset_daily_logs")
    .insert({
      asset_id: assetId,
      employee_id: asset.assigned_to,
      event_type: eventType,
      logged_on: dateValue,
      location,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error?.code === "23505" && eventType === "daily_check") {
    throw new Error("A daily check has already been recorded for this asset today.");
  }
  if (error) throw new Error("Unable to record asset activity.");
  if (eventType === "issue") {
    const { error: statusError } = await supabase
      .from("assets")
      .update({ status: "damaged" })
      .eq("id", assetId)
      .eq("status", asset.status);
    if (statusError) throw new Error("The issue was logged, but the asset status could not be updated. Contact an administrator.");
    const { error: historyError } = await supabase.from("asset_history").insert({
      asset_id: assetId,
      action: "reported_damaged",
      actor_id: user.id,
      previous_status: asset.status,
      new_status: "damaged",
      notes,
    });
    if (historyError) throw new Error("The issue was logged, but its status history could not be saved.");
  }
  if (location) {
    const { error: locationError } = await supabase
      .from("assets")
      .update({ current_location: location })
      .eq("id", assetId);
    if (locationError) throw new Error("Activity was logged, but the asset's current location could not be updated.");
  }
  await audit(supabase, user.id, eventType, "asset", assetId, {
    activity_id: data.id,
    location,
    logged_on: dateValue,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath("/dashboard/assets/activity");
  revalidatePath("/dashboard/assets/returns");
  revalidatePath("/dashboard/exit-requests");
}

export async function createRecruitmentOpening(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "management"]);
  const jobTitle = String(formData.get("job_title") ?? "").trim();
  const employmentCategory = String(formData.get("employment_category") ?? "").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "planned").trim();
  const positions = Number(formData.get("positions") ?? 1);
  const targetStartDate = String(formData.get("target_start_date") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!jobTitle || !employmentCategory || !Number.isInteger(positions) || positions < 1) {
    throw new Error("Job title, employment category, and a positive position count are required.");
  }
  if (!["planned", "open", "shortlisting", "interviewing", "offered", "filled", "cancelled"].includes(status)) {
    throw new Error("Select a valid recruitment stage.");
  }
  const { data, error } = await supabase
    .from("recruitment_openings")
    .insert({
      job_title: jobTitle,
      employment_category: employmentCategory,
      department_id: departmentId,
      status,
      positions,
      target_start_date: targetStartDate,
      notes,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error("Unable to save recruitment opening.");
  await audit(supabase, user.id, "created", "recruitment_opening", data.id, {
    job_title: jobTitle,
    status,
  });
  revalidatePath("/dashboard/recruitment");
}

export async function updateRecruitmentStage(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "management"]);
  const openingId = String(formData.get("opening_id") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (
    !openingId ||
    !["planned", "open", "shortlisting", "interviewing", "offered", "filled", "cancelled"].includes(status)
  ) {
    throw new Error("Select a recruitment opening and valid stage.");
  }
  const { error } = await supabase
    .from("recruitment_openings")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", openingId);
  if (error) throw new Error("Unable to update recruitment stage.");
  await audit(supabase, user.id, "stage_changed", "recruitment_opening", openingId, {
    status,
  });
  revalidatePath("/dashboard/recruitment");
}

export async function approveClearance(formData: FormData) {
  const { supabase, user } = await actor();
  const id = String(formData.get("clearance_id") ?? "");
  if (!id) throw new Error("Clearance step is required.");
  // Role-based check: only allow department officers or admins/HR
  const { data: stepData, error: stepError } = await supabase
    .from("clearance_steps")
    .select("id,department,exit_request_id,status")
    .eq("id", id)
    .single();
  if (stepError || !stepData) {
    throw new Error("This clearance step could not be found. Refresh the page and try again.");
  }
  if (stepData.status === "approved") {
    revalidatePath("/dashboard/clearances");
    revalidatePath(`/dashboard/clearances/${stepData.exit_request_id}`);
    revalidatePath(`/dashboard/exit-requests/${stepData.exit_request_id}`);
    return;
  }
  const stepDept = stepData?.department ?? "";
  const userRole = await resolveEffectiveUserRole(supabase, user);
  const normalizedRole = userRole.toLowerCase();
  const normalizedDepartment = stepDept.toLowerCase();
  const isIctClearance =
    normalizedDepartment.includes("ict") ||
    normalizedDepartment.includes("information and communication technology");
  const allowed =
    normalizedRole === "hr" ||
    normalizedRole === "administrator" ||
    (normalizedRole === "management" &&
      normalizedDepartment.includes("department head")) ||
    (normalizedRole === "ict" && isIctClearance) ||
    (normalizedRole === "library" && normalizedDepartment.includes("librar"));
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
  if (stepData?.exit_request_id) {
    revalidatePath(`/dashboard/clearances/${stepData.exit_request_id}`);
    revalidatePath(`/dashboard/exit-requests/${stepData.exit_request_id}`);
  }
}

// Helper: check blockers for an exit request
export async function checkExitBlockers(exitRequestId: string) {
  const supabase = await createClient();
  const { data: exitReq, error: exitErr } = await supabase
    .from("exit_requests")
    .select("id, employee_id, status, clearance_departments")
    .eq("id", exitRequestId)
    .single();
  if (exitErr || !exitReq) throw new Error("Exit request not found.");

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, department_id, employment_category, is_technical")
    .eq("id", exitReq.employee_id)
    .single();
  if (employeeError?.code === "42703" || /employment_category.*(does not exist|could not find|schema cache)/i.test(employeeError?.message ?? "")) {
    throw new Error(
      "Exit clearance setup is incomplete: the employees.employment_category column is missing. Ask your administrator to apply the latest Supabase migrations, then reload this page.",
    );
  }
  if (employeeError || !employee) throw new Error("Employee record not found.");

  const { data: steps, error: stepsError } = await supabase
    .from("clearance_steps")
    .select("department,status,comments")
    .eq("exit_request_id", exitRequestId)
    .order("step_order", { ascending: true });
  if (stepsError) throw new Error("Unable to verify clearance steps.");

  const pending = (steps ?? []).filter(
    (s: ClearanceStep) => s.status !== "approved",
  );
  const expectedDepartments = exitReq.status === "completed"
    ? []
    : Array.isArray(exitReq.clearance_departments)
      ? exitReq.clearance_departments.map((department: string) => department.trim()).filter(Boolean)
      : [];
  const missingDepartments = expectedDepartments.filter(
    (department: string) => !(steps ?? []).some(
      (step: ClearanceStep) => step.department.trim().toLowerCase() === department.toLowerCase(),
    ),
  );

  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .select("id,asset_tag,asset_type,status,returned_at,verified_at")
    .eq("assigned_to", employee.id);
  if (assetsError) throw new Error("Unable to verify assigned assets.");
  const outstandingAssets = (assets ?? []).filter(
    (a: AssetRow) => a.status !== "verified" || !a.returned_at || !a.verified_at,
  );

  const { data: requirements, error: requirementsError } = await supabase
    .from("knowledge_requirements")
    .select("id,name,department_id,employment_category")
    .eq("active", true)
    .eq("is_required", true);
  if (requirementsError) throw new Error("Unable to verify mandatory knowledge requirements.");
  const applicableRequirements = (requirements ?? []).filter((requirement) => {
    const matchesDepartment =
      !requirement.department_id ||
      requirement.department_id === employee.department_id;
    const matchesCategory =
      !requirement.employment_category ||
      requirement.employment_category === employee.employment_category;
    return matchesDepartment && matchesCategory;
  });

  const { data: docs, error: docsError } = await supabase
    .from("knowledge_documents")
    .select("id,requirement_id,status")
    .eq("employee_id", employee.id);
  if (docsError) throw new Error("Unable to verify knowledge handover documents.");
  const approvedDocs = (docs ?? []).filter((document) =>
    ["approved", "verified"].includes(String(document.status).toLowerCase()),
  );
  const missingKnowledge = applicableRequirements
    .filter(
      (requirement) =>
        !approvedDocs.some((document) => document.requirement_id === requirement.id),
    )
    .map((requirement) => `Required knowledge handover is missing or unapproved: ${requirement.name}.`);
  if (employee.is_technical && approvedDocs.length === 0) {
    missingKnowledge.push("Technical staff must upload at least one approved knowledge handover document.");
  }
  if (employee.is_technical && applicableRequirements.length === 0) {
    missingKnowledge.push("No mandatory knowledge requirements are configured for this technical employee.");
  }

  const blockers: Record<string, unknown> = {};
  if (pending.length || missingDepartments.length)
    blockers.clearance = [
      ...pending.map((p: ClearanceStep) => ({
        department: p.department,
        status: p.status,
        comments: p.comments,
      })),
      ...missingDepartments.map((department: string) => ({
        department,
        status: "missing",
        comments: `Required clearance step was not provisioned for ${department}.`,
      })),
    ];
  if (outstandingAssets.length)
    blockers.assets = outstandingAssets.map((a: AssetRow) => ({
      id: a.id,
      tag: a.asset_tag,
      type: a.asset_type,
      status: a.status,
    }));
  if (missingKnowledge.length) blockers.knowledge = missingKnowledge;

  const blockerList: Array<{ type: string; title: string; details: string }> =
    [];

  if (Array.isArray(blockers.clearance)) {
    (blockers.clearance as Array<Record<string, unknown>>).forEach((block) => {
      const department =
        typeof block.department === "string" ? block.department : "Department";
      const comments =
        typeof block.comments === "string" && block.comments.trim();
      blockerList.push({
        type: "clearance",
        title: `${department} clearance pending`,
        details:
          comments ||
          `The ${department} clearance step is still awaiting approval.`,
      });
    });
  }

  if (Array.isArray(blockers.assets)) {
    (blockers.assets as Array<Record<string, unknown>>).forEach((block) => {
      const tag = typeof block.tag === "string" ? block.tag : "asset";
      blockerList.push({
        type: "asset",
        title: `Asset not returned`,
        details: `${tag} is still assigned and has not been returned or verified.`,
      });
    });
  }

  if (Array.isArray(blockers.knowledge)) {
    (blockers.knowledge as string[]).forEach((message) => {
      blockerList.push({
        type: "knowledge",
        title: "Knowledge handover incomplete",
        details: message,
      });
    });
  }

  return {
    blocked: blockerList.length > 0,
    blockers: blockerList.length > 0 ? blockerList : [],
  };
}

export async function canFinalizeExit(exitRequestId: string) {
  const { blocked, blockers } = await checkExitBlockers(exitRequestId);

  const reasons: Array<{ type: string; message: string; department?: string }> =
    [];

  if (Array.isArray(blockers)) {
    blockers.forEach((block) => {
      const normalizedType = block.type.toLowerCase();
      reasons.push({
        type: normalizedType,
        department:
          normalizedType === "clearance"
            ? block.title.replace(/ clearance.*$/i, "")
            : undefined,
        message: block.details,
      });
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
  if (!["administrator", "hr"].includes(userRole.toLowerCase())) {
    throw new Error("You are not authorized to finalize exits.");
  }
  const { data, error } = await supabase.rpc("finalize_exit", {
    p_exit_request_id: exitRequestId,
    p_actor_id: user.id,
  });
  if (error) throw new Error(`Unable to finalize exit request: ${error.message}`);
  const result = data as {
    success?: boolean;
    blockers?: Array<{ message?: string }>;
  } | null;
  if (!result?.success) {
    const blockerMessages = result?.blockers
      ?.map((blocker) => blocker.message)
      .filter((message): message is string => !!message);
    throw new Error(
      blockerMessages?.join("; ") || "Exit request is blocked and cannot be finalized.",
    );
  }
  revalidatePath("/dashboard/exit-requests");
  revalidatePath("/dashboard");
}

export async function uploadKnowledgeDocument(formData: FormData) {
  const { supabase, user } = await actor();
  const file = formData.get("file");
  const title = String(formData.get("title") ?? "").trim();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const requirementId = String(formData.get("requirement_id") ?? "").trim() || null;
  if (!(file instanceof File) || file.size === 0 || !title || !employeeId)
    throw new Error("Title, employee, and a file are required.");
  if (title.length > 200 || file.name.length > 255)
    throw new Error("The title must be 200 characters or fewer and the file name 255 characters or fewer.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Files must be smaller than 10 MB.");
  const allowedMimeByExtension: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const validatedMimeType = allowedMimeByExtension[extension];
  if (!validatedMimeType || (file.type && file.type.toLowerCase() !== validatedMimeType)) {
    throw new Error("Upload a PDF, Word, Excel, or PowerPoint document with a matching file type.");
  }
  const role = await resolveEffectiveUserRole(supabase, user);
  if (!["administrator", "hr"].includes(role.toLowerCase())) {
    const { data: ownEmployee, error: ownEmployeeError } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ownEmployeeError) throw new Error("Unable to verify your employee record.");
    if (ownEmployee?.id !== employeeId) {
      throw new Error("You can only upload knowledge documents for your own employee record.");
    }
  }
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("department_id,employment_category")
    .eq("id", employeeId)
    .single();
  if (employeeError || !employee) throw new Error("Employee record not found.");
  let requirement: {
    id: string;
    department_id: string | null;
    employment_category: string | null;
    category_id: string | null;
  } | null = null;
  if (requirementId) {
    const { data, error } = await supabase
      .from("knowledge_requirements")
      .select("id,department_id,employment_category,category_id")
      .eq("id", requirementId)
      .eq("active", true)
      .single();
    if (error || !data) throw new Error("Knowledge requirement not found or inactive.");
    requirement = data;
    if (
      (requirement.department_id && requirement.department_id !== employee.department_id) ||
      (requirement.employment_category &&
        requirement.employment_category !== employee.employment_category)
    ) {
      throw new Error("This knowledge requirement does not apply to the selected employee.");
    }
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120);
  const path = `private/${employeeId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("knowledge-documents")
    .upload(path, file, {
      contentType: validatedMimeType,
      upsert: false,
    });
  if (uploadError) throw new Error("Unable to upload document.");
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert({
      employee_id: employeeId,
      requirement_id: requirement?.id ?? null,
      category_id: requirement?.category_id ?? null,
      title,
      storage_path: path,
      category: String(formData.get("category") ?? "").trim() || null,
      file_name: file.name,
      mime_type: validatedMimeType,
      file_size: file.size,
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
    requirement_id: requirement?.id ?? null,
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
  await requireAnyRole(supabase, user, ["administrator", "hr"]);
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
  if (!documentId || !["approved", "rejected", "revision_required"].includes(action))
    throw new Error("Document and decision are required.");

  const { data: doc, error: documentError } = await supabase
    .from("knowledge_documents")
    .select("id, employee_id, requirement_id, status")
    .eq("id", documentId)
    .single();
  if (documentError || !doc) throw new Error("Document not found.");
  const { data: canReview, error: reviewerError } = await supabase.rpc(
    "can_review_knowledge_document",
    {
      p_employee_id: doc.employee_id,
      p_requirement_id: doc.requirement_id,
    },
  );
  if (reviewerError || canReview !== true) {
    throw new Error("You are not authorized to review this knowledge document.");
  }

  const nextStatus = action;

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
  if (!existingProfile) {
    throw new Error("Your account profile is not initialized. Contact an administrator.");
  }

  // The assigned role is never accepted from onboarding form data. This stops
  // a user from creating a conflicting or elevated role for themselves.
  const role = String(existingProfile.role ?? "Employee").trim() || "Employee";

  const profile = {
    full_name: fullName,
    department_id: departmentRow.id,
  };

  // Profile creation is handled by the trusted Auth trigger; onboarding only
  // updates the signed-in user's existing profile.
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

  if (!updatedProfile) throw new Error("Your account profile is not initialized. Contact an administrator.");

  const { data: existingEmployee } = await supabase
    .from("employees")
    .select("id,user_id,department_id")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (existingEmployee && existingEmployee.user_id !== user.id) {
    if (existingEmployee.user_id) {
      throw new Error("This employee record is already linked to another account.");
    }
    const { error: linkError } = await supabase
      .from("employees")
      .update({ user_id: user.id, department_id: departmentId })
      .eq("id", existingEmployee.id)
      .is("user_id", null);
    if (linkError) {
      throw new Error("Profile saved, but the employee record could not be linked.");
    }
  } else if (!existingEmployee) {
    const employeeNumber = `USER-${user.id.slice(0, 8).toUpperCase()}`;
    const { error: employeeError } = await supabase.from("employees").insert({
      employee_number: employeeNumber,
      user_id: user.id,
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
  } else if (!existingEmployee.department_id) {
    const { error: departmentLinkError } = await supabase
      .from("employees")
      .update({ department_id: departmentId })
      .eq("id", existingEmployee.id)
      .eq("user_id", user.id);
    if (departmentLinkError) {
      throw new Error("Profile saved, but the employee department could not be linked.");
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

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await actor();
  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) throw new Error("Full name is required.");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", user.id);
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

  if ((employeeRef?.length ?? 0) > 0) {
    const { error: employeeClearError } = await supabase
      .from("employees")
      .update({ department_id: null })
      .eq("department_id", id);

    if (employeeClearError) {
      throw new Error(
        employeeClearError.message ||
          "Unable to clear employee department assignments.",
      );
    }
  }

  if ((profileRef?.length ?? 0) > 0) {
    const { error: profileClearError } = await supabase
      .from("profiles")
      .update({ department_id: null })
      .eq("department_id", id);

    if (profileClearError) {
      throw new Error(
        profileClearError.message ||
          "Unable to clear profile department assignments.",
      );
    }
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
  const rawValue = String(formData.get("value") ?? "").trim();
  let value: string;

  switch (key) {
    case "organization_name":
      if (!rawValue || rawValue.length > 120) {
        throw new Error("Institution name must contain 1–120 characters.");
      }
      value = rawValue;
      break;
    case "default_clearance_departments": {
      const departments = [...new Set(
        rawValue.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean),
      )];
      if (
        departments.length === 0 ||
        departments.length > 20 ||
        departments.some((department) => department.length > 80)
      ) {
        throw new Error("Enter between 1 and 20 clearance departments, each no longer than 80 characters.");
      }
      value = JSON.stringify(departments);
      break;
    }
    case "retention_days": {
      const days = Number(rawValue);
      if (!Number.isInteger(days) || days < 30 || days > 3650) {
        throw new Error("Knowledge retention must be a whole number from 30 to 3,650 days.");
      }
      value = String(days);
      break;
    }
    case "notification_channel":
      if (!["email", "in_app", "both"].includes(rawValue)) {
        throw new Error("Choose email, in-app, or both notification channels.");
      }
      value = rawValue;
      break;
    default:
      throw new Error("This system setting is not supported.");
  }

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
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  const asset = {
    asset_tag: String(formData.get("asset_tag") ?? "").trim(),
    asset_type: String(formData.get("asset_type") ?? "").trim(),
    current_location: String(formData.get("current_location") ?? "").trim() || null,
    description: String(formData.get("description") ?? "").trim() || null,
    status: "available",
  };
  if (!asset.asset_tag || !asset.asset_type)
    throw new Error("Enter an asset tag and asset type to continue.");
  const { data, error } = await supabase
    .from("assets")
    .insert(asset)
    .select("id")
    .single();
  if (error?.code === "23505")
    throw new Error("That asset tag is already in use. Check the tag and try again.");
  if (error?.code === "42703" || error?.code === "PGRST204") {
    throw new Error("Asset setup is incomplete in the database. Ask your administrator to apply the latest Supabase migrations.");
  }
  if (error) {
    console.error("Asset creation failed", { code: error.code });
    throw new Error("We couldn’t add this asset right now. Check the details and try again.");
  }
  await audit(supabase, user.id, "created", "asset", data.id, {
    asset_tag: asset.asset_tag,
    asset_type: asset.asset_type,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath("/dashboard/assets/activity");
}

export async function assignAsset(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  const assetId = String(formData.get("asset_id") ?? "");
  const employeeId = String(formData.get("employee_id") ?? "");
  if (!assetId || !employeeId)
    throw new Error("Asset and employee are required.");
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id")
    .eq("id", employeeId)
    .eq("employment_status", "active")
    .maybeSingle();
  if (employeeError) throw new Error("Unable to verify the employee.");
  if (!employee) throw new Error("Assets may only be assigned to an active employee.");
  const { data: updated, error } = await supabase
    .from("assets")
    .update({ assigned_to: employeeId, status: "assigned" })
    .eq("id", assetId)
    .eq("status", "available")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to assign asset.");
  if (!updated) throw new Error("Only available assets can be assigned.");
  const { error: historyError } = await supabase.from("asset_history").insert({
    asset_id: assetId,
    action: "assigned",
    actor_id: user.id,
    previous_status: "available",
    new_status: "assigned",
    notes: `Assigned to ${employeeId}`,
  });
  if (historyError) throw new Error("Asset was assigned, but its history could not be recorded.");
  await audit(supabase, user.id, "assigned", "asset", assetId, {
    assigned_to: employeeId,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets/activity");
}

export async function releaseVerifiedAsset(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  const assetId = String(formData.get("asset_id") ?? "").trim();
  if (!assetId) throw new Error("Choose an asset to release.");
  const { data: updated, error } = await supabase
    .from("assets")
    .update({ assigned_to: null, status: "available", returned_at: null, verified_at: null })
    .eq("id", assetId)
    .eq("status", "verified")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("We couldn’t release this asset for reassignment. Please try again.");
  if (!updated) throw new Error("Only a returned and verified asset can be released for reassignment.");
  const { error: historyError } = await supabase.from("asset_history").insert({
    asset_id: assetId,
    action: "released",
    actor_id: user.id,
    previous_status: "verified",
    new_status: "available",
    notes: "Released after return verification for future assignment.",
  });
  if (historyError) throw new Error("The asset was released, but its history could not be recorded. Contact an administrator.");
  await audit(supabase, user.id, "released", "asset", assetId);
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets/returns");
  revalidatePath("/dashboard/assets/activity");
}

export async function receiveAssetReturn(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const returnLocation = String(formData.get("return_location") ?? "").trim();
  if (!assetId) throw new Error("Asset is required.");
  if (!returnLocation) throw new Error("Enter where the returned asset is being received.");
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id, status")
    .eq("id", assetId)
    .single();
  if (assetError || !asset) throw new Error("Asset not found.");
  if (!["assigned", "damaged"].includes(asset.status)) {
    throw new Error("Only an assigned asset can be marked as received.");
  }
  const receivedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("assets")
    .update({ status: "returned", returned_at: receivedAt, verified_at: null, current_location: returnLocation })
    .eq("id", assetId)
    .in("status", ["assigned", "damaged"])
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to record asset return.");
  if (!updated) throw new Error("The asset's state changed before the return could be recorded.");
  const { error: historyError } = await supabase.from("asset_history").insert({
    asset_id: assetId,
    action: "returned",
    actor_id: user.id,
    previous_status: asset.status,
    new_status: "returned",
    notes: `${String(formData.get("notes") ?? "").trim() || "Return received for inspection."} Received at: ${returnLocation}`,
  });
  if (historyError) throw new Error("Return was recorded, but the asset history could not be saved.");
  await audit(supabase, user.id, "returned", "asset", assetId);
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets/returns");
  revalidatePath("/dashboard/exit-requests");
}

export async function verifyAsset(formData: FormData) {
  const { supabase, user } = await actor();
  await requireAnyRole(supabase, user, ["administrator", "hr", "ict", "library"]);
  const assetId = String(formData.get("asset_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!assetId) throw new Error("Asset is required.");
  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .select("id,status,returned_at")
    .eq("id", assetId)
    .single();
  if (assetError || !asset) throw new Error("Asset not found.");
  if (asset.status !== "returned" || !asset.returned_at) {
    throw new Error("The asset must be received before its return can be verified.");
  }
  const verifiedAt = new Date().toISOString();
  const { data: updated, error } = await supabase
    .from("assets")
    .update({ status: "verified", verified_at: verifiedAt })
    .eq("id", assetId)
    .eq("status", "returned")
    .select("id")
    .maybeSingle();
  if (error) throw new Error("Unable to update asset verification.");
  if (!updated) throw new Error("The asset's state changed before the return could be verified.");
  const { error: historyError } = await supabase
    .from("asset_history")
    .insert({ asset_id: assetId, action: "verified", actor_id: user.id, previous_status: "returned", new_status: "verified", notes });
  if (historyError) throw new Error("Asset verification was saved, but its history could not be recorded.");
  await audit(supabase, user.id, "verified", "asset", assetId, {
    notes,
  });
  revalidatePath("/dashboard/assets");
  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets/returns");
  revalidatePath("/dashboard/exit-requests");
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

  const actorRole = (await resolveEffectiveUserRole(supabase, user)).toLowerCase();
  if (actorRole !== "administrator") {
    throw new Error("Only an Administrator can change user roles.");
  }

  const userId = String(formData.get("user_id") ?? "");
  const newRole = String(formData.get("role") ?? "");

  if (!userId || !newRole) {
    throw new Error("User ID and role are required.");
  }
  if (
    ![
      "Employee",
      "HR",
      "Administrator",
      "ICT",
      "Library",
      "Management",
      "Academic Attaché",
      "Support Staff",
    ].includes(newRole)
  ) {
    throw new Error("Select a supported user role.");
  }

  const adminClient = createAdminClient();
  const { data: updatedProfile, error: profileError } = await adminClient
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (profileError || !updatedProfile) {
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

  await requireAdminRole(supabase, user);
  const actorRole = (await resolveEffectiveUserRole(supabase, user)).toLowerCase();

  const userId = String(formData.get("user_id") ?? "");

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (targetProfileError || !targetProfile) {
    throw new Error("Unable to verify the target account role.");
  }
  const targetRole = normalizeUserRole(targetProfile.role ?? "").toLowerCase();
  if (actorRole !== "administrator" && (targetRole === "administrator" || targetRole === "hr")) {
    throw new Error("Only an Administrator may deactivate an Administrator or HR account.");
  }

  // Prevent self-disable
  if (userId === user.id) {
    throw new Error("You cannot disable your own account.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("id, employment_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (employeeError) throw new Error("Unable to verify the employee's exit status.");
  if (employee) {
    if (employee.employment_status !== "exited") {
      throw new Error("An employee account can only be deactivated after its digital exit is finalized.");
    }
    const { data: completedExit, error: exitError } = await supabase
      .from("exit_requests")
      .select("id")
      .eq("employee_id", employee.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exitError) throw new Error("Unable to verify the completed exit.");
    if (!completedExit) {
      throw new Error("A completed digital exit is required before account deactivation.");
    }
    const readiness = await canFinalizeExit(completedExit.id);
    if (!readiness.eligible) {
      throw new Error(
        readiness.blockers.map((blocker) => blocker.message).join("; ") ||
          "Exit clearance is incomplete.",
      );
    }
  }

  const adminClient = createAdminClient();
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    { ban_duration: "876000h" },
  );
  if (authError) throw new Error("Unable to disable authentication for this account.");

  const { error } = await adminClient
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

  await requireAdminRole(supabase, user);
  const actorRole = (await resolveEffectiveUserRole(supabase, user)).toLowerCase();

  const userId = String(formData.get("user_id") ?? "");

  if (!userId) {
    throw new Error("User ID is required.");
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (targetProfileError || !targetProfile) {
    throw new Error("Unable to verify the target account role.");
  }
  const targetRole = normalizeUserRole(targetProfile.role ?? "").toLowerCase();
  if (actorRole !== "administrator" && (targetRole === "administrator" || targetRole === "hr")) {
    throw new Error("Only an Administrator may reactivate an Administrator or HR account.");
  }

  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .select("employment_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (employeeError) throw new Error("Unable to verify employee status.");
  if (employee?.employment_status === "exited") {
    throw new Error("A finalized former employee account cannot be reactivated.");
  }

  const adminClient = createAdminClient();
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    { ban_duration: "none" },
  );
  if (authError) throw new Error("Unable to reactivate authentication for this account.");

  const { error } = await adminClient
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
