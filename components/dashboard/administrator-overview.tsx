import Link from "next/link";
import {
  DashboardShell,
  DataTable,
  PageFrame,
} from "@/components/dashboard-shell";
import { UserInvitationForm } from "@/components/user-invitation-form";
import {
  getAdminOverviewSnapshot,
  getAuditEvents,
  getSystemUsers,
} from "@/lib/supabase/data";

export async function AdministratorOverview({
  userName,
  userRole,
}: {
  userName: string;
  userRole: string;
}) {
  const [snapshot, systemUsers, auditEvents] = await Promise.all([
    getAdminOverviewSnapshot(),
    getSystemUsers(),
    getAuditEvents(6),
  ]);
  const activeUsers = systemUsers.users.filter((user) => user.active).length;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="Administrator control centre"
        description="Manage access, system configuration, and technical oversight without entering confidential HR workflows."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/user-management" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
              Manage accounts
            </Link>
            <Link href="/dashboard/settings" className="rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold">
              Configure system
            </Link>
          </div>
        }
      >
        <div className="space-y-6">
          <section className="rounded-3xl border border-primary/15 bg-primary/[0.06] p-6 md:p-8">
            <p className="text-sm font-medium text-primary">System administration</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
              Keep the workforce system secure and ready.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review account access, monitor operational readiness, and keep system rules aligned with institutional policy.
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdminMetric label="Active accounts" value={`${activeUsers}/${systemUsers.users.length}`} href="/dashboard/user-management" />
            <AdminMetric label="Unread notifications" value={snapshot.unreadNotifications} href="/dashboard" />
            <AdminMetric label="Open exit cases" value={snapshot.openExitRequests} href="/dashboard/exit-requests" />
            <AdminMetric label="Pending clearance" value={snapshot.pendingClearanceSteps} href="/dashboard/exit-requests" />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">System readiness</h2>
              <p className="mt-1 text-sm text-muted-foreground">Operational signals available to administrators.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ReadinessItem label="Employee records" value={snapshot.totalEmployees} href="/dashboard/employees" />
                <ReadinessItem label="Active employees" value={snapshot.activeEmployees} href="/dashboard/employees" />
                <ReadinessItem label="Assigned assets" value={snapshot.assignedAssets} href="/dashboard/employees" />
                <ReadinessItem label="Asset recovery rate" value={`${snapshot.assetRecoveryRate}%`} href="/dashboard/exit-requests" />
              </div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <h2 className="font-semibold">Account administration</h2>
              <p className="mt-1 text-sm text-muted-foreground">The administrator’s primary control surface.</p>
              <div className="mt-5 space-y-3">
                <AdminAction href="/dashboard/user-management" title="Invite or deactivate accounts" description="Control who can access the system." />
                <AdminAction href="/dashboard/settings" title="Update system rules" description="Manage workflow defaults and notifications." />
                <AdminAction href="/dashboard/audit" title="Inspect technical activity" description="Trace configuration and account changes." />
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
            <UserInvitationForm />
            <div className="rounded-2xl border border-border/70 bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">Recent technical activity</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Latest account and configuration events.</p>
                </div>
                <Link href="/dashboard/audit" className="text-sm font-semibold text-primary hover:underline">View all</Link>
              </div>
              {auditEvents.length ? (
                <div className="mt-4">
                  <DataTable
                    columns={["Action", "Area", "When"]}
                    rows={auditEvents.map((event) => [
                      event.action.replaceAll("_", " "),
                      event.entity_type.replaceAll("_", " "),
                      event.created_at ? new Date(event.created_at).toLocaleString() : "—",
                    ])}
                  />
                </div>
              ) : (
                <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">No technical activity has been recorded yet.</p>
              )}
            </div>
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}

function AdminMetric({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-border/70 bg-card p-5 transition hover:border-primary/30">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </Link>
  );
}

function ReadinessItem({ label, value, href }: { label: string; value: number | string; href: string }) {
  return (
    <Link href={href} className="rounded-xl bg-muted/60 p-4 transition hover:bg-muted">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </Link>
  );
}

function AdminAction({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block rounded-xl border border-border/70 p-3 transition hover:border-primary/30 hover:bg-muted/30">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </Link>
  );
}
