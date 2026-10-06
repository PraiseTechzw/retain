import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { getSystemUsers } from "@/lib/supabase/data";
import { resolveDashboardUserContext } from "@/lib/auth-role";
import {
  activateUserAccount,
  disableUserAccount,
  updateUserRole,
} from "@/lib/supabase/actions";

export default async function Page() {
  const { user, userName, userRole } = await resolveDashboardUserContext();

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

  const users = await getSystemUsers();
  const currentUserId = user?.id;
  const rows = users.map((systemUser) => {
    const roleDisplay = String(systemUser.role ?? "Employee").trim();
    const createdAt = systemUser.created_at
      ? new Date(systemUser.created_at).toLocaleDateString()
      : "—";

    return [
      <div key={systemUser.id} className="flex flex-col">
        <span className="font-semibold text-foreground">
          {systemUser.full_name || "(No name)"}
        </span>
        <span className="text-xs text-muted-foreground">{systemUser.id}</span>
      </div>,
      roleDisplay,
      <Status key="status" tone={systemUser.active === false ? "amber" : "green"}>
        {systemUser.active === false ? "Deactivated" : "Active"}
      </Status>,
      createdAt,
      <form key={`role-${systemUser.id}`} action={updateUserRole}>
        <input type="hidden" name="user_id" value={systemUser.id ?? ""} />
        <select
          name="role"
          defaultValue={systemUser.role ?? "Employee"}
          className="h-8 rounded border border-input bg-background px-2 text-xs"
        >
          <option value="Employee">Employee</option>
          <option value="HR">HR</option>
          <option value="Administrator">Administrator</option>
          <option value="ICT">ICT</option>
          <option value="Library">Library</option>
          <option value="Management">Management</option>
          <option value="Academic Attaché">Academic Attaché</option>
          <option value="Support Staff">Support Staff</option>
        </select>
        <button
          type="submit"
          className="ml-2 rounded border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Update
        </button>
      </form>,
      <form
        key={`account-${systemUser.id}`}
        action={systemUser.active === false ? activateUserAccount : disableUserAccount}
      >
        <input type="hidden" name="user_id" value={systemUser.id ?? ""} />
        <button
          type="submit"
          disabled={!systemUser.id || systemUser.id === currentUserId}
          className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {systemUser.active === false ? "Reactivate" : "Deactivate"}
        </button>
      </form>,
    ];
  });

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="User Management"
        description="Manage system users, roles, and access permissions."
      >
        <div className="space-y-6">
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overview
            </p>
            <h2 className="mt-2 text-xl font-semibold">System users</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Total system users: <strong>{users.length}</strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a role from the dropdown to change a user&apos;s role.
              Changes are saved immediately.
            </p>
          </div>

          {users.length === 0 ? (
            <EmptyState label="users" />
          ) : (
            <DataTable
              columns={[
                "User",
                "Current Role",
                "Status",
                "Created",
                "Change Role",
                "Account",
              ]}
              rows={rows}
            />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
