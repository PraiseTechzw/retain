import Link from "next/link";
import Image from "next/image";
import { resetPassword } from "@/lib/supabase/actions";

export default function Page() {
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
