"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  activateUserAccount,
  disableUserAccount,
  updateUserRole,
} from "@/lib/supabase/actions";

type ActionKind = "role" | "activate" | "disable";
const actionByKind = {
  role: updateUserRole,
  activate: activateUserAccount,
  disable: disableUserAccount,
} satisfies Record<ActionKind, (formData: FormData) => Promise<void>>;

export function UserManagementActionForm({
  kind,
  children,
  className,
  successMessage,
}: {
  kind: ActionKind;
  children: ReactNode;
  className?: string;
  successMessage: string;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setMessage("Saving…");
    setFailed(false);
    startTransition(async () => {
      try {
        await actionByKind[kind](formData);
        setMessage(successMessage);
      } catch (error) {
        const rawMessage = error instanceof Error ? error.message : "";
        setFailed(true);
        setMessage(
          /SUPABASE_SERVICE_ROLE_KEY|Server Components render|Minified React error|digest/i.test(rawMessage)
            ? "Account administration is unavailable in this deployment. Ask your system administrator to configure the server-only Supabase service key."
            : rawMessage || "We couldn’t save this account change. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className={className}>
      <fieldset disabled={pending} className="contents disabled:opacity-60">
        {children}
      </fieldset>
      {message && (
        <p role={failed ? "alert" : "status"} className={`mt-1 text-xs ${failed ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}>
          {message}
        </p>
      )}
    </form>
  );
}
