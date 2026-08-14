import Link from "next/link";
import { signUp } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";
import RegisterMascotForm from "@/components/auth/register-mscot-form";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <RegisterMascotForm signUp={signUp} appName={appConfig.appName} />
        <Link href="/auth/login" className="mt-5 block text-sm text-primary">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
