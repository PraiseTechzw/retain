import { DashboardShell, DataTable, PageFrame, Status } from "@/components/dashboard-shell";
import { UserInvitationForm } from "@/components/user-invitation-form";
import { UserManagementActionForm } from "@/components/user-management-action-form";
import { requireDashboardCapability } from "@/lib/auth-role";
import { getSystemUsers } from "@/lib/supabase/data";

export default async function Page() {
  const { userName, userRole } = await requireDashboardCapability("viewUserManagement");
  const { users, confidentialCaseAccessAvailable } = await getSystemUsers();

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame title="User management" description="Invite, activate, deactivate, and assign roles to HR system accounts.">
        <div className="space-y-6">
          <UserInvitationForm />
          <section className="rounded-2xl border border-border/70 bg-card p-5">
            <div className="mb-4">
              <h2 className="font-semibold">System accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Employee records are separate from sign-in accounts. Changes here affect access only.
              </p>
            </div>
            <DataTable
              columns={["Account", "Role", "Status", "Access"]}
              rows={users.map((account) => [
                <span key={account.id} className="font-medium text-foreground">{account.full_name ?? "Unnamed account"}</span>,
                <UserManagementActionForm key={`${account.id}-role`} kind="role" successMessage="Role updated." className="flex items-center gap-2" >
                  <input type="hidden" name="user_id" value={account.id ?? ""} />
                  <select name="role" defaultValue={account.role ?? "hr"} className="h-9 rounded-lg border border-input bg-background px-2 text-xs">
                    <option value="hr">HR</option>
                    <option value="administrator">Administrator</option>
                  </select>
                  <button type="submit" className="text-xs font-semibold text-primary hover:underline">Save</button>
                </UserManagementActionForm>,
                <Status key={`${account.id}-status`} tone={account.active ? "green" : "amber"}>{account.active ? "Active" : "Inactive"}</Status>,
                <div key={`${account.id}-access`} className="flex flex-wrap items-center gap-2">
                  {account.active ? (
                    <UserManagementActionForm kind="disable" successMessage="Account deactivated." className="inline-flex">
                      <input type="hidden" name="user_id" value={account.id ?? ""} />
                      <button type="submit" className="text-xs font-semibold text-rose-700 hover:underline">Deactivate</button>
                    </UserManagementActionForm>
                  ) : (
                    <UserManagementActionForm kind="activate" successMessage="Account activated." className="inline-flex">
                      <input type="hidden" name="user_id" value={account.id ?? ""} />
                      <button type="submit" className="text-xs font-semibold text-primary hover:underline">Activate</button>
                    </UserManagementActionForm>
                  )}
                  {confidentialCaseAccessAvailable && account.role === "hr" && (
                    <UserManagementActionForm kind="confidential" successMessage="Confidential access updated." className="inline-flex items-center gap-1">
                      <input type="hidden" name="user_id" value={account.id ?? ""} />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="checkbox" name="enabled" defaultChecked={account.confidential_case_officer === true} />
                        Case access
                      </label>
                      <button type="submit" className="text-xs font-semibold text-primary hover:underline">Save</button>
                    </UserManagementActionForm>
                  )}
                </div>,
              ])}
            />
          </section>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
