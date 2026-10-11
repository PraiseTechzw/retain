"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateEmployeeRecord } from "@/lib/supabase/actions";

type EmployeeRecord = {
  id: string;
  employee_number: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  employment_category: string | null;
  joined_on: string | null;
  department_id: string | null;
};

type DepartmentOption = { id: string; name: string };

const inputClassName =
  "mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal";
const categories = [
  { value: "academic", label: "Academic" },
  { value: "academic_attaché", label: "Academic Attaché" },
  { value: "support", label: "Support Staff" },
];

export function EmployeeRecordForm({
  employee,
  departments,
}: {
  employee: EmployeeRecord;
  departments: DepartmentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await updateEmployeeRecord(formData);
        setMessage("Employee record updated.");
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Unable to update employee record.",
        );
      }
    });
  }

  const currentCategory = employee.employment_category ?? "support";
  const hasKnownCategory = categories.some(
    (category) => category.value === currentCategory,
  );

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <h2 className="text-lg font-semibold">Employment record</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        HR and administrators may maintain identity, department, category, and start-date details. Employment exit status is controlled by the digital clearance workflow.
      </p>
      <form action={submit} className="mt-4 grid gap-3 md:grid-cols-2">
        <input type="hidden" name="employee_id" value={employee.id} />
        <label className="text-sm font-medium">
          Employee number
          <input
            name="employee_number"
            required
            defaultValue={employee.employee_number}
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium">
          Full name
          <input
            name="full_name"
            required
            defaultValue={employee.full_name}
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            defaultValue={employee.email ?? ""}
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium">
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={employee.phone ?? ""}
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium">
          Job title
          <input
            name="job_title"
            defaultValue={employee.job_title ?? ""}
            className={inputClassName}
          />
        </label>
        <label className="text-sm font-medium">
          Employment category
          <select
            name="employment_category"
            defaultValue={currentCategory}
            required
            className={inputClassName}
          >
            {!hasKnownCategory && (
              <option value={currentCategory}>{currentCategory} (current)</option>
            )}
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Department
          <select
            name="department_id"
            defaultValue={employee.department_id ?? ""}
            className={inputClassName}
          >
            <option value="">Unassigned</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Start date
          <input
            name="joined_on"
            type="date"
            defaultValue={employee.joined_on?.slice(0, 10) ?? ""}
            className={inputClassName}
          />
        </label>
        <div className="flex items-end gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save employment record"}
          </button>
          {message && (
            <p role="status" className="text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </div>
      </form>
    </section>
  );
}
