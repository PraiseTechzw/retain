import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { getSystemUsers } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";

export default async function Page() {
  const { userName, userRole } = await resolveDashboardUserContext();
  const users = await getSystemUsers();

  // Check if user is admin
  const isAdminRole =
    userRole.toLowerCase().includes("administrator") ||
    userRole.toLowerCase().includes("hr");

  if (!isAdminRole) {
    return (
      <DashboardShell userName={userName} userRole={userRole}>
        <PageFrame
          title="User Management"
          description="Manage system users, roles, and access permissions."
        >
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950/30">
            <div className="flex items-start gap-4">
              <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                ⚠
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Access denied
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                  User management is restricted to administrators and HR
                  managers. Your current role is <strong>{userRole}</strong>.
                </p>
              </div>
            </div>
          </div>
        </PageFrame>
      </DashboardShell>
    );
  }

  const rows = users.map((user) => {
    const roleDisplay = String(user.role ?? "Employee").trim();
    const createdAt = user.created_at
      ? new Date(user.created_at).toLocaleDateString()
      : "—";

    return [
      <div key={user.id} className="flex flex-col">
        <span className="font-semibold text-foreground">{user.full_name}</span>
        <span className="text-xs text-muted-foreground">{user.email}</span>
      </div>,
      roleDisplay,
      <Status
        key="status"
        tone={roleDisplay.toLowerCase().includes("admin") ? "blue" : "gray"}
      >
        {roleDisplay}
      </Status>,
      createdAt,
    ];
  });

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="User Management"
        description="Manage system users, roles, and access permissions."
      >
        {users.length === 0 ? (
          <EmptyState label="users" />
        ) : (
          <DataTable
            columns={["User", "Role", "Status", "Created"]}
            rows={rows}
          />
        )}
      </PageFrame>
    </DashboardShell>
  );
}
