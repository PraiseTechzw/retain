"use client";

import { useState } from "react";

type SignUpAction = (formData: FormData) => void | Promise<void>;

function passwordStrength(password: string) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

const strengthLabel = ["Too short", "Weak", "Okay", "Good", "Strong"];
const strengthColor = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-lime-500",
  "bg-emerald-500",
];

export default function RegisterForm({
  signUp,
  appName,
  message,
}: {
  signUp: SignUpAction;
  appName: string;
  message?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const strength = passwordStrength(password);
  const isErrorMessage =
    !!message &&
    /invalid|error|required|failed|denied|weak|already|limit/i.test(message);

  return (
    <>
      <div className="text-center">
        <p className="text-sm font-semibold text-primary">{appName}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Create account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Request access to {appName}.
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

      <form action={signUp} className="mt-7 flex flex-col gap-5">
        <label htmlFor="register-name" className="flex flex-col gap-2 text-sm font-medium">
          Full name
          <input
            id="register-name"
            name="full_name"
            autoComplete="name"
            required
            placeholder="Your full name"
            className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <label htmlFor="register-email" className="flex flex-col gap-2 text-sm font-medium">
          Work email
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="name@university.edu"
            className="h-11 rounded-xl border border-input bg-background px-3 font-normal outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="flex flex-col gap-2 text-sm font-medium">
          <label htmlFor="register-password">Password</label>
          <div className="relative">
            <input
              id="register-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-16 font-normal outline-none transition placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/40"
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

          {password ? (
            <div aria-live="polite" className="mt-1">
              <div
                className="flex h-1.5 gap-1"
                role="meter"
                aria-label="Password strength"
                aria-valuemin={0}
                aria-valuemax={4}
                aria-valuenow={strength}
              >
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      index < strength ? strengthColor[strength] : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs font-normal text-muted-foreground">
                {strengthLabel[strength]}
              </p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          Create account
        </button>
      </form>
    </>
  );
}
