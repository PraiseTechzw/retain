"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { signOut } from "@/lib/supabase/actions";
import { appConfig, getInitials } from "@/lib/system";
import { NotificationCenter } from "@/components/notification-center";
import { UserPreferencesProvider } from "@/components/user-preferences";

function resolveDisplayRole(userRole?: string | null) {
  if (!userRole) {
    return appConfig.defaultRole;
  }

  const value = userRole.trim();
  if (!value) {
    return appConfig.defaultRole;
  }

  const lower = value.toLowerCase();

  if (lower === "admin" || lower.includes("administrator")) {
    return "Administrator";
  }

  if (lower.includes("hr")) {
    return "HR";
  }

  if (lower.includes("ict")) {
    return "ICT";
  }

  if (lower.includes("library")) {
    return "Library";
  }

  if (lower.includes("attache") || lower.includes("attaché")) {
    return "Academic Attaché";
  }

  if (lower.includes("support")) {
    return "Support Staff";
  }

  if (lower.includes("management") || lower.includes("operations")) {
    return "Management";
  }

  return value;
}

const navItems = [
  [
    "Overview",
    "/dashboard",
    LayoutDashboard,
    ["employee", "hr", "administrator", "management"],
  ],
  ["Users", "/dashboard/user-management", Users, ["administrator", "hr"]],
  [
    "Employees",
    "/dashboard/employees",
    Users,
    ["hr", "administrator", "management"],
  ],
  [
    "Exit Requests",
    "/dashboard/exit-requests",
    ClipboardCheck,
    ["employee", "hr", "administrator", "management"],
  ],
  [
    "Leave",
    "/dashboard/leave",
    CalendarDays,
    [
      "employee",
      "academic attaché",
      "support staff",
      "ict",
      "library",
      "management",
      "hr",
      "administrator",
    ],
  ],
  [
    "Clearances",
    "/dashboard/clearances",
    ShieldCheck,
    ["employee", "hr", "administrator", "management"],
  ],
  [
    "Assets",
    "/dashboard/assets",
    PackageCheck,
    ["hr", "administrator", "management", "ict", "library"],
  ],
  [
    "Asset Activity",
    "/dashboard/assets/activity",
    Activity,
    ["hr", "administrator", "management", "ict", "library"],
  ],
  [
    "Knowledge Hub",
    "/dashboard/knowledge-hub",
    BookOpen,
    ["employee", "hr", "administrator", "management", "ict", "library"],
  ],
  [
    "Analytics",
    "/dashboard/analytics",
    BarChart3,
    ["hr", "administrator", "management"],
  ],
  [
    "Talent Risk",
    "/dashboard/talent-risk",
    Activity,
    ["hr", "administrator", "management"],
  ],
  [
    "Recruitment",
    "/dashboard/recruitment",
    BriefcaseBusiness,
    ["hr", "administrator", "management"],
  ],
  [
    "Reports",
    "/dashboard/reports",
    FileText,
    ["hr", "administrator", "management"],
  ],
  ["Settings", "/dashboard/settings", Settings2, ["hr", "administrator"]],
] as const;

function canAccessNavItem(userRole: string, allowedRoles: readonly string[]) {
  const normalizedRole = userRole.toLowerCase();
  return allowedRoles.some(
    (role) =>
      normalizedRole.includes(role) ||
      (role === "employee" &&
        (normalizedRole.includes("academic attaché") ||
          normalizedRole.includes("support staff"))),
  );
}

function SidebarNav({
  pathname,
  collapsed,
  mobileOpen,
  onClose,
  userName,
  userRole,
}: {
  pathname: string;
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  userName: string;
  userRole: string;
}) {
  const initials = getInitials(userName);

  return (
    <>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 shadow-xl transition-all duration-200 lg:static ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} ${collapsed ? "lg:w-24" : "lg:w-72"}`}
      >
        <div
          className={`flex items-center gap-2 ${collapsed ? "lg:justify-center" : "px-2"}`}
        >
          <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-0.5">
            <Image
              src="/cut-logo-sidebar.png"
              alt="Chinhoyi University of Technology"
              width={1254}
              height={1254}
              priority
              className="h-full w-full object-contain"
            />
          </div>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="truncate text-xs font-bold leading-tight text-foreground">
              {appConfig.shortName}
            </p>
            <p className="text-[10px] font-semibold uppercase leading-relaxed tracking-[0.14em] text-muted-foreground">
              {appConfig.subtitle}
            </p>
          </div>
          <button
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground lg:hidden"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className={`mt-7 flex items-center justify-between px-3 ${collapsed ? "lg:justify-center" : ""}`}
        >
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}
          >
            Workspace
          </p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar-accent/50 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span className={collapsed ? "lg:hidden" : ""}>Live</span>
          </span>
        </div>

        <nav
          aria-label="Workspace navigation"
          className={`mt-3 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pb-3 pr-1 ${collapsed ? "lg:items-center" : ""}`}
        >
          {navItems
            .filter(([, , , allowedRoles]) =>
              canAccessNavItem(userRole, allowedRoles),
            )
            .map(([label, href, Icon]) => {
              const active =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? label : undefined}
                  className={`group relative flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${collapsed ? "lg:justify-center lg:px-2" : "gap-3"} ${active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md shadow-primary/10" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition ${active ? "bg-primary-foreground/15" : "bg-sidebar-accent/60 group-hover:bg-sidebar-accent"}`}
                  >
                    <Icon
                      className="size-4.25"
                      strokeWidth={active ? 2.35 : 2}
                    />
                  </span>
                  <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
                  {active && (
                    <span
                      className={`absolute right-3 size-1.5 rounded-full bg-primary-foreground ${collapsed ? "lg:hidden" : ""}`}
                    />
                  )}
                </Link>
              );
            })}
        </nav>

        <div className="border-t border-sidebar-border pt-4">
          <Link
            href="/profile"
            title={collapsed ? userName : undefined}
            className={`group flex items-center rounded-2xl border border-sidebar-border/70 bg-sidebar-accent/55 p-3 transition hover:border-primary/30 hover:bg-sidebar-accent ${collapsed ? "lg:justify-center lg:px-2" : "gap-3"}`}
          >
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {initials}
              <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />
            </div>
            <div className="min-w-0">
              <p
                className={`truncate text-sm font-semibold ${collapsed ? "lg:hidden" : ""}`}
              >
                {userName}
              </p>
              <p
                className={`truncate text-xs text-muted-foreground ${collapsed ? "lg:hidden" : ""}`}
              >
                {userRole} · Online
              </p>
            </div>
            <ChevronDown
              className={`ml-auto size-4 text-muted-foreground transition group-hover:text-foreground ${collapsed ? "lg:hidden" : ""}`}
            />
          </Link>
        </div>
      </aside>
    </>
  );
}

export function DashboardShell({
  children,
  userName = appConfig.defaultUserName,
  userRole = appConfig.defaultRole,
  workspaceLabel = appConfig.workspaceLabel,
}: {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
  workspaceLabel?: string;
}) {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const displayName = userName || appConfig.defaultUserName;
  const displayRole = resolveDisplayRole(userRole);
  const headerWorkspaceLabel = workspaceLabel || appConfig.workspaceLabel;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isSearchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

      if (!isSearchShortcut) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const searchResults = searchQuery.trim()
    ? navItems.filter(([label, href, , allowedRoles]) => {
        const matchesQuery = label
          .toLowerCase()
          .includes(searchQuery.trim().toLowerCase());

        return matchesQuery && canAccessNavItem(displayRole, allowedRoles);
      })
    : [];

  return (
    <UserPreferencesProvider>
      <main className="h-screen overflow-hidden bg-background text-foreground">
        <div className="flex h-screen overflow-hidden">
          <SidebarNav
            pathname={pathname}
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
            userName={displayName}
            userRole={displayRole}
          />

          <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative flex min-h-19 items-center gap-3 border-b border-border/70 bg-background/90 px-4 shadow-[0_8px_24px_-24px_hsl(var(--foreground)/0.5)] backdrop-blur-xl md:gap-5 md:px-8">
              <button
                aria-label="Open navigation"
                className="rounded-xl border border-border/70 bg-card p-2.5 text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted hover:text-foreground lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="size-5" />
              </button>

              <button
                aria-label={
                  collapsed ? "Expand navigation" : "Collapse navigation"
                }
                className="hidden rounded-xl border border-border/70 bg-card p-2.5 text-muted-foreground shadow-sm transition hover:border-primary/30 hover:bg-muted hover:text-foreground lg:inline-flex"
                onClick={() => setCollapsed((value) => !value)}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-5" />
                ) : (
                  <PanelLeftClose className="size-5" />
                )}
              </button>

              <div className="hidden min-w-45 lg:block">
                <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  <LayoutDashboard className="size-3" />
                  Workspace
                </div>
                <p className="mt-1 truncate text-sm font-semibold">
                  {headerWorkspaceLabel}
                </p>
              </div>

              <div className="relative max-w-2xl flex-1">
                <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={inputRef}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchQuery("");
                    }
                  }}
                  aria-label="Search workspace"
                  placeholder="Search employees, requests, assets..."
                  className="h-11 w-full rounded-xl border border-input bg-card/80 pl-10 pr-20 text-sm outline-none shadow-sm transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:block">
                  ⌘ K
                </kbd>

                {searchQuery.trim() && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-xl border border-border bg-popover p-2 shadow-xl">
                    <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Quick links
                    </div>
                    <div className="space-y-1">
                      {searchResults.map(([label, href, Icon]) => (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setSearchQuery("")}
                          className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-sidebar-foreground/80 transition hover:bg-accent hover:text-foreground"
                        >
                          <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <Icon className="size-4" />
                          </span>
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {searchQuery.trim() && searchResults.length === 0 && (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 rounded-xl border border-border bg-popover p-3 text-sm text-muted-foreground shadow-xl">
                    No matching workspace pages found.
                  </div>
                )}
              </div>

              <NotificationCenter />

              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-xl border border-transparent px-2 py-1.5 text-left transition hover:border-border hover:bg-card md:flex"
              >
                <div className="relative flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {displayRole}
                  </p>
                </div>
              </Link>

              <form action={signOut}>
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:hover:border-rose-900 dark:hover:bg-rose-950/30 dark:hover:text-rose-300"
                >
                  <LogOut className="size-4" />
                  <span className="hidden xl:inline">Sign out</span>
                </button>
              </form>
            </header>

            <main className="flex-1 overflow-y-auto">{children}</main>
          </section>
        </div>
      </main>
    </UserPreferencesProvider>
  );
}

export function PageFrame({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-375 p-5 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-medium text-primary">
            {appConfig.appName} workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

export function Status({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tone === "green" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : tone === "amber" ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" : tone === "blue" ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}
    >
      {children}
    </span>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: Array<Array<string | React.ReactNode>>;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
      <table className="w-full min-w-170 text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="px-5 py-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/50 last:border-0 hover:bg-muted/30"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-5 py-4 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
import { type LucideIcon, Inbox } from "lucide-react";

export function EmptyState({
  label,
  icon: Icon = Inbox,
  description,
}: {
  label: string;
  icon?: LucideIcon;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-12 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-foreground">No {label} yet</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description ?? `${label} will show up here once they're available.`}
      </p>
    </div>
  );
}
