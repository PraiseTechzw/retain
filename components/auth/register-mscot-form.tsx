"use client";

import { useEffect, useRef, useState } from "react";

type SignUpAction = (formData: FormData) => void | Promise<void>;

function passwordStrength(pw: string) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0-4
}

const strengthLabel = ["Too short", "Weak", "Okay", "Good", "Strong"];
const strengthColor = [
  "bg-red-400",
  "bg-orange-400",
  "bg-yellow-400",
  "bg-lime-500",
  "bg-emerald-500",
];

export default function RegisterMascotForm({
  signUp,
  appName,
}: {
  signUp: SignUpAction;
  appName: string;
}) {
  const [focusedField, setFocusedField] = useState<
    "name" | "email" | "password" | null
  >(null);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const mascotRef = useRef<HTMLDivElement>(null);

  const strength = passwordStrength(password);
  const eyesCovered = focusedField === "password" && !showPassword;

  // eyes track cursor while name/email focused
  useEffect(() => {
    if (focusedField !== "name" && focusedField !== "email") return;

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

  // mouth curve gets happier as password gets stronger; sad-ish default; covered look while hiding password
  const mouthPath = (() => {
    if (eyesCovered) return "M 48 88 Q 60 82 72 88";
    if (focusedField === "password") {
      const lift = 4 + strength * 4; // deeper smile with strength
      return `M 44 84 Q 60 ${84 + lift} 76 84`;
    }
    return "M 46 86 Q 60 96 74 86";
  })();

  return (
    <>
      <style>{`
        @keyframes rm-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes rm-blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
        @keyframes rm-hand-up { from { transform: translateY(28px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes rm-hand-down { from { transform: translateY(0); opacity: 1; } to { transform: translateY(28px); opacity: 0; } }
        @keyframes rm-blob { 0%, 100% { border-radius: 42% 58% 65% 35% / 45% 40% 60% 55%; } 50% { border-radius: 60% 40% 35% 65% / 55% 65% 35% 45%; } }
        @keyframes rm-wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-18deg); } 75% { transform: rotate(18deg); } }
        @keyframes rm-pop { 0% { transform: scale(0.9); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
        .rm-float { animation: rm-float 4s ease-in-out infinite; }
        .rm-blink { animation: rm-blink 4.5s ease-in-out infinite; transform-origin: center; }
        .rm-hand-shown { animation: rm-hand-up 0.35s ease-out forwards; }
        .rm-hand-hidden { animation: rm-hand-down 0.3s ease-in forwards; }
        .rm-blob { animation: rm-blob 8s ease-in-out infinite; }
        .rm-wave { transform-origin: 90px 70px; animation: rm-wave 0.6s ease-in-out infinite; }
        .rm-pop { animation: rm-pop 0.25s ease-out; }
      `}</style>

      {/* mascot */}
      <div
        ref={mascotRef}
        className="relative mx-auto mb-2 flex h-28 w-28 items-center justify-center"
      >
        <div className="rm-blob absolute inset-0 bg-primary/10" />
        <svg
          viewBox="0 0 120 120"
          className="rm-float relative h-24 w-24"
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
              className="rm-blink"
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
            key={mouthPath}
            d={mouthPath}
            className="rm-pop stroke-foreground"
            strokeWidth="3"
            strokeLinecap="round"
            fill="none"
            style={{ transformOrigin: "60px 88px" }}
          />

          {focusedField === "password" && (
            <g className={eyesCovered ? "rm-hand-shown" : "rm-hand-hidden"}>
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

          {focusedField === "name" && (
            <g className="rm-wave">
              <ellipse
                cx="98"
                cy="62"
                rx="8"
                ry="12"
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
      <h1 className="mt-3 text-center text-3xl font-semibold">
        Create account
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Request access to {appName}.
      </p>

      <form action={signUp} className="mt-8 flex flex-col gap-4">
        <input
          name="full_name"
          autoComplete="name"
          required
          placeholder="Full name"
          onFocus={() => {
            setFocusedField("name");
            setEyeOffset({ x: 0, y: 0 });
          }}
          onBlur={() => {
            setFocusedField(null);
            setEyeOffset({ x: 0, y: 0 });
          }}
          className="h-11 rounded-xl border border-input bg-background px-3 outline-none transition focus:ring-2 focus:ring-primary/40"
        />
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

        <div>
          <div className="relative">
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => {
                setFocusedField("password");
                setEyeOffset({ x: 0, y: 0 });
              }}
              onBlur={() => {
                setFocusedField(null);
                setEyeOffset({ x: 0, y: 0 });
              }}
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

          {password ? (
            <div className="mt-2">
              <div className="flex h-1.5 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-full flex-1 rounded-full transition-colors ${
                      i < strength ? strengthColor[strength] : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {strengthLabel[strength]}
              </p>
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.98]"
        >
          Register
        </button>
      </form>
    </>
  );
}
