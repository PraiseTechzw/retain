import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { DashboardShell, DataTable, EmptyState, PageFrame, Status } from '@/components/dashboard-shell'
import { getExitRequests } from '@/lib/supabase/data'

export default async function Page() {
  const requests = await getExitRequests()
  const rows = requests.map((request) => {
    const employee = Array.isArray(request.employees) ? request.employees[0] : request.employees
    return [<Link key={request.id} href={`/dashboard/exit-requests/${request.id}`} className="font-semibold text-foreground hover:text-primary">{employee?.employee_number ?? '—'} · {employee?.full_name ?? 'Unknown employee'}</Link>, request.reason ?? 'Voluntary separation', <Status key="status" tone={request.status === 'completed' ? 'green' : 'amber'}>{request.status}</Status>, request.last_day ?? '—']
  })
  return <DashboardShell><PageFrame title="Exit Requests" description="Review employee transitions, deadlines, and approval status." action={<button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><ClipboardCheck className="size-4"/>New request</button>}>{requests.length ? <DataTable columns={['Employee','Reason','Status','Last day']} rows={rows} /> : <EmptyState label="exit requests" />}</PageFrame></DashboardShell>
}
