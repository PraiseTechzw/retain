import Link from "next/link";
import { KeyRound } from "lucide-react";
import { resetPassword } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex items-center justify-center gap-2 text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <KeyRound className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">{appConfig.appName}</p>
        </div>
        <h1 className="mt-3 text-center text-3xl font-semibold">
          Reset password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We will send a secure reset link to your work email.
        </p>

        <form action={resetPassword} className="mt-8 flex flex-col gap-4">
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Work email"
            className="h-11 rounded-xl border border-input bg-background px-3"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Send reset link
          </button>
        </form>

        <Link href="/auth/login" className="mt-5 block text-sm text-primary">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
