import Link from "next/link";
import { UserRoundPlus } from "lucide-react";
import { signUp } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";
import RegisterMascotForm from "@/components/auth/register-mscot-form";

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
            <UserRoundPlus className="h-5 w-5" />
          </div>
          <span className="text-sm font-semibold">{appConfig.appName}</span>
        </div>
        <RegisterMascotForm
          signUp={signUp}
          appName={appConfig.appName}
          message={message}
        />
        <Link href="/auth/login" className="mt-5 block text-sm text-primary">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
