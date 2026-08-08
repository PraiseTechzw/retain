import Link from 'next/link'
import { Upload } from 'lucide-react'
import { DashboardShell, DataTable, EmptyState, PageFrame, Status } from '@/components/dashboard-shell'
import { getKnowledgeDocuments } from '@/lib/supabase/data'

export default async function Page() {
  const documents = await getKnowledgeDocuments()
  const rows = documents.map((document) => {
    const employee = Array.isArray(document.employees) ? document.employees[0] : document.employees
    return [<Link key={document.id} href={`/dashboard/knowledge-hub/${document.id}`} className="font-semibold text-foreground hover:text-primary">{document.title}</Link>, employee?.full_name ?? 'Institutional', document.category ?? 'General', <Status key="status" tone="green">Stored</Status>]
  })
  return <DashboardShell><PageFrame title="Knowledge Hub" description="Preserve handover notes, procedures, and institutional memory." action={<button className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"><Upload className="size-4"/>Upload document</button>}>{documents.length ? <DataTable columns={['Document','Owner','Category','Review']} rows={rows} /> : <EmptyState label="knowledge documents" />}</PageFrame></DashboardShell>
}
