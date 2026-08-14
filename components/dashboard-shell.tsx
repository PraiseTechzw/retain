"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  BookOpen,
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
    "Clearances",
    "/dashboard/clearances",
    ShieldCheck,
    ["employee", "hr", "administrator", "management"],
  ],
  [
    "Assets",
    "/dashboard/assets",
    PackageCheck,
    ["hr", "administrator", "management"],
  ],
  [
    "Knowledge Hub",
    "/dashboard/knowledge-hub",
    BookOpen,
    ["employee", "hr", "administrator", "management"],
  ],
  [
    "Analytics",
    "/dashboard/analytics",
    BarChart3,
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
  return allowedRoles.some((role) => normalizedRole.includes(role));
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
          className={`flex items-center gap-3 ${collapsed ? "lg:justify-center" : "px-3"}`}
        >
          <div className="relative flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <ShieldCheck className="size-5" strokeWidth={2.25} />
            <span className="absolute -bottom-1 -right-1 size-3 rounded-full border-2 border-sidebar bg-emerald-500" />
          </div>
          <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <p className="text-lg font-semibold tracking-tight">
              {appConfig.appName}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
          className={`mt-9 flex items-center justify-between px-3 ${collapsed ? "lg:justify-center" : ""}`}
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
          className={`mt-4 flex flex-1 flex-col gap-1 ${collapsed ? "lg:items-center" : ""}`}
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
                      className="size-[17px]"
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState(false);
  const displayName = userName || appConfig.defaultUserName;
  const displayRole = resolveDisplayRole(userRole);
  const headerWorkspaceLabel = workspaceLabel || appConfig.workspaceLabel;

  return (
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
          <header className="relative flex min-h-[76px] items-center gap-3 border-b border-border/70 bg-background/90 px-4 shadow-[0_8px_24px_-24px_hsl(var(--foreground)/0.5)] backdrop-blur-xl md:gap-5 md:px-8">
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

            <div className="hidden min-w-[180px] lg:block">
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
                aria-label="Search workspace"
                placeholder="Search employees, requests, assets..."
                className="h-11 w-full rounded-xl border border-input bg-card/80 pl-10 pr-20 text-sm outline-none shadow-sm transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground xl:block">
                ⌘ K
              </kbd>
            </div>

            <button
              aria-label="Notifications"
              onClick={() => setNotice(!notice)}
              className="relative rounded-xl border border-transparent p-2.5 text-muted-foreground transition hover:border-border hover:bg-card hover:text-foreground focus-visible:border-primary focus-visible:outline-none"
            >
              <Bell className="size-5" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500 ring-2 ring-background" />
            </button>

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

      {notice && (
        <div className="fixed right-5 top-20 z-50 w-80 rounded-2xl border border-border bg-card p-4 shadow-xl">
          <p className="text-sm font-semibold">Workspace updates</p>
          <p className="mt-2 text-sm text-muted-foreground">
            No new action items right now.
          </p>
        </div>
      )}
    </main>
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
    <div className="mx-auto max-w-[1500px] p-5 md:p-8">
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
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-border/70 bg-card">
      <table className="w-full min-w-[680px] text-left text-sm">
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

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <p className="font-semibold">No {label} yet</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Connected Supabase records will appear here when available.
      </p>
    </div>
  );
}
