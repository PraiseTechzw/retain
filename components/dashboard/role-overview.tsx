import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardCheck,
  FileText,
  Settings2,
  Users,
  type LucideIcon,
} from "lucide-react";

export type DashboardMetric = {
  label: string;
  value: number;
  description: string;
  href: string;
  icon: "employees" | "exits" | "leave" | "requests" | "users";
};

export type DashboardAction = {
  href: string;
  title: string;
  description: string;
  icon: "employees" | "leave" | "requests" | "reports" | "settings" | "users";
};

export type DashboardDeparture = {
  id: string;
  employeeName: string;
  employeeNumber: string;
  status: string;
  lastDay: string | null;
};

const metricIcons: Record<DashboardMetric["icon"], LucideIcon> = {
  employees: Users,
  exits: ClipboardCheck,
  leave: CalendarClock,
  requests: FileText,
  users: Users,
};

const actionIcons: Record<DashboardAction["icon"], LucideIcon> = {
  employees: BriefcaseBusiness,
  leave: CalendarClock,
  requests: FileText,
  reports: ClipboardCheck,
  settings: Settings2,
  users: Users,
};

function formatDate(value: string | null) {
  if (!value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function RoleDashboardOverview({
  audience,
  metrics,
  actions,
  departures = [],
  unlinkedEmployee = false,
}: {
  audience: string;
  metrics: DashboardMetric[];
  actions: DashboardAction[];
  departures?: DashboardDeparture[];
  unlinkedEmployee?: boolean;
}) {
  return (
    <div className="space-y-7">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.09] via-card to-card p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          {audience} workspace
        </p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Your work, at a glance
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A focused view of the information and actions available to your
              role.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="size-2 rounded-full bg-emerald-500" />
            Account active
          </span>
        </div>
      </section>

      {unlinkedEmployee && (
        <section
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
        >
          Your employee record is not linked yet. Contact HR to finish linking
          your self-service account.
        </section>
      )}

      <section
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Role dashboard metrics"
      >
        {metrics.map((metric) => {
          const Icon = metricIcons[metric.icon];
          return (
            <Link
              key={metric.label}
              href={metric.href}
              className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </div>
              <p className="mt-5 text-sm font-medium text-muted-foreground">
                {metric.label}
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight">
                {metric.value}
              </p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {metric.description}
              </p>
            </Link>
          );
        })}
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-semibold">Shortcuts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a task or continue where you left off.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => {
            const Icon = actionIcons[action.icon];
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group flex min-h-25 items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {action.title}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {action.description}
                  </span>
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            );
          })}
        </div>
      </section>

      {departures.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-5 py-5 sm:px-6">
            <div>
              <h2 className="text-base font-semibold">
                Exit cases needing attention
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Upcoming employee transitions ordered by last working day.
              </p>
            </div>
            <Link
              href="/dashboard/exit-requests"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Review cases <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="divide-y divide-border/60">
            {departures.map((departure) => (
              <Link
                key={departure.id}
                href={`/dashboard/exit-requests/${departure.id}`}
                className="group flex items-center gap-3 px-5 py-4 transition hover:bg-muted/40 sm:px-6"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                  {departure.employeeName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold group-hover:text-primary">
                    {departure.employeeName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {departure.employeeNumber} · Last day{" "}
                    {formatDate(departure.lastDay)}
                  </span>
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium capitalize text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {departure.status.replaceAll("_", " ")}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
