"use client";

import { useActionState } from "react";
import {
  recordRetentionIntervention,
  type RetentionActionState,
} from "@/lib/supabase/actions";

const initialState: RetentionActionState = { status: "idle", message: "" };

export function RetentionSupportActionForm({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const [state, formAction, pending] = useActionState(
    recordRetentionIntervention,
    initialState,
  );

  return (
    <form action={formAction} className="min-w-64 space-y-2">
      <input type="hidden" name="employee_id" value={employeeId} />
      <label className="sr-only" htmlFor={`support-action-${employeeId}`}>
        Support action for {employeeName}
      </label>
      <select
        id={`support-action-${employeeId}`}
        name="intervention_type"
        required
        className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
      >
        <option value="career_conversation">Career conversation</option>
        <option value="workload_review">Workload review</option>
        <option value="development">Development opportunity</option>
        <option value="commute_support">Commute support</option>
        <option value="other">Other</option>
      </select>
      <label className="sr-only" htmlFor={`support-notes-${employeeId}`}>
        Agreed support action and context for {employeeName}
      </label>
      <textarea
        id={`support-notes-${employeeId}`}
        name="action_notes"
        required
        maxLength={2000}
        rows={2}
        placeholder="Agreed action and context"
        className="w-full rounded-lg border border-input bg-background p-2 text-xs"
      />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor={`support-follow-up-${employeeId}`}>
          Follow-up date for {employeeName}
        </label>
        <input
          id={`support-follow-up-${employeeId}`}
          name="follow_up_on"
          type="date"
          className="h-9 min-w-0 flex-1 rounded-lg border border-input bg-background px-2 text-xs"
        />
        <button
          disabled={pending}
          className="rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Saving…" : "Record action"}
        </button>
      </div>
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={`text-xs ${state.status === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
