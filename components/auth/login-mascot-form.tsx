"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SignInAction = (formData: FormData) => void | Promise<void>;

export default function LoginMascotForm({
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
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const mascotRef = useRef<HTMLDivElement>(null);

  // eyes follow the cursor while the email field is focused
  useEffect(() => {
    if (focusedField !== "email") return;

    function handleMove(e: MouseEvent) {
      const el = mascotRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.min(Math.hypot(dx, dy), 120);
      const angle = Math.atan2(dy, dx);
      setEyeOffset({
        x: Math.cos(angle) * (dist / 120) * 4,
        y: Math.sin(angle) * (dist / 120) * 4,
      });
    }

    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [focusedField]);

  const eyesCovered = focusedField === "password" && !showPassword;
  const isErrorMessage =
    !!message && /invalid|error|required|failed|denied/i.test(message);
  const isSuccessMessage = !!message && !isErrorMessage;

  return (
    <>
      <style>{`
        @keyframes lm-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes lm-blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes lm-hand-up { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes lm-hand-down { from { transform: translateY(0); opacity: 1; } to { transform: translateY(28px); opacity: 0; } }
        @keyframes lm-blob { 0%, 100% { border-radius: 42% 58% 65% 35% / 45% 40% 60% 55%; } 50% { border-radius: 60% 40% 35% 65% / 55% 65% 35% 45%; } }
        @keyframes lm-error-shake { 0%, 100% { transform: translateX(0); } 15% { transform: translateX(-8px); } 30% { transform: translateX(8px); } 45% { transform: translateX(-6px); } 60% { transform: translateX(6px); } 75% { transform: translateX(-4px); } 90% { transform: translateX(4px); } }
        @keyframes lm-success-glass { 0% { transform: scale(1); opacity: 1; filter: blur(0px); box-shadow: 0 0 0 rgba(16,185,129,0.15); } 30% { transform: scale(1.01); opacity: 1; filter: blur(0.5px); box-shadow: 0 0 18px rgba(16,185,129,0.26); } 62% { transform: scale(1.03); opacity: 0.96; filter: blur(1.2px); box-shadow: 0 0 26px rgba(16,185,129,0.22); } 100% { transform: scale(1); opacity: 1; filter: blur(0); box-shadow: 0 0 0 rgba(16,185,129,0); } }
        .lm-float { animation: lm-float 4s ease-in-out infinite; }
        .lm-blink { animation: lm-blink 4.5s ease-in-out infinite; transform-origin: center; }
        .lm-hand-shown { animation: lm-hand-up 0.35s ease-out forwards; }
        .lm-hand-hidden { animation: lm-hand-down 0.3s ease-in forwards; }
        .lm-blob { animation: lm-blob 8s ease-in-out infinite; }
        .lm-error-shake { animation: lm-error-shake 0.4s ease-in-out 1; }
        .lm-success-glass { animation: lm-success-glass 0.7s ease-out 1; }
      `}</style>

      {/* mascot */}
      <div
        ref={mascotRef}
        className="relative mx-auto mb-2 flex h-28 w-28 items-center justify-center"
      >
        <div className="lm-blob absolute inset-0 bg-primary/10" />
        <svg
          viewBox="0 0 120 120"
          className="lm-float relative h-24 w-24"
          aria-hidden
        >
          <circle cx="28" cy="28" r="14" className="fill-primary/20" />
          <circle cx="92" cy="28" r="14" className="fill-primary/20" />
          <circle
            cx="60"
            cy="62"
            r="46"
            className="fill-card stroke-border"
            strokeWidth="2"
          />

          <g
            style={{ opacity: eyesCovered ? 0 : 1, transition: "opacity 0.2s" }}
          >
            <g
              className="lm-blink"
              style={{
                transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)`,
              }}
            >
              <circle cx="42" cy="60" r="6" className="fill-foreground" />
              <circle cx="78" cy="60" r="6" className="fill-foreground" />
            </g>
          </g>

          <circle cx="34" cy="78" r="7" className="fill-primary/20" />
          <circle cx="86" cy="78" r="7" className="fill-primary/20" />

          <path
            d={eyesCovered ? "M 48 88 Q 60 82 72 88" : "M 46 86 Q 60 98 74 86"}
            className="stroke-foreground"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            style={{ transition: "d 0.2s" }}
          />

          {focusedField === "password" && (
            <g className={eyesCovered ? "lm-hand-shown" : "lm-hand-hidden"}>
              <ellipse
                cx="42"
                cy="58"
                rx="13"
                ry="11"
                className="fill-primary/40 stroke-border"
                strokeWidth="1.5"
              />
              <ellipse
                cx="78"
                cy="58"
                rx="13"
                ry="11"
                className="fill-primary/40 stroke-border"
                strokeWidth="1.5"
              />
            </g>
          )}
        </svg>
      </div>

      <p className="text-center text-sm font-semibold text-primary">
        {appName}
      </p>
      <h1 className="mt-3 text-center text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Sign in to your {workspaceLabel.toLowerCase()}.
      </p>

      {message ? (
        <p
          aria-live="polite"
          className={
            isErrorMessage
              ? "lm-error-shake mt-4 max-w-full break-words rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              : isSuccessMessage
                ? "lm-success-glass mt-4 max-w-full break-words rounded-xl border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-sm text-emerald-700 backdrop-blur-sm"
                : "mt-4 max-w-full break-words rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          }
        >
          {message}
        </p>
      ) : null}

      <form
        action={signIn}
        className={
          isErrorMessage
            ? "lm-error-shake mt-8 flex flex-col gap-4"
            : isSuccessMessage
              ? "lm-success-glass mt-8 flex flex-col gap-4"
              : "mt-8 flex flex-col gap-4"
        }
      >
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="Work email"
          onFocus={() => {
            setFocusedField("email");
            setEyeOffset({ x: 0, y: 0 });
          }}
          onBlur={() => {
            setFocusedField(null);
            setEyeOffset({ x: 0, y: 0 });
          }}
          className="h-11 rounded-xl border border-input bg-background px-3 outline-none transition focus:ring-2 focus:ring-primary/40"
        />

        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="Password"
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 pr-11 outline-none transition focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <button
          type="submit"
          className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.98]"
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
    </>
  );
}
