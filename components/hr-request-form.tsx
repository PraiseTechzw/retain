"use client";

import { useState, useTransition } from "react";
import { submitHrRequest, updateHrRequest } from "@/lib/supabase/actions";

export function HrRequestForm() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return <form action={(data) => startTransition(async () => { try { await submitHrRequest(data); setMessage("Your request has been sent to HR."); (document.getElementById("hr-request-form") as HTMLFormElement | null)?.reset(); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to submit your request."); } })} id="hr-request-form" className="space-y-4 rounded-2xl border bg-card p-5"><div><h2 className="font-semibold">New HR request</h2><p className="mt-1 text-sm text-muted-foreground">Request an employment letter, profile correction, document, or help from HR.</p></div><label className="flex flex-col gap-1 text-sm font-medium">Request type<select name="request_type" required className="h-10 rounded-lg border px-3 font-normal"><option value="">Select…</option><option value="employment_letter">Employment letter</option><option value="profile_correction">Profile correction</option><option value="document_request">Document request</option><option value="hr_question">Question for HR</option><option value="exit_request">Resignation or exit support</option><option value="other">Other</option></select></label><label className="flex flex-col gap-1 text-sm font-medium">Details<textarea name="details" required maxLength={2000} className="min-h-28 rounded-lg border p-3 font-normal" placeholder="Describe what you need from HR." /></label><button disabled={pending} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">{pending ? "Sending…" : "Submit request"}</button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</form>;
}

export function HrRequestUpdateForm({ id, currentStatus }: { id: string; currentStatus: string }) {
  const [pending, startTransition] = useTransition();
  return <form action={(data) => startTransition(async () => { await updateHrRequest(data); })} className="flex flex-wrap items-end gap-2"><input type="hidden" name="request_id" value={id} /><label className="text-xs font-medium">Status<select name="status" defaultValue={currentStatus} className="ml-1 h-9 rounded-lg border px-2 text-sm"><option value="submitted">Submitted</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="cancelled">Cancelled</option></select></label><input name="resolution" placeholder="HR response or resolution" className="h-9 min-w-56 rounded-lg border px-2 text-sm" /><button disabled={pending} className="h-9 rounded-lg border px-3 text-sm font-medium">Save</button></form>;
}
