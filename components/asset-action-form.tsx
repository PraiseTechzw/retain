"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  assignAsset,
  recordAssetDailyLog,
  receiveAssetReturn,
  releaseVerifiedAsset,
  verifyAsset,
} from "@/lib/supabase/actions";

type ActionKind = "assign" | "log" | "receive" | "verify" | "release";

const actionByKind = {
  assign: assignAsset,
  log: recordAssetDailyLog,
  receive: receiveAssetReturn,
  verify: verifyAsset,
  release: releaseVerifiedAsset,
} satisfies Record<ActionKind, (formData: FormData) => Promise<void>>;

export function AssetActionForm({
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
  const [feedback, setFeedback] = useState("");
  const [failed, setFailed] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setFeedback("Saving…");
    setFailed(false);
    startTransition(async () => {
      try {
        await actionByKind[kind](formData);
        setFeedback(successMessage);
        if (kind === "log") form.reset();
      } catch (error) {
        setFailed(true);
        setFeedback(
          error instanceof Error
            ? error.message
            : "We couldn’t save this asset update. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={submit} className={className}>
      <fieldset disabled={pending} className="contents disabled:opacity-60">
        {children}
      </fieldset>
      {feedback && (
        <p role={failed ? "alert" : "status"} className={`text-sm ${failed ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"}`}>
          {feedback}
        </p>
      )}
    </form>
  );
}
