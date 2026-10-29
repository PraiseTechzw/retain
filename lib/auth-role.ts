import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";
import { redirect } from "next/navigation";
import {
  normalizeUserRole,
  roleHasCapability,
  type DashboardCapability,
} from "@/lib/role-utils";

export {
  getRoleKey,
  normalizeUserRole,
  roleHasCapability,
} from "@/lib/role-utils";
export type {
  DashboardCapability,
  RoleKey,
  UserRole,
} from "@/lib/role-utils";

export async function requireDashboardCapability(
  capability: DashboardCapability,
) {
  const context = await resolveDashboardUserContext();
  if (!roleHasCapability(context.userRole, capability)) {
    redirect("/dashboard");
  }
  return context;
}

export async function resolveDashboardUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, active, department_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to verify account profile.");
  if (!profile || profile.active !== true) {
    redirect(
      "/auth/login?message=" +
        encodeURIComponent(
          profile
            ? "This account is inactive. Contact HR or an administrator."
            : "This account has no active profile. Contact an administrator.",
        ),
    );
  }
  const rawUserRole =
    typeof profile.role === "string" && profile.role.trim()
      ? profile.role.trim()
      : "Employee";
  const userRole = normalizeUserRole(rawUserRole);

  const userName =
    profile?.full_name ||
    (typeof user?.user_metadata?.full_name === "string"
      ? String(user.user_metadata.full_name)
      : "") ||
    user?.email?.split("@")[0] ||
    appConfig.defaultUserName;

  return {
    user,
    profile,
    userName,
    rawUserRole,
    userRole,
  };
}
