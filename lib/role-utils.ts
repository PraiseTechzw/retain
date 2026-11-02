export type UserRole =
  | "Administrator"
  | "HR";

export type RoleKey = "administrator" | "hr" | "unknown";
export type DashboardCapability =
  | "manageEmployees"
  | "manageExitCases"
  | "reviewLeave"
  | "manageHrRequests"
  | "viewReports"
  | "viewUserManagement"
  | "manageUserAccounts"
  | "manageSystemSettings";

const roleCapabilities: Record<RoleKey, readonly DashboardCapability[]> = {
  administrator: [
    "manageEmployees",
    "manageExitCases",
    "reviewLeave",
    "manageHrRequests",
    "viewReports",
    "viewUserManagement",
    "manageUserAccounts",
    "manageSystemSettings",
  ],
  hr: [
    "manageEmployees",
    "manageExitCases",
    "reviewLeave",
    "manageHrRequests",
    "viewReports",
  ],
  unknown: [],
};

export function getRoleKey(role: string | null | undefined): RoleKey {
  const normalized = (role ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "admin" || normalized === "administrator") {
    return "administrator";
  }
  if (normalized === "hr" || normalized === "hr manager") return "hr";
  return "unknown";
}

export function roleHasCapability(
  role: string | null | undefined,
  capability: DashboardCapability,
) {
  return roleCapabilities[getRoleKey(role)].includes(capability);
}

export function normalizeUserRole(role: string | null | undefined): string {
  const trimmed = role?.trim();

  if (!trimmed) return "Unknown";

  switch (getRoleKey(trimmed)) {
    case "administrator":
      return "Administrator";
    case "hr":
      return "HR";
    case "unknown":
      return "Unknown";
  }
}
