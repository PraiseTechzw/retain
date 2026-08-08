import Link from 'next/link'
import { DashboardShell, PageFrame } from '@/components/dashboard-shell'
import { ProfileEditor } from '@/components/profile-editor'
import { getCurrentUser } from '@/lib/supabase/actions'

export default async function Page() {
  const user = await getCurrentUser()
  return <DashboardShell><PageFrame title="My Profile" description="Manage your CUT-Retain account and notification preferences."><div className="max-w-2xl rounded-2xl border border-border/70 bg-card p-6 shadow-sm"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">AN</div><div><h2 className="text-xl font-semibold">Alex Ncube</h2><p className="text-sm text-muted-foreground">Administrator · Human Resources</p></div></div><ProfileEditor name="Alex Ncube" email={user.email} /><Link href="/dashboard/settings" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Open system settings</Link></div></PageFrame></DashboardShell>
}
