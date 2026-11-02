import { DashboardShell, DataTable, PageFrame } from "@/components/dashboard-shell";
import { requireDashboardCapability } from "@/lib/auth-role";
import { getAuditEvents } from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } = await requireDashboardCapability("viewUserManagement");
  const events = await getAuditEvents(100);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame title="Audit log" description="Technical activity for account, configuration, and system administration changes.">
        {events.length ? (
          <DataTable
            columns={["Action", "Entity", "Entity ID", "When"]}
            rows={events.map((event) => [
              event.action.replaceAll("_", " "),
              event.entity_type.replaceAll("_", " "),
              event.entity_id ?? "—",
              event.created_at ? new Date(event.created_at).toLocaleString() : "—",
            ])}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">No audit activity has been recorded yet.</div>
        )}
      </PageFrame>
    </DashboardShell>
  );
}
