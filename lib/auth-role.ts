import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";

export type UserRole =
  | "Administrator"
  | "HR"
  | "ICT"
  | "Library"
  | "Management"
  | "Academic Attaché"
  | "Support Staff"
  | "Employee";

export function normalizeUserRole(role: string | null | undefined): string {
  const trimmed = role?.trim();

  if (!trimmed) {
    return appConfig.defaultRole;
  }

  const normalized = trimmed.toLowerCase();

  if (normalized === "admin" || normalized.includes("administrator")) {
    return "Administrator";
  }

  if (normalized.includes("hr")) {
    return "HR";
  }

  if (normalized.includes("ict")) {
    return "ICT";
  }

  if (normalized.includes("library")) {
    return "Library";
  }

  if (normalized.includes("attache") || normalized.includes("attaché")) {
    return "Academic Attaché";
  }

  if (normalized.includes("support")) {
    return "Support Staff";
  }

  if (normalized.includes("management") || normalized.includes("operations")) {
    return "Management";
  }

  if (normalized === "employee" || normalized.includes("staff")) {
    return "Employee";
  }

  return trimmed;
}

export async function resolveDashboardUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const authRole = normalizeUserRole(
    typeof user?.user_metadata?.role === "string"
      ? String(user.user_metadata.role)
      : null,
  );

  const profileRole = normalizeUserRole(
    typeof profile?.role === "string" ? String(profile.role) : null,
  );

  const effectiveRole =
    authRole && authRole !== appConfig.defaultRole ? authRole : profileRole;

  const userRole = normalizeUserRole(
    effectiveRole || authRole || profileRole || appConfig.defaultRole,
  );

  const userName =
    profile?.full_name ||
    (typeof user?.user_metadata?.full_name === "string"
      ? String(user.user_metadata.full_name)
      : "") ||
    user?.email?.split("@")[0] ||
    appConfig.defaultUserName;

  const roleSource =
    authRole && authRole !== appConfig.defaultRole
      ? "auth_metadata"
      : profileRole && profileRole !== appConfig.defaultRole
        ? "profile"
        : "default";

  if (process.env.NODE_ENV === "development") {
    console.log("[dashboard-role-debug]", {
      userId: user?.id ?? null,
      resolvedRole: userRole,
      roleSource,
      authRole,
      profileRole,
      defaultRole: appConfig.defaultRole,
    });
  }

  return {
    user,
    profile,
    userName,
    userRole,
    roleSource,
  };
}
