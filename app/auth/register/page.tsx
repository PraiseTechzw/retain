import Link from "next/link";
import { signUp } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold text-primary">
          {appConfig.appName}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Request access to {appConfig.appName}.
        </p>

        <form action={signUp} className="mt-8 flex flex-col gap-4">
          <input
            name="full_name"
            autoComplete="name"
            required
            placeholder="Full name"
            className="h-11 rounded-xl border border-input bg-background px-3"
          />
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="Work email"
            className="h-11 rounded-xl border border-input bg-background px-3"
          />
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Password"
            className="h-11 rounded-xl border border-input bg-background px-3"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Register
          </button>
        </form>

        <Link href="/auth/login" className="mt-5 block text-sm text-primary">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
