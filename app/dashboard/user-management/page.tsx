import {
  DashboardShell,
  DataTable,
  EmptyState,
  PageFrame,
  Status,
} from "@/components/dashboard-shell";
import { getSystemUsers } from "@/lib/supabase/data";
import {
  normalizeUserRole,
  resolveDashboardUserContext,
  roleHasCapability,
} from "@/lib/auth-role";
import { UserManagementActionForm } from "@/components/user-management-action-form";
import { UserInvitationForm } from "@/components/user-invitation-form";

export default async function Page() {
  const { user, userName, userRole, rawUserRole } =
    await resolveDashboardUserContext();

  const canViewUsers = roleHasCapability(rawUserRole, "viewUserManagement");
  const canManageAccounts = roleHasCapability(
    rawUserRole,
    "manageUserAccounts",
  );
  const canChangeRoles = rawUserRole.toLowerCase() === "administrator";

  if (!canViewUsers) {
    return (
      <DashboardShell userName={userName} userRole={userRole}>
        <PageFrame
          title="User Management"
          description="Manage invited accounts, roles, and access permissions."
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
                  User management is restricted to administrators. Your
                  current role is <strong>{userRole}</strong>.
                </p>
              </div>
            </div>
          </div>
        </PageFrame>
      </DashboardShell>
    );
  }

  const { users, confidentialCaseAccessAvailable } = await getSystemUsers();
  const currentUserId = user?.id;
  const rows = users.map((systemUser) => {
    const roleDisplay = normalizeUserRole(systemUser.role);
    const createdAt = systemUser.created_at
      ? new Date(systemUser.created_at).toLocaleDateString()
      : "—";

    const roleAction = (
      <UserManagementActionForm
        key={`role-${systemUser.id}`}
        kind="role"
        successMessage="User role updated."
      >
        <input type="hidden" name="user_id" value={systemUser.id ?? ""} />
        <select
          name="role"
          defaultValue={systemUser.role ?? "employee"}
          className="h-8 rounded border border-input bg-background px-2 text-xs"
        >
          <option value="employee">Employee</option>
          <option value="hr">HR</option>
          <option value="hr_manager">HR Manager</option>
          <option value="administrator">Administrator</option>
        </select>
        <button
          type="submit"
          className="ml-2 rounded border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          Update
        </button>
      </UserManagementActionForm>
    );
    const accountAction = (
      <UserManagementActionForm
        key={`account-${systemUser.id}`}
        kind={systemUser.active === false ? "activate" : "disable"}
        successMessage={
          systemUser.active === false
            ? "Account activated."
            : "Account deactivated."
        }
      >
        <input type="hidden" name="user_id" value={systemUser.id ?? ""} />
        <button
          type="submit"
          disabled={!systemUser.id || systemUser.id === currentUserId}
          className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {systemUser.active === false ? "Reactivate" : "Deactivate"}
        </button>
      </UserManagementActionForm>
    );
    const isHrStaff = ["hr", "hr_manager"].includes(
      systemUser.role?.toLowerCase() ?? "",
    );
    const confidentialAccessAction =
      isHrStaff && confidentialCaseAccessAvailable ? (
        <UserManagementActionForm
          key={`confidential-${systemUser.id}`}
          kind="confidential"
          successMessage="Confidential case access updated."
          className="flex items-center gap-2"
        >
          <input type="hidden" name="user_id" value={systemUser.id ?? ""} />
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={systemUser.confidential_case_officer === true}
            />
            Case officer
          </label>
          <button
            type="submit"
            className="rounded border border-input px-2 py-1 text-xs font-medium hover:bg-muted"
          >
            Save
          </button>
        </UserManagementActionForm>
      ) : (
        "—"
      );

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
      ...(canManageAccounts
        ? [confidentialAccessAction, roleAction, accountAction]
        : []),
    ];
  });

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="User Management"
        description={
          canManageAccounts
            ? "Review user access and manage role assignments."
            : "Review system accounts. Role and account changes are restricted to administrators."
        }
      >
        <div className="space-y-6">
          {canManageAccounts && !confidentialCaseAccessAvailable && (
            <section
              role="status"
              className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              User and role management is available, but confidential case
              officer access is not enabled yet. Apply{" "}
              <code>20261029000600_restrict_confidential_hr_access.sql</code>{" "}
              to the Supabase database to enable it.
            </section>
          )}
          <div className="rounded-2xl border border-border/70 bg-card p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overview
            </p>
            <h2 className="mt-2 text-xl font-semibold">System users</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Total system users: <strong>{users.length}</strong>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {canChangeRoles
                ? "New invitations start as Employees. Only administrators can change roles and authorize confidential case officers."
                : "Role and account changes are restricted to administrators."}
            </p>
          </div>

          {canManageAccounts && <UserInvitationForm />}

          {users.length === 0 ? (
            <EmptyState label="users" />
          ) : (
            <DataTable
              columns={[
                "User",
                "Current Role",
                "Status",
                "Created",
                ...(canManageAccounts
                  ? [
                      ...(confidentialCaseAccessAvailable
                        ? ["Confidential access"]
                        : []),
                      "Change Role",
                      "Account",
                    ]
                  : []),
              ]}
              rows={rows}
            />
          )}
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
