"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import {
  assignAsset,
  recordAssetDailyLog,
  receiveAssetReturn,
  recordAssetTrackingEvent,
  releaseVerifiedAsset,
  verifyAsset,
} from "@/lib/supabase/actions";

type ActionKind = "assign" | "log" | "track" | "receive" | "verify" | "release";

const actionByKind = {
  assign: assignAsset,
  log: recordAssetDailyLog,
  track: recordAssetTrackingEvent,
  receive: receiveAssetReturn,
  verify: verifyAsset,
  release: releaseVerifiedAsset,
} satisfies Record<ActionKind, (formData: FormData) => Promise<void | { ok: true } | { ok: false; message: string }>>;

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
        const result = await actionByKind[kind](formData);
        if (result && !result.ok) {
          setFailed(true);
          setFeedback(result.message);
          return;
        }
        setFeedback(result && result.ok ? (result.message ?? successMessage) : successMessage);
        if (kind === "log" || kind === "track") form.reset();
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

export type AssetActivityOption = {
  id: string;
  asset_tag: string;
  asset_type: string;
  assigned: boolean;
};

export function AssetActivityFields({
  assets,
  canUpdateAssetState,
}: {
  assets: AssetActivityOption[];
  canUpdateAssetState: boolean;
}) {
  const [eventType, setEventType] = useState("daily_check");
  const [assetId, setAssetId] = useState(assets.find((asset) => asset.assigned)?.id ?? "");
  const selectableAssets = eventType === "daily_check" ? assets.filter((asset) => asset.assigned) : assets;

  return (
    <>
      <label className="text-sm font-medium">
        Asset
        <select
          name="asset_id"
          required
          value={assetId}
          onChange={(event) => setAssetId(event.target.value)}
          className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
        >
          <option value="">{eventType === "daily_check" && !selectableAssets.length ? "No assigned assets available" : "Choose asset"}</option>
          {selectableAssets.map((asset) => (
            <option key={asset.id} value={asset.id}>{asset.asset_tag} · {asset.asset_type}</option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        Event
        <select
          name="event_type"
          required
          value={eventType}
          onChange={(event) => {
            const nextEventType = event.target.value;
            const nextAssets = nextEventType === "daily_check" ? assets.filter((asset) => asset.assigned) : assets;
            setEventType(nextEventType);
            if (!nextAssets.some((asset) => asset.id === assetId)) setAssetId(nextAssets[0]?.id ?? "");
          }}
          className="mt-1.5 h-10 w-full rounded-lg border border-input bg-background px-3 font-normal"
        >
          <option value="daily_check">Daily check</option>
          <option value="maintenance">Maintenance</option>
          {canUpdateAssetState && <option value="movement">Movement</option>}
          {canUpdateAssetState && <option value="issue">Report damage</option>}
        </select>
      </label>
    </>
  );
}
