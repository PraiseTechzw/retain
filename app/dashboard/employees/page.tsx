import Link from 'next/link'
import { DashboardShell, DataTable, EmptyState, PageFrame, Status } from '@/components/dashboard-shell'
import { OperationsPanel } from '@/components/operations-panel'
import { getEmployees } from '@/lib/supabase/data'

export default async function Page() {
  const employees = await getEmployees()
  const rows = employees.map((employee) => {
    const department = Array.isArray(employee.departments) ? employee.departments[0] : employee.departments
    return [
      <Link key={employee.id} href={`/dashboard/employees/${employee.id}`} className="font-semibold text-foreground hover:text-primary">{employee.employee_number} · {employee.full_name}</Link>,
      `${employee.job_title ?? 'Unassigned'} · ${department?.name ?? 'No department'}`,
      <Status key="status" tone={employee.employment_status === 'active' ? 'green' : 'blue'}>{employee.employment_status}</Status>,
      employee.joined_on ?? '—',
    ]
  })
  return <DashboardShell><PageFrame title="Employee Management" description="Maintain employee records and monitor institutional transitions." action={<OperationsPanel mode="employee" />}>
    {employees.length === 0 ? <EmptyState label="employees" /> : <DataTable columns={['Employee','Role & department','Status','Joined']} rows={rows} />}
  </PageFrame></DashboardShell>
}
