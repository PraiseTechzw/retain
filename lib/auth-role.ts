import { createClient } from "@/lib/supabase/server";
import { appConfig } from "@/lib/system";
import { redirect } from "next/navigation";

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
    return "Employee";
  }

  const normalized = trimmed.toLowerCase();
  const exactRoles: Record<string, string> = {
    admin: "Administrator",
    administrator: "Administrator",
    hr: "HR",
    ict: "ICT",
    "information and communication technology": "ICT",
    library: "Library",
    "library services": "Library",
    management: "Management",
    "academic attaché": "Academic Attaché",
    "academic attache": "Academic Attaché",
    "support staff": "Support Staff",
    employee: "Employee",
  };

  return exactRoles[normalized] ?? trimmed;
}

export async function resolveDashboardUserContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, active")
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
