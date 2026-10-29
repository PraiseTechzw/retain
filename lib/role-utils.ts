export type UserRole =
  | "Administrator"
  | "HR"
  | "HR Manager"
  | "Employee";

export type RoleKey = "administrator" | "hr" | "hr_manager" | "employee";
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
  hr_manager: [
    "manageEmployees",
    "manageExitCases",
    "reviewLeave",
    "manageHrRequests",
    "viewReports",
  ],
  employee: [],
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
  if (normalized === "hr") return "hr";
  if (normalized === "hr manager") return "hr_manager";
  return "employee";
}

export function roleHasCapability(
  role: string | null | undefined,
  capability: DashboardCapability,
) {
  return roleCapabilities[getRoleKey(role)].includes(capability);
}

export function normalizeUserRole(role: string | null | undefined): string {
  const trimmed = role?.trim();

  if (!trimmed) {
    return "Employee";
  }

  switch (getRoleKey(trimmed)) {
    case "administrator":
      return "Administrator";
    case "hr":
      return "HR";
    case "hr_manager":
      return "HR Manager";
    case "employee":
      return "Employee";
  }
}
