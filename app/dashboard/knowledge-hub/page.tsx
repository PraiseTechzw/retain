import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { OperationsPanel } from "@/components/operations-panel";
import { getEmployees, getKnowledgeDocuments } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  const [documents, employeeRows] = await Promise.all([
    getKnowledgeDocuments(),
    getEmployees(),
  ]);
  const employeeOptions = employeeRows.map((employee) => ({
    id: employee.id,
    employee_number: employee.employee_number,
    full_name: employee.full_name,
  }));
  const rows = documents.map((document) => {
    const employee = Array.isArray(document.employees)
      ? document.employees[0]
      : document.employees;
    return [
      <Link
        key={document.id}
        href={`/dashboard/knowledge-hub/${document.id}`}
        className="font-semibold text-foreground hover:text-primary"
      >
        {document.title}
      </Link>,
      employee?.full_name ?? "Institutional",
      document.category ?? "General",
      <Status key="status" tone="green">
        Stored
      </Status>,
    ];
  });
  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Knowledge Hub"
        description="Preserve handover notes, procedures, and institutional memory."
        action={
          <OperationsPanel mode="knowledge" employees={employeeOptions} />
        }
      >
        {documents.length ? (
          <DataTable
            columns={["Document", "Owner", "Category", "Review"]}
            rows={rows}
          />
        ) : (
          <EmptyState label="knowledge documents" />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
