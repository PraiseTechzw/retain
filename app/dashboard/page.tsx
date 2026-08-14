import { BookOpen, Clock3, ShieldCheck, Users } from 'lucide-react'
import { DashboardShell, PageFrame } from '@/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ count: employeeCount }, { count: exitCount }, { count: clearanceCount }, { count: documentCount }] = await Promise.all([
    supabase.from('employees').select('*', { count: 'exact', head: true }).eq('employment_status', 'active'),
    supabase.from('exit_requests').select('*', { count: 'exact', head: true }).neq('status', 'completed'),
    supabase.from('clearance_steps').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('knowledge_documents').select('*', { count: 'exact', head: true }),
  ])

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split('@')[0] ||
    'User'
  const userRole = (user?.user_metadata?.role as string | undefined) || 'Administrator'

  const metrics = [
    ['Active employees', employeeCount ?? 0, 'Live Supabase count', Users],
    ['Pending exits', exitCount ?? 0, 'Open requests', Clock3],
    ['Pending clearances', clearanceCount ?? 0, 'Awaiting approval', ShieldCheck],
    ['Knowledge captured', documentCount ?? 0, 'Stored documents', BookOpen],
  ] as const

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title={`Good morning, ${userName}`}
        description="Here is what is happening across your institutional continuity workspace."
        action={
          <button className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Export activity
          </button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value, helper, Icon]) => (
            <div key={label} className="rounded-2xl border border-border/70 bg-card p-5">
              <Icon className="size-5 text-primary" />
              <p className="mt-4 text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value}</p>
              <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_.6fr]">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <h2 className="font-semibold">Exit pipeline</h2>
            <p className="mt-1 text-sm text-muted-foreground">Live operational view from active requests</p>
            <div className="mt-8 flex h-52 items-end gap-4">
              {[42, 58, 49, 72, 62, 86].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-3">
                  <div className="w-full rounded-t-lg bg-primary" style={{ height: `${height}%` }} />
                  <span className="text-xs text-muted-foreground">{['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'][index]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Action center</h2>
              <span className="rounded-full bg-rose-50 px-2 py-1 text-xs text-rose-600">{clearanceCount ?? 0}</span>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium">Clearance approvals</p>
                <p className="mt-1 text-xs text-muted-foreground">{clearanceCount ?? 0} pending review</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-sm font-medium">Knowledge coverage</p>
                <p className="mt-1 text-xs text-muted-foreground">{documentCount ?? 0} documents stored across institutional records</p>
              </div>
            </div>
          </div>
        </div>
      </PageFrame>
    </DashboardShell>
  )
}
