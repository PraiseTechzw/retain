import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardCheck, Users } from "lucide-react";

type Metric = { label: string; value: number; description: string; href: string; icon: "employees" | "exits" | "leave" };
type Departure = { id: string; employeeName: string; employeeNumber: string; status: string; lastDay: string | null };
const icons = { employees: Users, exits: ClipboardCheck, leave: CalendarClock };

function formatDate(value: string | null) {
  if (!value) return "Date to be confirmed";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function DashboardOverview({ metrics, departures }: { metrics: Metric[]; departures: Departure[] }) {
  return <div className="space-y-6">
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="HR overview">
      {metrics.map((metric) => { const Icon = icons[metric.icon]; return <Link key={metric.label} href={metric.href} className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition hover:border-primary/25 hover:shadow-md"><Icon className="size-5 text-primary" /><p className="mt-5 text-sm font-medium text-muted-foreground">{metric.label}</p><p className="mt-1 text-3xl font-semibold">{metric.value}</p><p className="mt-2 text-xs text-muted-foreground">{metric.description}</p></Link>; })}
    </section>
    <section className="rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-6"><div><h2 className="text-base font-semibold">Exit cases needing HR attention</h2><p className="mt-1 text-sm text-muted-foreground">Review staff departures, confirm next steps, and complete HR exit cases.</p></div><Link href="/dashboard/exit-requests" className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline">View all <ArrowRight className="size-4" /></Link></div>
      {departures.length ? <div className="divide-y divide-border/60">{departures.map((departure) => <Link key={departure.id} href={`/dashboard/exit-requests/${departure.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-muted/40 sm:px-6"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{departure.employeeName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold group-hover:text-primary">{departure.employeeName}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{departure.employeeNumber} · Last day {formatDate(departure.lastDay)}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium capitalize text-amber-700">{departure.status.replaceAll("_", " ")}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>)}</div> : <div className="px-6 py-12 text-center text-sm text-muted-foreground">There are no open exit cases.</div>}
    </section>
    <section className="grid gap-4 md:grid-cols-3"><QuickAction href="/dashboard/employees" icon={Users} title="Employee register" description="Maintain staff records, appointments, and employment status." /><QuickAction href="/dashboard/leave" icon={CalendarClock} title="Leave requests" description="Review leave applications and balances." /><QuickAction href="/dashboard/exit-requests" icon={ClipboardCheck} title="Exit cases" description="Start, review, and complete HR employee exits." /></section>
  </div>;
}

function QuickAction({ href, icon: Icon, title, description }: { href: string; icon: typeof Users; title: string; description: string }) {
  return <Link href={href} className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition hover:border-primary/25 hover:shadow-md"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-primary"><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></Link>;
}
