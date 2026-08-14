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
