import Link from 'next/link'
import { DashboardShell, DataTable, EmptyState, PageFrame, Status } from '@/components/dashboard-shell'
import { getClearanceSteps } from '@/lib/supabase/data'

export default async function Page() {
  const steps = await getClearanceSteps()
  const rows = steps.map((step) => {
    const request = Array.isArray(step.exit_requests) ? step.exit_requests[0] : step.exit_requests
    const employee = request && (Array.isArray(request.employees) ? request.employees[0] : request.employees)
    return [<Link key={step.id} href={`/dashboard/clearances/${step.id}`} className="font-semibold text-foreground hover:text-primary">{employee?.employee_number ?? '—'} · {employee?.full_name ?? 'Unknown employee'}</Link>, step.department, <Status key="status" tone={step.status === 'approved' ? 'green' : 'amber'}>{step.status}</Status>, step.comments ?? 'Awaiting review']
  })
  return <DashboardShell><PageFrame title="Digital Clearances" description="Coordinate department approvals across every exit request.">{steps.length ? <DataTable columns={['Employee','Department','Status','Notes']} rows={rows} /> : <EmptyState label="clearance steps" />}</PageFrame></DashboardShell>
}
