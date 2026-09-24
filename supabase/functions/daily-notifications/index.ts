import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const resendApiKey = Deno.env.get("RESEND_API_KEY");
const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? supabaseUrl;

if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail) {
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, and NOTIFICATION_FROM_EMAIL are required",
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Profile = { id: string; full_name: string | null; role: string | null };

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

async function sendEmail(to: string, recipientName: string, counts: Record<string, number>) {
  const subject = `Retain daily operations digest: ${counts.openExitRequests} open exit request${counts.openExitRequests === 1 ? "" : "s"}`;
  const dashboardUrl = `${appUrl}/dashboard`;
  const lines = [
    `${counts.openExitRequests} open exit request${counts.openExitRequests === 1 ? "" : "s"}`,
    `${counts.pendingClearanceSteps} pending clearance step${counts.pendingClearanceSteps === 1 ? "" : "s"}`,
    `${counts.unverifiedKnowledgeDocuments} unverified knowledge document${counts.unverifiedKnowledgeDocuments === 1 ? "" : "s"}`,
  ];
  const text = `Hello ${recipientName},\n\nYour Retain daily operations digest:\n\n- ${lines.join("\n- ")}\n\nReview the workspace: ${dashboardUrl}`;
  const html = `<p>Hello ${escapeHtml(recipientName)},</p><p>Your Retain daily operations digest:</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p><a href="${escapeHtml(dashboardUrl)}">Review the workspace</a></p>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, text, html }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const [{ data: setting }, { data: profiles, error: profilesError }, { count: openExitRequests }, { count: pendingClearanceSteps }, { count: unverifiedKnowledgeDocuments }] = await Promise.all([
    supabase.from("system_settings").select("value").eq("key", "notification_channel").maybeSingle(),
    supabase.from("profiles").select("id, full_name, role").in("role", ["Administrator", "HR"]),
    supabase.from("exit_requests").select("id", { count: "exact", head: true }).not("status", "in", "(completed,rejected,cancelled)"),
    supabase.from("clearance_steps").select("id", { count: "exact", head: true }).neq("status", "approved"),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).neq("status", "verified"),
  ]);

  if (profilesError) {
    return Response.json({ error: profilesError.message }, { status: 500 });
  }

  if (!["email", "both"].includes(setting?.value ?? "email")) {
    return Response.json({ skipped: true, reason: "email notifications disabled" });
  }

  const counts = {
    openExitRequests: openExitRequests ?? 0,
    pendingClearanceSteps: pendingClearanceSteps ?? 0,
    unverifiedKnowledgeDocuments: unverifiedKnowledgeDocuments ?? 0,
  };

  if (Object.values(counts).every((count) => count === 0)) {
    return Response.json({ sent: 0, reason: "no outstanding work" });
  }

  const digestDate = new Date().toISOString().slice(0, 10);
  let sent = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
    const email = authUser.user?.email;
    if (authError || !email) continue;

    const { data: existing } = await supabase
      .from("notification_delivery_log")
      .select("id")
      .eq("digest_date", digestDate)
      .eq("recipient_email", email)
      .eq("status", "sent")
      .maybeSingle();
    if (existing) continue;

    try {
      await sendEmail(email, profile.full_name ?? email.split("@")[0], counts);
      await supabase.from("notification_delivery_log").upsert({
        digest_date: digestDate,
        recipient_user_id: profile.id,
        recipient_email: email,
        status: "sent",
        sent_at: new Date().toISOString(),
      }, { onConflict: "digest_date,recipient_email" });
      await supabase.from("notifications").insert({
        user_id: profile.id,
        type: "info",
        title: "Daily operations digest",
        message: `${counts.openExitRequests} open exits, ${counts.pendingClearanceSteps} pending clearances, and ${counts.unverifiedKnowledgeDocuments} unverified knowledge documents.`,
      });
      sent += 1;
    } catch (error) {
      console.error(`Unable to send daily digest to ${email}`, error);
      await supabase.from("notification_delivery_log").upsert({
        digest_date: digestDate,
        recipient_user_id: profile.id,
        recipient_email: email,
        status: "failed",
      }, { onConflict: "digest_date,recipient_email" });
    }
  }

  return Response.json({ sent, digestDate, counts });
});