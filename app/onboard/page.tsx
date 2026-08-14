"use client";

import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/lib/supabase/actions";
import { createClient } from "@/lib/supabase/client";

type Department = { id: string; name: string; code: string | null };
type OnboardingAction = (formData: FormData) => void | Promise<void>;

const FALLBACK_DEPARTMENTS: Department[] = [
  { id: "ict", name: "Information and Communication Technology", code: "ICT" },
  { id: "hr", name: "Human Resources", code: "HR" },
  { id: "library", name: "Library Services", code: "LIB" },
  { id: "finance", name: "Finance", code: "FIN" },
  { id: "engineering", name: "Faculty of Engineering", code: "ENG" },
  { id: "research", name: "Research and Innovation", code: "R&I" },
];

const ROLE_ACCESSORY: Record<string, string> = {
  Employee: "laptop",
  HR: "badge",
  Management: "tie",
};

export default function OnboardingForm({
  action,
  appName,
  nextPath,
  userName,
  defaultRole,
  departments,
}: {
  action: OnboardingAction;
  appName: string;
  nextPath: string;
  userName: string;
  defaultRole: string;
  departments?: Department[];
}) {
  const safeUserName = userName ?? "";
  const safeDefaultRole = defaultRole ?? "Employee";
  const safeDepartments = useMemo(() => departments ?? [], [departments]);

  const router = useRouter();
  const [availableDepartments, setAvailableDepartments] =
    useState<Department[]>(safeDepartments);
  const [fullName, setFullName] = useState(safeUserName);
  const [role, setRole] = useState(safeDefaultRole);
  const [departmentId, setDepartmentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDepartments() {
      if (safeDepartments.length) {
        setAvailableDepartments(safeDepartments);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("departments")
        .select("id, name, code")
        .order("name");

      if (!active) return;

      if (!error && Array.isArray(data) && data.length > 0) {
        setAvailableDepartments(data as Department[]);
        return;
      }

      const fallbackPayload = FALLBACK_DEPARTMENTS.map((department) => ({
        id: department.id,
        name: department.name,
        code: department.code,
      }));

      const { error: seedError } = await supabase
        .from("departments")
        .upsert(fallbackPayload, { onConflict: "name" });

      if (!active) return;

      if (!seedError) {
        const { data: seededData } = await supabase
          .from("departments")
          .select("id, name, code")
          .order("name");

        if (Array.isArray(seededData) && seededData.length > 0) {
          setAvailableDepartments(seededData as Department[]);
          return;
        }
      }

      setAvailableDepartments(FALLBACK_DEPARTMENTS);
    }

    loadDepartments();

    return () => {
      active = false;
    };
  }, [safeDepartments]);

  useEffect(() => {
    let active = true;

    async function hydrateUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      const authFullName =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email?.split("@")[0] ??
        safeUserName;
      const authRole =
        (user.user_metadata?.role as string | undefined) ?? safeDefaultRole;

      setFullName(authFullName || safeUserName || "");
      setRole(authRole || safeDefaultRole || "Employee");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, role, department_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profile?.department_id) {
        router.replace("/dashboard");
        return;
      }

      if (profile?.full_name) setFullName(profile.full_name);
      if (profile?.role) setRole(profile.role);

      const { data: employee } = await supabase
        .from("employees")
        .select("id, department_id")
        .eq("email", user.email ?? "")
        .maybeSingle();

      if (!active) return;
      if (employee?.department_id) setDepartmentId(employee.department_id);
    }

    hydrateUser();

    return () => {
      active = false;
    };
  }, [router, safeDefaultRole, safeUserName]);

  const filled = useMemo(
    () => [
      Boolean((fullName ?? "").trim()),
      Boolean(role),
      Boolean(departmentId),
    ],
    [fullName, role, departmentId],
  );
  const completedCount = filled.filter(Boolean).length;
  const progress = (completedCount / filled.length) * 100;
  const accessory = ROLE_ACCESSORY[role] ?? "laptop";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <style>{`
          @keyframes ob-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
          @keyframes ob-blink { 0%, 90%, 100% { transform: scaleY(1); } 95% { transform: scaleY(0.1); } }
          @keyframes ob-wave { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-16deg); } 75% { transform: rotate(16deg); } }
          @keyframes ob-check-in { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.2) rotate(6deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
          @keyframes ob-pop { 0% { transform: scale(0.85); opacity: 0.6; } 100% { transform: scale(1); opacity: 1; } }
          @keyframes ob-bar-shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
          .ob-float { animation: ob-float 4.2s ease-in-out infinite; }
          .ob-blink { animation: ob-blink 5s ease-in-out infinite; transform-origin: center; }
          .ob-wave { transform-origin: 92px 68px; animation: ob-wave 0.7s ease-in-out 2; }
          .ob-check { animation: ob-check-in 0.35s ease-out forwards; transform-origin: center; }
          .ob-pop { animation: ob-pop 0.25s ease-out; }
          .ob-shine { animation: ob-bar-shine 1.8s ease-in-out infinite; }
        `}</style>

        {/* mascot with clipboard */}
        <div className="relative mx-auto mb-2 flex h-28 w-28 items-center justify-center">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: "var(--primary, currentColor)",
              borderRadius: "45% 55% 60% 40% / 50% 45% 55% 50%",
            }}
          />
          <svg
            viewBox="0 0 120 120"
            className="ob-float relative h-24 w-24"
            aria-hidden
          >
            <circle
              cx="60"
              cy="58"
              r="44"
              className="fill-card stroke-border"
              strokeWidth="2"
            />

            <g className="ob-blink">
              <circle cx="44" cy="56" r="5.5" className="fill-foreground" />
              <circle cx="76" cy="56" r="5.5" className="fill-foreground" />
            </g>
            <circle cx="36" cy="72" r="6" className="fill-primary/20" />
            <circle cx="84" cy="72" r="6" className="fill-primary/20" />
            <path
              d="M 46 80 Q 60 90 74 80"
              className="stroke-foreground"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />

            {/* waving arm */}
            <g className="ob-wave">
              <ellipse
                cx="92"
                cy="58"
                rx="7"
                ry="11"
                className="fill-primary/40 stroke-border"
                strokeWidth="1.5"
              />
            </g>

            {/* role accessory */}
            {accessory === "tie" && (
              <path
                key={accessory}
                d="M 55 96 L 65 96 L 62 118 L 58 118 Z"
                className="ob-pop fill-primary/60"
              />
            )}
            {accessory === "badge" && (
              <g key={accessory} className="ob-pop">
                <circle
                  cx="60"
                  cy="104"
                  r="7"
                  className="fill-primary/50 stroke-border"
                  strokeWidth="1"
                />
                <path
                  d="M 60 100 l 1.6 3.2 3.6 0.5 -2.6 2.5 0.6 3.5 -3.2 -1.7 -3.2 1.7 0.6 -3.5 -2.6 -2.5 3.6 -0.5 Z"
                  className="fill-card"
                />
              </g>
            )}
            {accessory === "laptop" && (
              <g key={accessory} className="ob-pop">
                <rect
                  x="46"
                  y="98"
                  width="28"
                  height="4"
                  rx="1"
                  className="fill-primary/50"
                />
                <rect
                  x="49"
                  y="90"
                  width="22"
                  height="9"
                  rx="1.5"
                  className="fill-card stroke-border"
                  strokeWidth="1"
                />
              </g>
            )}
          </svg>

          {/* clipboard progress badge */}
          <div className="absolute -right-2 -top-1 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card shadow-sm">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <rect
                x="4"
                y="3"
                width="16"
                height="19"
                rx="2"
                className="fill-none stroke-border"
                strokeWidth="1.5"
              />
              <rect
                x="8"
                y="1.5"
                width="8"
                height="3"
                rx="1"
                className="fill-muted stroke-border"
                strokeWidth="1"
              />
              {filled.map((done, i) =>
                done ? (
                  <path
                    key={i}
                    className="ob-check stroke-primary"
                    d={`M ${7} ${8 + i * 5} l 2 2 l 3 -3.5`}
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ) : (
                  <line
                    key={i}
                    x1="7"
                    y1={8 + i * 5}
                    x2="17"
                    y2={8 + i * 5}
                    className="stroke-muted-foreground/30"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                ),
              )}
            </svg>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-center gap-2 text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">{appName}</p>
        </div>
        <div className="mb-3 flex items-center justify-center gap-2 text-foreground">
          <UserRound className="h-5 w-5 text-primary" />
          <h1 className="text-center text-3xl font-semibold">
            Complete your onboarding
          </h1>
        </div>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We need your base profile and department before you can access the
          workspace.
        </p>

        {/* progress bar */}
        <div className="mt-5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="relative h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            >
              {progress > 0 && progress < 100 && (
                <div className="ob-shine absolute inset-y-0 left-0 w-1/3 bg-white/30" />
              )}
            </div>
          </div>
          <p className="mt-1.5 text-right text-xs text-muted-foreground">
            {completedCount} of {filled.length} steps done
          </p>
        </div>

        <form
          action={action}
          onSubmit={() => setSubmitting(true)}
          className="mt-6 flex flex-col gap-4"
        >
          <input type="hidden" name="next" value={nextPath} />

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              Full name
            </span>
            <input
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11 rounded-xl border border-input bg-background px-3 outline-none transition focus:ring-2 focus:ring-primary/40"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4 text-primary" />
              Role
            </span>
            <select
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-11 rounded-xl border border-input bg-background px-3 outline-none transition focus:ring-2 focus:ring-primary/40"
            >
              <option value="Employee">Employee</option>
              <option value="HR">HR</option>
              <option value="Management">Management</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Department
            </span>
            <select
              name="department_id"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="h-11 rounded-xl border border-input bg-background px-3 outline-none transition focus:ring-2 focus:ring-primary/40"
            >
              <option value="" disabled>
                Select your department
              </option>
              {availableDepartments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}{" "}
                  {department.code ? `(${department.code})` : ""}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground transition hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
          >
            {submitting ? "Setting things up…" : "Continue to dashboard"}
          </button>
        </form>

        <form action={signOut} className="mt-5 text-sm text-muted-foreground">
          <button
            type="submit"
            className="text-primary underline-offset-4 hover:underline"
          >
            Sign out
          </button>
        </form>

        <div className="mt-3 text-sm text-muted-foreground">
          Need a different account?{" "}
          <Link href="/auth/login" className="text-primary">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}
