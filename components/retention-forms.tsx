"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createRetentionFollowup,
  getHandoverGuideUrl,
  importPastExitCsv,
  runRetentionEarlyWarningAnalysis,
  saveExitInterview,
  shareHandoverGuide,
  submitPostExitSurvey,
  updateExitRehireDetails,
  updateRetentionFollowup,
  uploadHandoverGuide,
  type RetentionActionResult,
} from "@/lib/supabase/retention-actions";

type EmployeeOption = {
  id: string;
  employee_number: string;
  full_name: string;
};

type ExitOption = {
  id: string;
  employee_name: string;
  employee_number: string;
  last_day: string | null;
};

const fieldClass =
  "mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal";
const textAreaClass =
  "mt-1.5 min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm font-normal";
const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

function ActionMessage({ result }: { result: RetentionActionResult | null }) {
  if (!result) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`text-sm ${result.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}`}
    >
      {result.message}
    </p>
  );
}

export function HistoricalExitImportForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await importPastExitCsv(formData);
      setResult(response);
      if (response.ok) {
        (document.getElementById("historical-exit-import") as HTMLFormElement | null)?.reset();
        router.refresh();
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-5 md:p-6">
      <h2 className="text-lg font-semibold">Import historical exits</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        Import up to 500 records per CSV. Existing staff are matched by employee number; new historical staff records are created as exited. Existing employee details are not overwritten.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <a
          href="/templates/historical-exits-template.csv"
          download
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Download CSV template
        </a>
        <span className="text-muted-foreground">
          Dates use YYYY-MM-DD. Department names must already exist in the register.
        </span>
      </div>
      <form action={submit} id="historical-exit-import" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="text-sm font-medium">
          Historical exit CSV
          <input
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className={`${fieldClass} h-auto py-2`}
            aria-describedby="historical-csv-columns"
          />
          <span id="historical-csv-columns" className="mt-2 block text-xs font-normal text-muted-foreground">
            Required columns: employee_number, full_name, staff_category, exit_date, reason_category. Optional columns are listed in the template.
          </span>
        </label>
        <button type="submit" className={buttonClass} disabled={pending}>
          {pending ? "Importing…" : "Import records"}
        </button>
        <div className="md:col-span-2">
          <ActionMessage result={result} />
        </div>
      </form>
    </section>
  );
}

export function ExitInterviewForm({ exits }: { exits: ExitOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await saveExitInterview(formData);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  return (
    <form action={submit} className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-2 md:p-6">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Record a structured exit interview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Interview responses are confidential and visible to HR staff only.
        </p>
      </div>
      <label className="text-sm font-medium">
        Completed exit case
        <select name="exit_case_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select an exit case</option>
          {exits.map((exit) => (
            <option key={exit.id} value={exit.id}>
              {exit.employee_name} · {exit.employee_number} · {exit.last_day ?? "Date not recorded"}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Interview date
        <input name="interview_date" type="date" required className={fieldClass} />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        What was the primary reason for leaving?
        <textarea name="reason_for_leaving" required maxLength={2000} className={textAreaClass} />
      </label>
      <label className="text-sm font-medium">
        What could CUT have done differently?
        <textarea name="university_improvements" maxLength={2000} className={textAreaClass} />
      </label>
      <label className="text-sm font-medium">
        How would you describe your role experience?
        <textarea name="role_experience" maxLength={2000} className={textAreaClass} />
      </label>
      <label className="text-sm font-medium">
        Would you consider returning?
        <select name="would_return" defaultValue="" className={fieldClass}>
          <option value="">Not asked / not answered</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
          <option value="unsure">Unsure</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Additional comments
        <textarea name="additional_comments" maxLength={2000} className={textAreaClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className={buttonClass} disabled={pending || exits.length === 0}>
          {pending ? "Saving…" : "Save interview"}
        </button>
        {exits.length === 0 && (
          <span className="text-sm text-muted-foreground">Complete an exit case before recording its interview.</span>
        )}
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function RehireEligibilityForm({
  exitCaseId,
  goodStanding,
  openToReturn,
}: {
  exitCaseId: string;
  goodStanding: boolean;
  openToReturn: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await updateExitRehireDetails(formData);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }
  return (
    <form action={submit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="exit_case_id" value={exitCaseId} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="good_standing" defaultChecked={goodStanding} />
        Left in good standing
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="open_to_return" defaultChecked={openToReturn} />
        Open to return
      </label>
      <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      <ActionMessage result={result} />
    </form>
  );
}

export function RetentionFollowupForm({ employees }: { employees: EmployeeOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await createRetentionFollowup(formData);
      setResult(response);
      if (response.ok) {
        (document.getElementById("retention-followup-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} id="retention-followup-form" className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-2 md:p-6">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Add an HR follow-up</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This is a human-initiated support record, not an automated attrition prediction or employee score.
        </p>
      </div>
      <label className="text-sm font-medium">
        Employee
        <select name="employee_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name} · {employee.employee_number}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Follow-up date
        <input name="follow_up_on" type="date" className={fieldClass} />
      </label>
      <label className="text-sm font-medium md:col-span-2">
        Support concern or agreed follow-up
        <textarea name="reason" required maxLength={1000} className={textAreaClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className={buttonClass} disabled={pending || employees.length === 0}>
          {pending ? "Saving…" : "Record follow-up"}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function RetentionFollowupUpdateForm({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await updateRetentionFollowup(formData);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }
  return (
    <form action={submit} className="flex min-w-64 flex-wrap items-end gap-2">
      <input type="hidden" name="flag_id" value={id} />
      <label className="text-xs font-medium">
        Status
        <select name="status" defaultValue={status} className="mt-1 h-9 rounded-lg border border-input bg-background px-2 text-sm">
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </label>
      <label className="min-w-40 flex-1 text-xs font-medium">
        Outcome (required to resolve)
        <input name="outcome" maxLength={2000} className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-sm" />
      </label>
      <button type="submit" className="h-9 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted" disabled={pending}>
        {pending ? "Saving…" : "Update"}
      </button>
      <ActionMessage result={result} />
    </form>
  );
}

export function RunRetentionEarlyWarningAnalysisForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);

  function submit() {
    setResult(null);
    startTransition(async () => {
      const response = await runRetentionEarlyWarningAnalysis();
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className={buttonClass}
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Refreshing…" : "Refresh baseline and flags"}
      </button>
      <ActionMessage result={result} />
    </div>
  );
}

export function HandoverGuideForm({
  employees,
  isHr,
}: {
  employees: EmployeeOption[];
  isHr: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await uploadHandoverGuide(formData);
      setResult(response);
      if (response.ok) {
        (document.getElementById("handover-guide-form") as HTMLFormElement | null)?.reset();
        router.refresh();
      }
    });
  }

  return (
    <form action={submit} id="handover-guide-form" className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-2 md:p-6">
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Add a work handover guide</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Guides are private to the employee and authorised HR staff. Each upload creates a retained version.
        </p>
      </div>
      {isHr && (
        <label className="text-sm font-medium">
          Employee
          <select name="employee_id" required defaultValue="" className={fieldClass}>
            <option value="" disabled>Select an employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.full_name} · {employee.employee_number}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium">
        Guide title
        <input name="title" required maxLength={160} className={fieldClass} placeholder="e.g. Monthly laboratory reporting" />
      </label>
      <label className="text-sm font-medium">
        Guide file
        <input
          name="file"
          type="file"
          required
          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className={`${fieldClass} h-auto py-2`}
          aria-describedby="handover-file-rules"
        />
        <span id="handover-file-rules" className="mt-1 block text-xs font-normal text-muted-foreground">
          PDF, Word, or text file · up to 10 MB
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className={buttonClass} disabled={pending || (isHr && employees.length === 0)}>
          {pending ? "Uploading…" : "Upload guide"}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function HandoverGuideShareForm({
  guides,
  employees,
}: {
  guides: Array<{ id: string; title: string; version: number }>;
  employees: Array<{ id: string; full_name: string; employee_number: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await shareHandoverGuide(formData);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }
  return (
    <form action={submit} className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-[1fr_1fr_auto] md:items-end md:p-6">
      <div className="md:col-span-3">
        <h2 className="text-lg font-semibold">Share a guide with a successor</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only linked, active employee accounts can receive access. HR can revoke access by removing the share from approved database administration.
        </p>
      </div>
      <label className="text-sm font-medium">
        Guide
        <select name="guide_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select a guide</option>
          {guides.map((guide) => (
            <option key={guide.id} value={guide.id}>{guide.title} · v{guide.version}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Successor
        <select name="successor_employee_id" required defaultValue="" className={fieldClass}>
          <option value="" disabled>Select an employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name} · {employee.employee_number}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={buttonClass} disabled={pending || !guides.length || !employees.length}>
        {pending ? "Sharing…" : "Share guide"}
      </button>
      <div className="md:col-span-3">
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function HandoverDownloadButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        className="rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:opacity-60"
        disabled={pending}
        onClick={() => {
          setMessage("");
          startTransition(async () => {
            try {
              const url = await getHandoverGuideUrl(id);
              window.location.assign(url);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Unable to download guide.");
            }
          });
        }}
      >
        {pending ? "Preparing…" : "Download"}
      </button>
      {message && <span className="text-xs text-destructive" role="alert">{message}</span>}
    </div>
  );
}

export function PostExitSurveyForm({
  token,
  questions,
}: {
  token: string;
  questions: Array<{ key: string; prompt: string; options?: string[] }>;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RetentionActionResult | null>(null);
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await submitPostExitSurvey(token, formData);
      setResult(response);
    });
  }
  return (
    <form action={submit} className="mt-6 grid gap-5">
      {questions.map((question) => (
        <label key={question.key} className="text-sm font-medium">
          {question.prompt}
          {question.options?.length ? (
            <select name={question.key} required defaultValue="" className={fieldClass}>
              <option value="" disabled>Select an answer</option>
              {question.options.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())}
                </option>
              ))}
            </select>
          ) : (
            <textarea name={question.key} required maxLength={2000} className={textAreaClass} />
          )}
        </label>
      ))}
      <label className="text-sm font-medium">
        Is there anything else you would like HR to understand about your reasons for leaving?
        <textarea name="confirmed_reason" maxLength={2000} className={textAreaClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClass} disabled={pending || result?.ok === true}>
          {pending ? "Submitting…" : result?.ok ? "Submitted" : "Submit confidential feedback"}
        </button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}
