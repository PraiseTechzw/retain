"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, FileText, LoaderCircle, Upload, UserRoundPlus, X } from "lucide-react";
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
type KnowledgeRequirementOption = { id: string; name: string; description?: string | null };

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
  initialEmployeeId,
  initialRequirementId,
}: {
  mode: Mode;
  employees?: EmployeeOption[];
  departments?: DepartmentOption[];
  knowledgeRequirements?: KnowledgeRequirementOption[];
  initialEmployeeId?: string;
  initialRequirementId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const initialRequirement = knowledgeRequirements.find(
    (requirement) => requirement.id === initialRequirementId,
  );
  const [selectedRequirementId, setSelectedRequirementId] = useState(initialRequirement?.id ?? "");
  const [documentTitle, setDocumentTitle] = useState(initialRequirement?.name ?? "");
  const selectedRequirement = knowledgeRequirements.find((requirement) => requirement.id === selectedRequirementId);

  function submit(formData: FormData) {
    setMessage("");
    setMessageIsError(false);
    startTransition(async () => {
      try {
        if (mode === "employee") await createEmployee(formData);
        if (mode === "exit") await createExitRequest(formData);
        if (mode === "asset") await createAsset(formData);
        if (mode === "knowledge") await uploadKnowledgeDocument(formData);
        setMessage(
          mode === "asset"
            ? "Asset added to your inventory. Assign it to an employee to include it in their exit return checks. Issued assets must be returned and verified before exit clearance can be finalized."
            : mode === "employee"
              ? "Employee added successfully."
              : mode === "exit"
                ? "Exit request created successfully."
                : "Document uploaded successfully.",
        );
        setSelectedFile(null);
        setSelectedRequirementId(initialRequirement?.id ?? "");
        setDocumentTitle(initialRequirement?.name ?? "");
        setOpen(false);
      } catch (error) {
        setMessageIsError(true);
        const rawMessage = error instanceof Error ? error.message : "";
        setMessage(
          /Minified React error|Server Components render|digest/i.test(rawMessage)
            ? mode === "asset"
              ? "We couldn’t confirm the asset was saved. Check the asset register before trying again. If it isn’t listed, please try again or contact your administrator."
              : "We couldn’t confirm that this was saved. Check the relevant page before trying again, or contact your administrator."
            : rawMessage || "We couldn’t save this record. Please try again.",
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
        <p
          role={messageIsError ? "alert" : "status"}
          className={`text-xs ${messageIsError ? "text-destructive" : "text-muted-foreground"} ${open ? "sr-only" : ""}`}
        >
          {message}
        </p>
      )}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="operations-dialog-title"
        >
          <div
            className={`flex max-h-[calc(100dvh-2rem)] w-full ${
              mode === "employee" || mode === "knowledge" ? "max-w-2xl" : "max-w-lg"
            } flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl`}
          >
            <div className="flex items-start justify-between border-b border-border/70 px-6 py-5">
              <div className="flex items-start gap-3">
                {mode === "employee" && (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <UserRoundPlus aria-hidden="true" className="size-5" />
                  </span>
                )}
                <div>
                  <h2
                    id="operations-dialog-title"
                    className="text-lg font-semibold"
                  >
                    {labels[mode]}
                  </h2>
                  {mode === "employee" && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add the key details first. You can include optional details below.
                    </p>
                  )}
                  {mode === "knowledge" && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add the handover document to the matching requirement so HR can review and track it.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setOpen(false);
                }}
                disabled={pending}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <form
              action={submit}
              className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 py-5"
            >
              {mode === "employee" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field name="employee_number" label="Employee number" required />
                    <Field name="full_name" label="Full name" required />
                    <Field name="email" label="Work email" type="email" />
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
                  </div>
                  <details className="group rounded-xl border border-border/70 bg-muted/20">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold marker:hidden">
                      <span className="flex items-center justify-between">
                        Optional details
                        <span className="text-xs font-normal text-muted-foreground group-open:hidden">
                          Risk review and handover
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        />
                      </span>
                    </summary>
                    <div className="grid gap-4 border-t border-border/70 p-4 sm:grid-cols-2">
                      <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2">
                        <input name="is_technical" type="checkbox" className="size-4 accent-primary" />
                        Technical staff (knowledge handover required before exit)
                      </label>
                      <Field
                        name="home_area"
                        label="Home area (town/suburb only)"
                        placeholder="Do not enter a street address"
                        maxLength={80}
                      />
                      <Field
                        name="commute_distance_km"
                        label="One-way commute (km)"
                        type="number"
                        step="any"
                        min="0"
                      />
                    </div>
                  </details>
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
                  <p className="text-sm text-muted-foreground">
                    Record the identifying details so your team can find and track this item. It will be added as available. Assets assigned to employees are checked during exit clearance and must be returned and verified before finalization.
                  </p>
                  <Field name="asset_tag" label="Asset tag or serial number" required placeholder="e.g. ICT-LT-0042" maxLength={80} />
                  <Field name="asset_type" label="Asset type" required placeholder="e.g. Laptop, projector, office furniture" maxLength={120} />
                  <Field name="current_location" label="Current location" placeholder="e.g. Main office · ICT storeroom" maxLength={160} />
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Description <span className="font-normal text-muted-foreground">Optional details such as make, model, or condition</span>
                    <textarea name="description" rows={3} maxLength={1000} placeholder="Add any details that will help identify or manage this asset." className="rounded-lg border border-input bg-background p-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
                  </label>
                </>
              )}
              {mode === "knowledge" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Document title
                        <input
                          name="title"
                          value={selectedRequirement?.name ?? documentTitle}
                          onChange={(event) => setDocumentTitle(event.target.value)}
                          readOnly={Boolean(selectedRequirement)}
                          required
                          maxLength={200}
                          placeholder="Enter a clear title for this general document"
                          className="h-10 rounded-lg border border-input bg-background px-3 font-normal read-only:bg-muted/40"
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                          {selectedRequirement
                            ? "Automatically set from the selected system requirement."
                            : "No system requirement selected. Enter a title for this general document."}
                        </span>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Handover requirement <span className="font-normal text-muted-foreground">Optional for general documents</span>
                    <select
                      name="requirement_id"
                      value={selectedRequirementId}
                      onChange={(event) => {
                        const requirementId = event.target.value;
                        const requirement = knowledgeRequirements.find(
                          (item) => item.id === requirementId,
                        );
                        setSelectedRequirementId(requirementId);
                        setDocumentTitle(requirement?.name ?? "");
                      }}
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      <option value="">General document · no requirement</option>
                      {knowledgeRequirements.map((requirement) => (
                        <option key={requirement.id} value={requirement.id}>
                          {requirement.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Employee record
                    <select
                      name="employee_id"
                      required
                      defaultValue={
                        employees.some(
                          (employee) => employee.id === initialEmployeeId,
                        )
                          ? initialEmployeeId
                          : employees[0]?.id ?? ""
                      }
                      className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
                    >
                      {!employees.length && <option value="">No employee record available</option>}
                      {employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.employee_number} · {employee.full_name}
                        </option>
                      ))}
                    </select>
                  </label>
                  </div>
                  {selectedRequirement && (
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm font-semibold">{selectedRequirement.name}</p>
                      {selectedRequirement.description && (
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{selectedRequirement.description}</p>
                      )}
                    </div>
                  )}
                  <label className="flex flex-col gap-2 text-sm font-medium">
                    Supporting document
                    <input
                      name="file"
                      type="file"
                      required
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                      className="block w-full cursor-pointer rounded-xl border border-border bg-background text-sm file:mr-4 file:cursor-pointer file:border-0 file:bg-muted file:px-4 file:py-3 file:font-semibold file:text-foreground hover:file:bg-muted/70"
                    />
                  </label>
                  <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4">
                    {selectedFile ? <FileText aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" /> : <Upload aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{selectedFile ? selectedFile.name : "Choose a file to upload"}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Ready to upload` : "PDF, Word, Excel, or PowerPoint · Maximum 10 MB"}
                      </p>
                    </div>
                    {selectedFile && <Check aria-hidden="true" className="size-5 shrink-0 text-emerald-600" />}
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Documents are stored privately. Upload the final handover file and use approved institutional storage links for restricted records. Do not include passwords or secret keys.
                  </p>
                </>
              )}
              {open && message && (
                <p role="alert" className="text-sm text-destructive">
                  {message}
                </p>
              )}
              <button
                disabled={pending || (mode === "knowledge" && employees.length === 0)}
                className="sticky bottom-0 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
                {pending ? (mode === "knowledge" ? "Uploading securely…" : "Saving…") : mode === "asset" ? "Add asset to inventory" : mode === "employee" ? "Add employee" : mode === "exit" ? "Create exit request" : "Upload handover document"}
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
  placeholder,
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  step?: string;
  min?: string;
  placeholder?: string;
  maxLength?: number;
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
        placeholder={placeholder}
        maxLength={maxLength}
        className="h-10 rounded-lg border border-input bg-background px-3 font-normal outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}
