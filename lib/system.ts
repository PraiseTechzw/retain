export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Retain",
  shortName: process.env.NEXT_PUBLIC_APP_SHORT_NAME || "Retain",
  workspaceLabel:
    process.env.NEXT_PUBLIC_WORKSPACE_LABEL ||
    "Institutional continuity workspace",
  subtitle: process.env.NEXT_PUBLIC_APP_SUBTITLE || "Continuity OS",
  organization:
    process.env.NEXT_PUBLIC_ORGANIZATION_NAME || "Institutional continuity",
  defaultUserName: process.env.NEXT_PUBLIC_DEFAULT_USER_NAME || "User",
  defaultRole: process.env.NEXT_PUBLIC_DEFAULT_USER_ROLE || "Administrator",
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com",
} as const;

export function getGreeting(name?: string) {
  const hour = new Date().getHours();
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
