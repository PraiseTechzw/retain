import Link from "next/link";
import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { requireDashboardCapability } from "@/lib/auth-role";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const { userName, userRole } = await requireDashboardCapability("manageEmployees");
  const supabase = await createClient();
  const [{ count: employeeCount }, { count: exitCount }] = await Promise.all([
    supabase.from("employees").select("id", { count: "exact", head: true }),
    supabase
      .from("exit_cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["completed", "finalized"]),
  ]);

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Employee records and turnover"
        description="Capture employee records, record linked exit reasons, and understand why employees leave."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Employee records" value={employeeCount ?? 0} />
          <SummaryCard label="Historical exits" value={exitCount ?? 0} />
          <Link
            href="/dashboard/reports"
            className="rounded-2xl border border-primary/20 bg-primary/5 p-5 transition hover:border-primary"
          >
            <p className="text-sm text-muted-foreground">Turnover reasons</p>
            <p className="mt-2 text-lg font-semibold text-primary">
              View live analysis
            </p>
          </Link>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}
