import Link from "next/link";
import Image from "next/image";
import { signUp } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";
import RegisterForm from "@/components/auth/register-form";

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
        <div className="mx-auto mb-5 w-full max-w-[296px] rounded-md bg-white p-2">
          <Image
            src="/cut-logo.png"
            alt="Chinhoyi University of Technology"
            width={450}
            height={67}
            priority
            className="h-auto w-full"
          />
        </div>
        <RegisterForm
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
