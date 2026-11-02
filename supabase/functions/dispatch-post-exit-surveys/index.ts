import { createClient } from "npm:@supabase/supabase-js@2";

type DueInvitation = {
  id: string;
  exit_case_id: string;
  wave: number;
  attempts: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const cronSecret = Deno.env.get("POST_EXIT_SURVEY_CRON_SECRET");
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("NOTIFICATION_FROM_EMAIL");
  const appUrl = Deno.env.get("NEXT_PUBLIC_APP_URL")?.replace(/\/+$/, "");
  if (!supabaseUrl || !serviceRoleKey || !resendApiKey || !fromEmail || !appUrl) {
    console.error("Survey dispatch is missing a required server secret.");
    return jsonResponse({ error: "Survey dispatch is not configured." }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = new Date().toISOString().slice(0, 10);
  const { error: expiryError } = await supabase
    .from("post_exit_survey_invitations")
    .update({ status: "expired", token_hash: null })
    .in("status", ["scheduled", "failed"])
    .lt("expires_on", today);
  if (expiryError) {
    console.error("Unable to expire old survey invitations.", expiryError.message);
    return jsonResponse({ error: "Unable to update expired invitations." }, 500);
  }

  const { data: invitations, error: inviteError } = await supabase
    .from("post_exit_survey_invitations")
    .select("id, exit_case_id, wave, attempts")
    .in("status", ["scheduled", "failed"])
    .lte("due_on", today)
    .gte("expires_on", today)
    .order("due_on")
    .limit(100);

  if (inviteError) {
    console.error("Unable to load due survey invitations.", inviteError.message);
    return jsonResponse({ error: "Unable to load due invitations." }, 500);
  }

  let sent = 0;
  let failed = 0;
  for (const invitation of (invitations ?? []) as DueInvitation[]) {
    const { data: exitCase, error: exitError } = await supabase
      .from("exit_cases")
      .select("employees(full_name, email)")
      .eq("id", invitation.exit_case_id)
      .maybeSingle();
    const employee = Array.isArray(exitCase?.employees)
      ? exitCase.employees[0]
      : exitCase?.employees;
    const recipient = typeof employee?.email === "string" ? employee.email : "";
    if (exitError || !recipient) {
      failed += 1;
      console.error("A due survey has no deliverable employee email.", {
        invitationId: invitation.id,
        error: exitError?.message,
      });
      const { error: updateError } = await supabase
        .from("post_exit_survey_invitations")
        .update({
          status: "failed",
          attempts: invitation.attempts + 1,
          last_error: "No deliverable employee email was found.",
        })
        .eq("id", invitation.id);
      if (updateError) {
        console.error("Unable to mark the undeliverable survey.", updateError.message);
      }
      continue;
    }

    const token = createToken();
    const tokenHash = await hashToken(token);
    const { data: claim, error: claimError } = await supabase
      .from("post_exit_survey_invitations")
      .update({
        status: "sent",
        token_hash: tokenHash,
        sent_at: new Date().toISOString(),
        attempts: invitation.attempts + 1,
        last_error: null,
      })
      .eq("id", invitation.id)
      .in("status", ["scheduled", "failed"])
      .select("id")
      .maybeSingle();
    if (claimError) {
      failed += 1;
      console.error("Unable to prepare a survey invitation.", {
        invitationId: invitation.id,
        error: claimError.message,
      });
      continue;
    }
    if (!claim) continue;

    const surveyUrl = `${appUrl}/survey/${token}`;
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: `CUT staff departure follow-up (${invitation.wave} months)`,
        text: [
          `Dear ${typeof employee?.full_name === "string" ? employee.full_name : "former colleague"},`,
          "",
          "The Human Resources Office invites you to share brief feedback about your departure from Chinhoyi University of Technology.",
          "Your responses are confidential and will be available to authorised HR staff. This survey is not anonymous.",
          "",
          `Complete the survey: ${surveyUrl}`,
          "",
          "This link expires 30 days after the invitation date and can only be used once.",
        ].join("\n"),
      }),
    });

    if (!emailResponse.ok) {
      failed += 1;
      const errorText = await emailResponse.text();
      console.error("Survey invitation email failed.", {
        invitationId: invitation.id,
        status: emailResponse.status,
        response: errorText.slice(0, 500),
      });
      const { error: updateError } = await supabase
        .from("post_exit_survey_invitations")
        .update({
          status: "failed",
          token_hash: null,
          last_error: `Email provider returned HTTP ${emailResponse.status}.`,
        })
        .eq("id", invitation.id);
      if (updateError) {
        console.error("Unable to mark the failed survey invitation.", updateError.message);
      }
      continue;
    }

    sent += 1;
  }

  const { data: dueGuides, error: guideError } = await supabase
    .from("handover_guides")
    .select("id, title, version, employee:employees(full_name, email)")
    .lte("review_due_on", today)
    .is("reminder_sent_at", null)
    .limit(100);
  if (guideError) {
    console.error("Unable to load due handover-guide reminders.", guideError.message);
    return jsonResponse({ error: "Survey dispatch finished; guide reminders could not be loaded." }, 500);
  }

  let reminders = 0;
  for (const guide of dueGuides ?? []) {
    const employee = Array.isArray(guide.employee)
      ? guide.employee[0]
      : guide.employee;
    const recipient = typeof employee?.email === "string" ? employee.email : "";
    if (!recipient) continue;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipient],
        subject: "Please review your CUT work handover guide",
        text: [
          `Dear ${typeof employee?.full_name === "string" ? employee.full_name : "colleague"},`,
          "",
          `Your handover guide “${guide.title}” (version ${guide.version}) is due for review.`,
          "Sign in to CUT Retain to upload a current version.",
        ].join("\n"),
      }),
    });
    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Handover guide reminder email failed.", {
        guideId: guide.id,
        status: emailResponse.status,
        response: errorText.slice(0, 500),
      });
      continue;
    }

    const { error: reminderUpdateError } = await supabase
      .from("handover_guides")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", guide.id)
      .is("reminder_sent_at", null);
    if (reminderUpdateError) {
      console.error("Unable to record a sent handover reminder.", reminderUpdateError.message);
    } else {
      reminders += 1;
    }
  }

  return jsonResponse({ sent, failed, reminders });
});
