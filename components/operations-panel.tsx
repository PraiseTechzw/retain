"use client";

import { useState, useTransition } from "react";
import {
  createAsset,
  createEmployee,
  createExitRequest,
  uploadKnowledgeDocument,
} from "@/lib/supabase/actions";

type Mode = "employee" | "exit" | "asset" | "knowledge";
type EmployeeOption = {
  id: string;
  employee_number: string;
  full_name: string;
};
type DepartmentOption = { id: string; name: string };
type KnowledgeRequirementOption = { id: string; name: string };

const labels: Record<Mode, string> = {
  employee: "Add employee",
  exit: "New exit request",
  asset: "Add asset",
  knowledge: "Upload document",
};

export function OperationsPanel({
  mode,
  employees = [],
  departments = [],
  knowledgeRequirements = [],
}: {
  mode: Mode;
  employees?: EmployeeOption[];
  departments?: DepartmentOption[];
  knowledgeRequirements?: KnowledgeRequirementOption[];
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        if (mode === "employee") await createEmployee(formData);
        if (mode === "exit") await createExitRequest(formData);
        if (mode === "asset") await createAsset(formData);
        if (mode === "knowledge") await uploadKnowledgeDocument(formData);
        setMessage("Saved successfully.");
        setOpen(false);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to save record.",
        );
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
      >
        {labels[mode]}
      </button>
      {message && (
        <p role="status" className="text-xs text-muted-foreground">
          {message}
        </p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={labels[mode]}
        >
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{labels[mode]}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground"
              >
                Close
              </button>
            </div>
            <form action={submit} className="mt-5 flex flex-col gap-4">
              {mode === "employee" && (
                <>
                  <Field name="employee_number" label="Employee number" required />
                  <Field name="full_name" label="Full name" required />
                  <Field name="email" label="Email" type="email" />
                  <Field name="phone" label="Phone" type="tel" />
                  <Field name="job_title" label="Job title" />
                  <Field name="joined_on" label="Start date" type="date" />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Department
                    <select
                      name="department_id"
                      defaultValue=""
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      <option value="">Unassigned</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Employment category
                    <select
                      name="employment_category"
                      defaultValue="support"
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      <option value="academic">Academic</option>
                      <option value="academic_attaché">Academic attaché</option>
                      <option value="support">Support staff</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input name="is_technical" type="checkbox" className="size-4 accent-primary" />
                    Technical staff (knowledge handover required before exit)
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Home area (town/suburb only, optional)
                    <input
                      name="home_area"
                      maxLength={80}
                      placeholder="Do not enter a street address"
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    />
                  </label>
                  <Field
                    name="commute_distance_km"
                    label="One-way commute (km)"
                    type="number"
                    step="any"
                    min="0"
                  />
                </>
              )}
              {mode === "exit" && (
                <>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Employee
                    <select
                      name="employee_id"
                      required
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.employee_number} · {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field name="last_day" label="Last working day" type="date" />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Reason
                    <textarea
                      name="reason"
                      required
                      rows={4}
                      className="rounded-lg border border-input bg-background p-3 font-normal"
                    />
                  </label>
                </>
              )}
              {mode === "asset" && (
                <>
                  <Field name="asset_tag" label="Asset tag" required />
                  <Field name="asset_type" label="Asset type" required />
                  <Field name="description" label="Description" />
                </>
              )}
              {mode === "knowledge" && (
                <>
                  <Field name="title" label="Document title" required />
                  <Field name="category" label="Category" />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Requirement
                    <select
                      name="requirement_id"
                      defaultValue=""
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      <option value="">General document</option>
                      {knowledgeRequirements.map((requirement) => (
                        <option key={requirement.id} value={requirement.id}>
                          {requirement.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Employee
                    <select
                      name="employee_id"
                      required
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.employee_number} · {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    File
                    <input
                      name="file"
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      className="rounded-lg border border-input bg-background p-2 text-sm font-normal"
                    />
                    <span className="text-xs font-normal text-muted-foreground">
                      PDF, Word, Excel, or PowerPoint; maximum 10 MB.
                    </span>
                  </label>
                </>
              )}
              <button
                disabled={pending}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save record"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required = false,
  step,
  min,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  min?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        step={step}
        min={min}
        className="h-10 rounded-lg border border-input bg-background px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}
