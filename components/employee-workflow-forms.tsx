"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  closeEngagementSurvey,
  createEngagementSurvey,
  createRetentionAction,
  submitEngagementSurvey,
  updateRetentionAction,
  uploadEmployeeDocument,
  type EmployeeWorkflowResult,
} from "@/lib/supabase/employee-workflows";

export type EngagementQuestion = {
  key: string;
  prompt: string;
  type: "rating";
};

export type EngagementSurvey = {
  id: string;
  title: string;
  opens_on: string;
  closes_on: string;
  status: "draft" | "open" | "closed";
  questions: EngagementQuestion[];
};

export type RetentionAction = {
  id: string;
  title: string;
  concern: string;
  owner_id: string | null;
  due_on: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  outcome: string | null;
  created_at: string;
};

function ActionMessage({ result }: { result: EmployeeWorkflowResult | null }) {
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

function useWorkflowSubmit(
  action: (formData: FormData) => Promise<EmployeeWorkflowResult>,
) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EmployeeWorkflowResult | null>(null);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await action(formData);
      setResult(response);
      if (response.ok) router.refresh();
    });
  }

  return { pending, result, submit };
}

export function EngagementSurveyBuilder() {
  const { pending, result, submit } = useWorkflowSubmit(createEngagementSurvey);
  return (
    <form
      action={submit}
      className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-2 md:p-6"
    >
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Schedule a staff survey</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Each question uses a five-point agreement scale. Responses are confidential and linked to the employee account; this is not an anonymous survey.
        </p>
      </div>
      <FieldGroup className="grid gap-4 md:grid-cols-2 md:col-span-2">
        <Field>
          <FieldLabel htmlFor="engagement-survey-title">Survey title</FieldLabel>
          <Input
            id="engagement-survey-title"
            name="title"
            required
            minLength={3}
            maxLength={160}
            className="h-10"
          />
        </Field>
        <FieldGroup className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="engagement-survey-opens">Opens on</FieldLabel>
            <Input
              id="engagement-survey-opens"
              name="opens_on"
              type="date"
              required
              className="h-10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="engagement-survey-closes">Closes on</FieldLabel>
            <Input
              id="engagement-survey-closes"
              name="closes_on"
              type="date"
              required
              className="h-10"
            />
          </Field>
        </FieldGroup>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="engagement-survey-questions">Questions</FieldLabel>
          <Textarea
            id="engagement-survey-questions"
            name="questions"
            required
            maxLength={3000}
            placeholder={"I have the resources I need to do my work.\nI feel supported by my manager."}
            className="min-h-24"
            aria-describedby="engagement-question-help"
          />
          <FieldDescription id="engagement-question-help">
            Enter one question per line, up to 12. Employees rate each from 1 (strongly disagree) to 5 (strongly agree).
          </FieldDescription>
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="submit" size="lg" className="min-h-10" disabled={pending}>
          {pending ? "Creating…" : "Create survey"}
        </Button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function EngagementSurveyResponse({
  survey,
  submitted,
}: {
  survey: EngagementSurvey;
  submitted: boolean;
}) {
  const { pending, result, submit } = useWorkflowSubmit(submitEngagementSurvey);
  return (
    <form
      action={submit}
      className="grid gap-5 rounded-2xl border border-border/70 bg-card p-5 md:p-6"
    >
      <input type="hidden" name="survey_id" value={survey.id} />
      <div>
        <h2 className="text-lg font-semibold">{survey.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Closes {new Date(`${survey.closes_on}T12:00:00`).toLocaleDateString()} · Confidential and linked to your employee account; not anonymous.
        </p>
      </div>
      {survey.questions.map((question, index) => (
        <FieldSet key={question.key} className="gap-3">
          <FieldLegend variant="label">
            {index + 1}. {question.prompt}
          </FieldLegend>
          <RadioGroup
            name={`answer_${question.key}`}
            required
            disabled={submitted || pending}
            className="grid gap-2 sm:grid-cols-5"
          >
            {[
              ["1", "Strongly disagree"],
              ["2", "Disagree"],
              ["3", "Neither"],
              ["4", "Agree"],
              ["5", "Strongly agree"],
            ].map(([value, label]) => {
              const id = `survey-${survey.id}-${question.key}-${value}`;
              return (
                <FieldLabel
                  key={value}
                  htmlFor={id}
                  className="min-h-10 items-center rounded-lg border border-border px-3 py-2 font-normal"
                >
                  <Field orientation="horizontal">
                    <RadioGroupItem id={id} value={value} />
                    <span>{label}</span>
                  </Field>
                </FieldLabel>
              );
            })}
          </RadioGroup>
        </FieldSet>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {submitted ? (
          <p role="status" className="text-sm font-medium text-muted-foreground">
            Your response has been recorded.
          </p>
        ) : (
          <Button type="submit" size="lg" className="min-h-10" disabled={pending}>
            {pending ? "Submitting…" : "Submit response"}
          </Button>
        )}
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function CloseEngagementSurveyForm({ surveyId }: { surveyId: string }) {
  const { pending, result, submit } = useWorkflowSubmit(closeEngagementSurvey);
  return (
    <form action={submit} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="survey_id" value={surveyId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="min-h-9"
        disabled={pending}
      >
        {pending ? "Closing…" : "Close survey"}
      </Button>
      <ActionMessage result={result} />
    </form>
  );
}

export function RetentionActionForm() {
  const { pending, result, submit } = useWorkflowSubmit(createRetentionAction);
  return (
    <form
      action={submit}
      className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 md:grid-cols-2 md:p-6"
    >
      <div className="md:col-span-2">
        <h2 className="text-lg font-semibold">Create a retention action</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Record a practical, HR-owned response to a recurring staff concern. Do not enter confidential case details here.
        </p>
      </div>
      <FieldGroup className="grid gap-4 md:grid-cols-2 md:col-span-2">
        <Field>
          <FieldLabel htmlFor="retention-action-title">Action</FieldLabel>
          <Input
            id="retention-action-title"
            name="title"
            required
            minLength={3}
            maxLength={160}
            className="h-10"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="retention-action-due">Due date</FieldLabel>
          <Input id="retention-action-due" name="due_on" type="date" className="h-10" />
        </Field>
        <Field className="md:col-span-2">
          <FieldLabel htmlFor="retention-action-concern">Concern and intended response</FieldLabel>
          <Textarea
            id="retention-action-concern"
            name="concern"
            required
            minLength={3}
            maxLength={2000}
            className="min-h-24"
          />
        </Field>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <Button type="submit" size="lg" className="min-h-10" disabled={pending}>
          {pending ? "Saving…" : "Create action"}
        </Button>
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function RetentionActionUpdateForm({
  action,
}: {
  action: RetentionAction;
}) {
  const { pending, result, submit } = useWorkflowSubmit(updateRetentionAction);
  return (
    <form
      action={submit}
      className="grid gap-3 border-t border-border/70 pt-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end"
    >
      <input type="hidden" name="action_id" value={action.id} />
      <FieldGroup className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem] sm:col-span-2">
        <Field>
          <FieldLabel htmlFor={`retention-outcome-${action.id}`}>Outcome</FieldLabel>
          <Textarea
            id={`retention-outcome-${action.id}`}
            name="outcome"
            maxLength={2000}
            defaultValue={action.outcome ?? ""}
            className="min-h-20"
          />
        </Field>
        <Field>
          <FieldLabel id={`retention-status-label-${action.id}`}>Status</FieldLabel>
          <Select name="status" defaultValue={action.status}>
            <SelectTrigger
              aria-labelledby={`retention-status-label-${action.id}`}
              className="h-10 w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg" className="min-h-10" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <div className="sm:col-span-3">
        <ActionMessage result={result} />
      </div>
    </form>
  );
}

export function EmployeeDocumentUploadForm({
  employeeId,
}: {
  employeeId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EmployeeWorkflowResult | null>(null);

  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const response = await uploadEmployeeDocument(formData);
      setResult(response);
      if (response.ok) {
        formRef.current?.reset();
        router.refresh();
      }
    });
  }

  return (
    <section
      id="employee-document-upload"
      className="rounded-2xl border border-border/70 bg-card p-5 md:p-6"
    >
      <h2 className="text-lg font-semibold">Upload a personnel document</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Private PDF, Word, or text files up to 10 MB. The employee and HR staff can access the saved document.
      </p>
      <form
        ref={formRef}
        action={submit}
        className="mt-4 grid gap-4 md:grid-cols-2"
      >
        <input type="hidden" name="employee_id" value={employeeId} />
        <FieldGroup className="grid gap-4 md:grid-cols-2 md:col-span-2">
          <Field>
            <FieldLabel htmlFor="employee-document-title">Document title</FieldLabel>
            <Input
              id="employee-document-title"
              name="title"
              required
              maxLength={160}
              className="h-10"
            />
          </Field>
          <Field>
            <FieldLabel id="employee-document-category-label">Category</FieldLabel>
            <Select
              name="category"
              required
              defaultValue="appointment"
            >
              <SelectTrigger
                aria-labelledby="employee-document-category-label"
                className="h-10 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="appointment">Appointment</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="policy">Policy</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="employee-document-file">File</FieldLabel>
            <Input
              id="employee-document-file"
              name="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              required
              aria-describedby="employee-document-file-rules"
              className="h-auto py-2"
            />
            <FieldDescription id="employee-document-file-rules">
              PDF, Word, or plain text; maximum size 10 MB.
            </FieldDescription>
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap items-center gap-3 md:col-span-2">
          <Button type="submit" size="lg" className="min-h-10" disabled={pending}>
            {pending ? "Uploading…" : "Upload document"}
          </Button>
          <ActionMessage result={result} />
        </div>
      </form>
    </section>
  );
}
