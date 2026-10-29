export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "CUT-HRMERS",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "CUT-HRMERS",
  workspaceLabel:
    process.env.NEXT_PUBLIC_WORKSPACE_LABEL ||
    "Chinhoyi University of Technology",
  subtitle:
    process.env.NEXT_PUBLIC_APP_SUBTITLE ||
    "Human Resource Management & Employee Retention",
  organization:
    process.env.NEXT_PUBLIC_ORGANIZATION_NAME ||
    "Chinhoyi University of Technology",
  defaultUserName: process.env.NEXT_PUBLIC_DEFAULT_USER_NAME || "User",
  defaultRole: "Employee",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
} as const;

export const defaultSystemSettings = {
  organization_name: appConfig.organization,
  // Kept temporarily so existing database settings can be read during the
  // CUT-HRMERS transition. The clearance workflow is no longer exposed.
  default_clearance_departments: [],
  notification_channel: "email",
  retention_days: "2555",
  security_mode: "standard",
} as const;

export type SystemSettingKey = keyof typeof defaultSystemSettings;

export function getDefaultSystemSettings() {
  return {
    ...defaultSystemSettings,
    default_clearance_departments: [],
  };
}

export function parseStoredList(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String).map((item) => item.trim()).filter(Boolean) : [];
  } catch {
    return value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  }
}

export function resolveSystemSettingValue(
  key: SystemSettingKey,
  rawValue: string | null | undefined,
) {
  if (key === "default_clearance_departments") return parseStoredList(rawValue).join(", ");
  return rawValue?.trim() || defaultSystemSettings[key];
}

export function getGreeting(name?: string) {
  const hour = Number(
    new Intl.DateTimeFormat("en", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Africa/Harare",
    }).format(new Date()),
  );
  const prefix =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${prefix}${name ? `, ${name}` : ""}`;
}

export function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}
