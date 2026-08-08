'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Archive,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  PackageCheck,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Employees', icon: Users },
  { label: 'Exit management', icon: ClipboardCheck, count: 12 },
  { label: 'Clearance', icon: ShieldCheck, count: 8 },
  { label: 'Assets', icon: PackageCheck },
  { label: 'Knowledge base', icon: BookOpen },
  { label: 'Analytics', icon: BarChart3 },
  { label: 'Reports', icon: FileText },
]

const activities = [
  { title: 'Clearance approved', detail: 'Sarah Ndlovu · ICT Department', time: '12 min ago', tone: 'green' },
  { title: 'Exit request submitted', detail: 'Dr. Michael Banda · Engineering', time: '34 min ago', tone: 'blue' },
  { title: 'Knowledge transfer uploaded', detail: 'Thabo Molefe · Computer Science', time: '1 hr ago', tone: 'purple' },
  { title: 'Asset return pending', detail: 'Lerato Mokoena · HR Department', time: '2 hrs ago', tone: 'orange' },
]

const employees = [
  { name: 'Sarah Ndlovu', role: 'Senior Lecturer', department: 'Computer Science', status: 'In clearance', date: '28 Sep 2024', initials: 'SN', color: 'lavender' },
  { name: 'Michael Banda', role: 'Professor', department: 'Engineering', status: 'Exit requested', date: '04 Oct 2024', initials: 'MB', color: 'blue' },
  { name: 'Lerato Mokoena', role: 'Administrator', department: 'Human Resources', status: 'Assets pending', date: '11 Oct 2024', initials: 'LM', color: 'peach' },
  { name: 'Thabo Molefe', role: 'Lecturer', department: 'Business Administration', status: 'Knowledge review', date: '18 Oct 2024', initials: 'TM', color: 'mint' },
]

function StatCard({ label, value, helper, icon: Icon, accent }: { label: string; value: string; helper: string; icon: typeof Users; accent: string }) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.35)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
        </div>
        <div className={`rounded-xl p-3 ${accent}`}><Icon className="size-5" /></div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles = status === 'In clearance' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : status === 'Exit requested' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' : status === 'Assets pending' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

export default function Page() {
  const [active, setActive] = useState('Overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filteredEmployees = useMemo(() => employees.filter((employee) => `${employee.name} ${employee.department} ${employee.role}`.toLowerCase().includes(query.toLowerCase())), [query])
  const sectionLabel = active === 'Overview' ? 'Overview' : active

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {sidebarOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setSidebarOpen(false)} />}
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 -translate-x-full flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : ''}`}>
          <div className="flex items-center gap-3 px-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Archive className="size-5" /></div>
            <div><p className="text-lg font-semibold tracking-tight">CUT-Retain</p><p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Institutional continuity</p></div>
            <button aria-label="Close navigation" className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-sidebar-accent lg:hidden" onClick={() => setSidebarOpen(false)}><X className="size-4" /></button>
          </div>
          <div className="mt-9 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
          <nav className="mt-3 flex flex-1 flex-col gap-1">
            {navItems.map(({ label, icon: Icon, count }) => <button key={label} onClick={() => { setActive(label); setSidebarOpen(false) }} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active === label ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'}`}><Icon className="size-[18px]" /><span className="flex-1">{label}</span>{count && <span className={`rounded-full px-2 py-0.5 text-[11px] ${active === label ? 'bg-white/15' : 'bg-sidebar-accent'}`}>{count}</span>}</button>)}
          </nav>
          <div className="border-t border-sidebar-border pt-4"><button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"><Settings2 className="size-[18px]" />Settings</button><div className="mt-4 flex items-center gap-3 rounded-xl bg-sidebar-accent/70 p-3"><div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">AN</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">Alex Ncube</p><p className="truncate text-xs text-muted-foreground">Administrator</p></div><MoreHorizontal className="size-4 text-muted-foreground" /></div></div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 items-center gap-4 border-b border-border/70 bg-background/80 px-5 backdrop-blur md:px-8"><button aria-label="Open navigation" className="rounded-lg p-2 hover:bg-muted lg:hidden" onClick={() => setSidebarOpen(true)}><Menu className="size-5" /></button><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search employees, requests, assets..." className="h-10 w-full rounded-xl border border-input bg-card pl-10 pr-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15" /></div><div className="ml-auto flex items-center gap-2"><button aria-label="Notifications" onClick={() => setNoticeOpen((value) => !value)} className="relative rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Bell className="size-5" /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" /></button><div className="hidden h-7 w-px bg-border sm:block" /><button className="hidden items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted sm:flex"><div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">AN</div><div className="pr-1"><p className="text-xs font-semibold">Alex Ncube</p><p className="text-[11px] text-muted-foreground">Administrator</p></div><ChevronDown className="size-4 text-muted-foreground" /></button></div>{noticeOpen && <div className="absolute right-5 top-16 z-20 w-72 rounded-2xl border border-border bg-card p-4 shadow-xl md:right-8"><div className="flex items-center justify-between"><p className="font-semibold">Notifications</p><span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">3 new</span></div><p className="mt-3 text-sm text-muted-foreground">You have clearance reviews and an asset return awaiting attention.</p></div>}</header>
          <div className="flex-1 overflow-auto"><div className="mx-auto max-w-[1500px] p-5 md:p-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-medium text-primary">Tuesday, 24 September 2024 · {sectionLabel}</p><h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Good morning, Alex</h1><p className="mt-2 text-sm text-muted-foreground">Here is what is happening across your institutional continuity workspace.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"><Activity className="size-4" />Export activity</button></div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Active employees" value="1,284" helper="+4.8% from last month" icon={Users} accent="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" /><StatCard label="Pending exits" value="24" helper="12 need your attention" icon={Clock3} accent="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300" /><StatCard label="Clearance progress" value="78%" helper="Across all active requests" icon={ShieldCheck} accent="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" /><StatCard label="Knowledge captured" value="92%" helper="This quarter" icon={BookOpen} accent="bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300" /></div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><div className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">Exit pipeline</h2><p className="mt-1 text-sm text-muted-foreground">Requests and clearance progress over the last 6 months</p></div><button className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-5" /></button></div><div className="mt-7 flex h-56 items-end gap-3 sm:gap-6">{[38, 52, 44, 67, 56, 82].map((height, index) => <div key={index} className="flex flex-1 flex-col items-center gap-3"><div className="flex h-full w-full items-end justify-center gap-1.5"><div className="w-1/2 rounded-t-md bg-primary/20" style={{ height: `${height * 0.68}%` }} /><div className="w-1/2 rounded-t-md bg-primary" style={{ height: `${height}%` }} /></div><span className="text-xs text-muted-foreground">{['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][index]}</span></div>)}</div><div className="mt-5 flex flex-wrap items-center gap-5 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary" />Exit requests</span><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-primary/20" />Completed clearances</span><span className="ml-auto font-medium text-emerald-600">+12.6% <span className="font-normal text-muted-foreground">vs last period</span></span></div></div>
              <div className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Action center</h2><p className="mt-1 text-sm text-muted-foreground">Items requiring attention</p></div><span className="flex size-8 items-center justify-center rounded-full bg-rose-50 text-xs font-semibold text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">8</span></div><div className="mt-5 flex flex-col gap-3">{[{ label: 'Clearance approvals', count: '5', icon: ClipboardCheck, tone: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' }, { label: 'Asset returns', count: '2', icon: BriefcaseBusiness, tone: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' }, { label: 'Knowledge reviews', count: '1', icon: BookOpen, tone: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' }].map(({ label, count, icon: Icon, tone }) => <button key={label} className="flex items-center gap-3 rounded-xl border border-border/70 p-3 text-left transition hover:border-primary/30 hover:bg-muted/50"><div className={`rounded-lg p-2 ${tone}`}><Icon className="size-4" /></div><span className="flex-1 text-sm font-medium">{label}</span><span className="mr-1 text-sm font-semibold">{count}</span><ArrowUpRight className="size-4 text-muted-foreground" /></button>)}</div><button className="mt-5 w-full rounded-xl border border-border px-3 py-2.5 text-sm font-semibold transition hover:bg-muted">View all actions</button></div></div>
            <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"><div className="rounded-2xl border border-border/70 bg-card"><div className="flex items-center justify-between border-b border-border/70 p-5 md:p-6"><div><h2 className="font-semibold">Recent exit requests</h2><p className="mt-1 text-sm text-muted-foreground">Latest employee transitions in progress</p></div><button className="text-sm font-semibold text-primary hover:underline">View all</button></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead><tr className="border-b border-border/70 text-xs uppercase tracking-wide text-muted-foreground"><th className="px-5 py-3 font-medium md:px-6">Employee</th><th className="px-5 py-3 font-medium">Department</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 font-medium">Last day</th><th className="px-5 py-3" /></tr></thead><tbody>{filteredEmployees.map((employee) => <tr key={employee.name} className="border-b border-border/50 last:border-0 hover:bg-muted/30"><td className="px-5 py-4 md:px-6"><div className="flex items-center gap-3"><div className={`flex size-9 items-center justify-center rounded-full text-xs font-semibold ${employee.color === 'lavender' ? 'bg-violet-100 text-violet-700' : employee.color === 'blue' ? 'bg-blue-100 text-blue-700' : employee.color === 'peach' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{employee.initials}</div><div><p className="text-sm font-semibold">{employee.name}</p><p className="text-xs text-muted-foreground">{employee.role}</p></div></div></td><td className="px-5 py-4 text-sm text-muted-foreground">{employee.department}</td><td className="px-5 py-4"><StatusPill status={employee.status} /></td><td className="px-5 py-4 text-sm text-muted-foreground">{employee.date}</td><td className="px-5 py-4"><button aria-label={`Open ${employee.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><MoreHorizontal className="size-4" /></button></td></tr>)}</tbody></table></div></div><div className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold">Recent activity</h2><p className="mt-1 text-sm text-muted-foreground">Across your workspace</p></div><button className="text-sm font-semibold text-primary hover:underline">View log</button></div><div className="mt-6 flex flex-col gap-5">{activities.map((activity) => <div key={activity.title} className="flex gap-3"><div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${activity.tone === 'green' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : activity.tone === 'blue' ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/30' : activity.tone === 'purple' ? 'bg-violet-50 text-violet-600 dark:bg-violet-950/30' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30'}`}><Check className="size-4" /></div><div className="min-w-0"><p className="text-sm font-medium">{activity.title}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{activity.detail}</p><p className="mt-1 text-[11px] text-muted-foreground/70">{activity.time}</p></div></div>)}</div></div></div>
          </div></div>
        </section>
      </div>
    </main>
  )
}
