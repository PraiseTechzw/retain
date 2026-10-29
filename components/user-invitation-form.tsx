"use client";

import { useState, useTransition, type FormEvent } from "react";
import { inviteSystemUser } from "@/lib/supabase/actions";

export function UserInvitationForm() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setMessage("Sending invitation…");
    setFailed(false);

    startTransition(async () => {
      try {
        await inviteSystemUser(formData);
        form.reset();
        setMessage("Invitation sent. The new account will have the Employee role.");
      } catch (error) {
        setFailed(true);
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to send the invitation.",
        );
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border/70 bg-card p-6">
      <h2 className="text-lg font-semibold">Invite a staff account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Invitations are administrator-only. New accounts start with the Employee
        role; assign a different role after the account is created.
      </p>
      <form
        onSubmit={submit}
        className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
      >
        <label className="grid gap-1 text-sm font-medium">
          Full name
          <input
            name="full_name"
            required
            maxLength={120}
            autoComplete="name"
            className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Work email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className="h-10 rounded-lg border border-input bg-background px-3 font-normal"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invitation"}
        </button>
      </form>
      {message && (
        <p
          role={failed ? "alert" : "status"}
          className={`mt-3 text-sm ${failed ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
