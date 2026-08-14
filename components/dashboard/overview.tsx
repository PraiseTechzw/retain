import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

type Metric = {
  label: string;
  value: number;
  description: string;
  href: string;
  icon: "employees" | "exits" | "clearances" | "knowledge";
  tone: "blue" | "amber" | "violet" | "emerald";
};

type Departure = {
  id: string;
  employeeName: string;
  employeeNumber: string;
  status: string;
  lastDay: string | null;
};

const iconMap = {
  employees: Users,
  exits: CalendarClock,
  clearances: ShieldCheck,
  knowledge: BookOpen,
};

const toneMap = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900",
  amber:
    "bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
  violet:
    "bg-violet-50 text-violet-700 ring-violet-100 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900",
  emerald:
    "bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
};

function formatDate(value: string | null) {
  if (!value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function statusTone(status: string) {
  if (status === "blocked") return "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
  if (status === "eligible_for_finalization") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

export function DashboardOverview({
  metrics,
  departures,
  clearanceTotal,
  clearanceApproved,
  clearancePending,
}: {
  metrics: Metric[];
  departures: Departure[];
  clearanceTotal: number;
  clearanceApproved: number;
  clearancePending: number;
}) {
  const clearanceRate = clearanceTotal
    ? Math.round((clearanceApproved / clearanceTotal) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace metrics">
        {metrics.map((metric) => {
          const Icon = iconMap[metric.icon];
          return (
            <Link
              key={metric.label}
              href={metric.href}
              className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className={`flex size-10 items-center justify-center rounded-xl ring-1 ${toneMap[metric.tone]}`}>
                  <Icon className="size-5" />
                </span>
                <ArrowRight className="mt-1 size-4 text-muted-foreground/0 transition group-hover:text-primary" />
              </div>
              <p className="mt-5 text-sm font-medium text-muted-foreground">{metric.label}</p>
              <p className="mt-1.5 text-3xl font-semibold tracking-tight">{metric.value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{metric.description}</p>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <div className="rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-6">
            <div>
              <p className="text-base font-semibold">Upcoming departures</p>
              <p className="mt-1 text-sm text-muted-foreground">Requests that still need operational attention.</p>
            </div>
            <Link href="/dashboard/exit-requests" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">
              View all <ArrowRight className="size-4" />
            </Link>
          </div>

          {departures.length ? (
            <div className="divide-y divide-border/60">
              {departures.map((departure) => (
                <Link key={departure.id} href={`/dashboard/exit-requests/${departure.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-muted/40 sm:px-6">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                    {departure.employeeName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold group-hover:text-primary">{departure.employeeName}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{departure.employeeNumber} · Last day {formatDate(departure.lastDay)}</p>
                  </div>
                  <span className={`hidden rounded-full px-2.5 py-1 text-xs font-medium capitalize sm:inline-flex ${statusTone(departure.status)}`}>
                    {statusLabel(departure.status)}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold">No open exit requests</p>
              <p className="mt-1 text-sm text-muted-foreground">New transitions will appear here when submitted.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-semibold">Clearance health</p>
              <p className="mt-1 text-sm text-muted-foreground">Completion across all active workflows.</p>
            </div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"><FileCheck2 className="size-5" /></span>
          </div>

          <div className="mt-7">
            <div className="flex items-end justify-between">
              <p className="text-4xl font-semibold tracking-tight">{clearanceRate}%</p>
              <p className="pb-1 text-sm text-muted-foreground">approved</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${clearanceRate}%` }} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3.5">
              <p className="text-2xl font-semibold">{clearanceApproved}</p>
              <p className="mt-1 text-xs text-muted-foreground">Approved steps</p>
            </div>
            <div className="rounded-xl bg-amber-50/80 p-3.5 dark:bg-amber-950/20">
              <p className="text-2xl font-semibold">{clearancePending}</p>
              <p className="mt-1 text-xs text-muted-foreground">Need review</p>
            </div>
          </div>

          <Link href="/dashboard/clearances" className="mt-5 flex items-center justify-between rounded-xl border border-border px-3.5 py-3 text-sm font-medium transition hover:border-primary/30 hover:bg-muted/50">
            <span className="inline-flex items-center gap-2"><ShieldAlert className="size-4 text-amber-600" />Review clearance queue</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Quick actions">
        <QuickAction href="/dashboard/employees" icon={Users} title="Manage employees" description="Update employee records and assignments." />
        <QuickAction href="/dashboard/exit-requests" icon={ClipboardCheck} title="Start an exit workflow" description="Create and track a structured offboarding request." />
        <QuickAction href="/dashboard/knowledge-hub" icon={BookOpen} title="Knowledge hub" description="Review documents retained for continuity." />
      </section>
    </div>
  );
}

function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: typeof Users; title: string; description: string }) {
  return <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition group-hover:bg-primary group-hover:text-primary-foreground"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>;
}
