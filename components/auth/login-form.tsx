"use client";

import Link from "next/link";
import { useState } from "react";

type SignInAction = (formData: FormData) => void | Promise<void>;

export default function LoginForm({
  signIn,
  appName,
  workspaceLabel,
  message,
}: {
  signIn: SignInAction;
  appName: string;
  workspaceLabel: string;
  message?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isErrorMessage =
    !!message && /invalid|error|required|failed|denied|inactive|no active/i.test(message);

  return (
    <>
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">{appName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your {workspaceLabel.toLowerCase()}.
        </p>
      </div>

      {message ? (
        <p
          role={isErrorMessage ? "alert" : "status"}
          aria-live="polite"
          className={
            isErrorMessage
              ? "mt-5 max-w-full break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
              : "mt-5 max-w-full break-words rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
          }
        >
          {message}
        </p>
      ) : null}

      <form action={signIn} className="mt-7 flex flex-col gap-5">
        <label htmlFor="login-email" className="flex flex-col gap-2 text-sm font-medium">
          Work email
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@university.edu"
            className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm font-medium">
          <label htmlFor="login-password">Password</label>
          <div className="relative">
            <input
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-16 font-normal outline-none transition focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className="-mt-2 flex justify-end">
          <Link
            href="/auth/reset-password"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Need an account?{" "}
        <Link
          href="/auth/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Create account
        </Link>
      </p>
    </>
  );
}
