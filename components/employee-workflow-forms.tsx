"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  uploadEmployeeDocument,
  type EmployeeWorkflowResult,
} from "@/lib/supabase/employee-workflows";

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
            <Select name="category" required defaultValue="appointment">
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
