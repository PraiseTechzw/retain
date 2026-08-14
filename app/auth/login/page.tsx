import Link from "next/link";
import { signIn } from "@/lib/supabase/actions";
import { appConfig } from "@/lib/system";

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
        <p className="text-sm font-semibold text-primary">
          {appConfig.appName}
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your {appConfig.workspaceLabel.toLowerCase()}.
        </p>

        {message ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}

        <form action={signIn} className="mt-8 flex flex-col gap-4">
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
            autoComplete="current-password"
            required
            placeholder="Password"
            className="h-11 rounded-xl border border-input bg-background px-3"
          />
          <button
            type="submit"
            className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground"
          >
            Sign in
          </button>
        </form>

        <div className="mt-5 flex justify-between text-sm">
          <Link href="/auth/reset-password" className="text-primary">
            Reset password
          </Link>
          <Link href="/auth/register" className="text-primary">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}
