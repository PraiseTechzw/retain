import { notFound } from 'next/navigation'
import { DashboardShell, PageFrame, Status } from '@/components/dashboard-shell'
import { DocumentActions } from '@/components/document-actions'
import { getKnowledgeDocument } from '@/lib/supabase/data'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let document
  try { document = await getKnowledgeDocument(id) } catch { notFound() }
  const employee = Array.isArray(document.employees) ? document.employees[0] : document.employees
  return <DashboardShell><PageFrame title="Document details" description="Review and securely access preserved institutional knowledge.">
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Knowledge document</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">{document.title}</h2></div><Status tone="green">Stored privately</Status></div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground">This document is held in the private knowledge vault and can only be accessed by authenticated workspace members through a temporary signed URL.</p>
        <div className="mt-8"><DocumentActions id={document.id} /></div>
      </section>
      <aside className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Record details</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-muted-foreground">Owner</dt><dd className="mt-1 font-medium">{employee?.full_name ?? 'Institutional'}</dd></div><div><dt className="text-muted-foreground">Employee number</dt><dd className="mt-1 font-medium">{employee?.employee_number ?? '—'}</dd></div><div><dt className="text-muted-foreground">Category</dt><dd className="mt-1 font-medium">{document.category ?? 'General'}</dd></div><div><dt className="text-muted-foreground">Added</dt><dd className="mt-1 font-medium">{new Date(document.created_at).toLocaleDateString()}</dd></div></dl></aside>
    </div>
  </PageFrame></DashboardShell>
}
