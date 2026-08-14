import { LockKeyhole } from "lucide-react";
import { signIn } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";
import LoginMascotForm from "@/components/auth/login-mascot-form";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ message?: string }> | { message?: string };
}) {
  const params = await Promise.resolve(searchParams);
  const message = params?.message ? decodeURIComponent(params.message) : "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-center gap-2 text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">{appConfig.appName}</span>
        </div>
        <LoginMascotForm
          signIn={signIn}
          appName={appConfig.appName}
          workspaceLabel={appConfig.workspaceLabel}
          message={message}
        />
      </div>
    </main>
  );
}
