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
import { completeOnboarding, signOut } from "@/lib/supabase/actions";
import { createClient } from "@/lib/supabase/client";

type Department = { id: string; name: string; code: string | null };
type OnboardingAction = (formData: FormData) => void | Promise<void>;

const FALLBACK_DEPARTMENTS = [
  { name: "Information and Communication Technology", code: "ICT" },
  { name: "Human Resources", code: "HR" },
  { name: "Library Services", code: "LIB" },
  { name: "Finance", code: "FIN" },
  { name: "Faculty of Engineering", code: "ENG" },
  { name: "Research and Innovation", code: "R&I" },
] as const;

export default function OnboardingForm({
  action,
  appName,
  nextPath,
  userName,
  defaultRole,
  departments,
}: {
  action?: OnboardingAction;
  appName?: string;
  nextPath?: string;
  userName?: string;
  defaultRole?: string;
  departments?: Department[];
}) {
  const activeAction = action ?? completeOnboarding;
  const safeAppName = appName ?? "Retain";
  const safeNextPath = nextPath ?? "/dashboard";
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
        if (!departmentId && safeDepartments[0]?.id) {
          setDepartmentId(safeDepartments[0].id);
        }
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
        if (!departmentId && data[0]?.id) {
          setDepartmentId(data[0].id);
        }
        return;
      }

      const fallbackPayload = FALLBACK_DEPARTMENTS.map((department) => ({
        name: department.name,
        code: department.code,
      }));

      const { error: seedError, data: seededData } = await supabase
        .from("departments")
        .upsert(fallbackPayload, { onConflict: "name" })
        .select("id, name, code");

      if (!active) return;

      if (!seedError && Array.isArray(seededData) && seededData.length > 0) {
        setAvailableDepartments(seededData as Department[]);
        if (!departmentId && seededData[0]?.id) {
          setDepartmentId(seededData[0].id);
        }
        return;
      }

      const fallbackRows = await supabase
        .from("departments")
        .select("id, name, code")
        .in(
          "name",
          FALLBACK_DEPARTMENTS.map((department) => department.name),
        )
        .order("name");

      if (!active) return;

      if (
        !fallbackRows.error &&
        Array.isArray(fallbackRows.data) &&
        fallbackRows.data.length > 0
      ) {
        setAvailableDepartments(fallbackRows.data as Department[]);
        if (!departmentId && fallbackRows.data[0]?.id) {
          setDepartmentId(fallbackRows.data[0].id);
        }
        return;
      }

      setAvailableDepartments([]);
    }

    loadDepartments();

    return () => {
      active = false;
    };
  }, [departmentId, safeDepartments]);

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
      setFullName(authFullName || safeUserName || "");
      setRole(safeDefaultRole || "Employee");

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm">
        <style>{`
          @keyframes ob-bar-shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
          .ob-shine { animation: ob-bar-shine 1.8s ease-in-out infinite; }
        `}</style>

        <div className="mb-4 flex items-center justify-center gap-2 text-primary">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">{safeAppName}</p>
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
          action={activeAction}
          onSubmit={() => setSubmitting(true)}
          className="mt-6 flex flex-col gap-4"
        >
          <input type="hidden" name="next" value={safeNextPath} />

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
            <input
              value={role}
              readOnly
              aria-readonly="true"
              className="h-11 rounded-xl border border-input bg-muted/50 px-3 text-muted-foreground"
            />
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

          {availableDepartments.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Departments are not available yet. Please contact an administrator
              to seed the department list.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || availableDepartments.length === 0}
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
