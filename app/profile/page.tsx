import Link from "next/link";
import { DashboardShell, PageFrame } from "@/components/dashboard-shell";
import { createClient } from "@/lib/supabase/server";
import { appConfig, getInitials } from "@/lib/system";

export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userName =
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    appConfig.defaultUserName;
  const userRole =
    (user?.user_metadata?.role as string | undefined) || appConfig.defaultRole;

  return (
    <DashboardShell userName={userName} userRole={userRole}>
      <PageFrame
        title="My Profile"
        description={`Manage your ${appConfig.appName} account and notification preferences.`}
      >
        <div className="max-w-2xl rounded-2xl border border-border/70 bg-card p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {getInitials(userName)}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{userName}</h2>
              <p className="text-sm text-muted-foreground">
                {userRole} · {appConfig.organization}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Full name
              <input
                value={userName}
                readOnly
                className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3"
              />
            </label>
            <label className="text-sm font-medium">
              Role
              <input
                value={userRole}
                readOnly
                className="mt-2 h-10 w-full rounded-xl border border-input bg-background px-3"
              />
            </label>
          </div>
          <Link
            href="/dashboard/settings"
            className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
          >
            Open system settings
          </Link>
        </div>
      </PageFrame>
    </DashboardShell>
  );
}
