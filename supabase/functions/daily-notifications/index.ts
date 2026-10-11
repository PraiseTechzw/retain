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
type MissingDailyCheckAsset = {
  asset_tag: string;
  asset_type: string;
  current_location: string | null;
};

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

async function sendEmail(
  to: string,
  recipientName: string,
  counts: Record<string, number>,
  missingAssets: MissingDailyCheckAsset[],
) {
  const subject = counts.assetsMissingDailyCheck
    ? `Retain daily asset check reminder: ${counts.assetsMissingDailyCheck} assigned asset${counts.assetsMissingDailyCheck === 1 ? "" : "s"} unchecked`
    : `Retain daily operations digest: ${counts.openExitRequests} open exit request${counts.openExitRequests === 1 ? "" : "s"}`;
  const dashboardUrl = `${appUrl}${counts.assetsMissingDailyCheck ? "/dashboard/assets/activity" : "/dashboard"}`;
  const lines = [
    `${counts.openExitRequests} open exit request${counts.openExitRequests === 1 ? "" : "s"}`,
    `${counts.pendingClearanceSteps} pending clearance step${counts.pendingClearanceSteps === 1 ? "" : "s"}`,
    `${counts.unverifiedKnowledgeDocuments} unverified knowledge document${counts.unverifiedKnowledgeDocuments === 1 ? "" : "s"}`,
    `${counts.assetsMissingDailyCheck} assigned asset${counts.assetsMissingDailyCheck === 1 ? "" : "s"} without today's daily check`,
  ];
  const assetLines = missingAssets.slice(0, 20).map(
    (asset) => `${asset.asset_tag} (${asset.asset_type})`,
  );
  if (assetLines.length) {
    lines.push("Assets to check:", ...assetLines);
  }
  if (missingAssets.length > assetLines.length) {
    lines.push(`...and ${missingAssets.length - assetLines.length} more`);
  }
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

async function queryMissingDailyCheckAssets(checkDate: string) {
  const pageSize = 1000;
  const assignedAssets: Array<{
    id: string;
    asset_tag: string;
    asset_type: string;
    current_location: string | null;
  }> = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data: page, error: assetsError } = await supabase
      .from("assets")
      .select("id, asset_tag, asset_type, current_location")
      .eq("status", "assigned")
      .not("assigned_to", "is", null)
      .order("asset_tag")
      .range(offset, offset + pageSize - 1);
    if (assetsError) throw new Error(assetsError.message);
    assignedAssets.push(...(page ?? []));
    if ((page?.length ?? 0) < pageSize) break;
  }

  const checkedAssetIds = new Set<string>();
  for (let offset = 0; ; offset += pageSize) {
    const { data: page, error: logsError } = await supabase
      .from("asset_daily_logs")
      .select("asset_id")
      .eq("event_type", "daily_check")
      .eq("logged_on", checkDate)
      .order("asset_id")
      .range(offset, offset + pageSize - 1);
    if (logsError) throw new Error(logsError.message);
    for (const row of page ?? []) checkedAssetIds.add(row.asset_id);
    if ((page?.length ?? 0) < pageSize) break;
  }

  return assignedAssets
    .filter((asset) => !checkedAssetIds.has(asset.id))
    .map(({ asset_tag, asset_type, current_location }) => ({
      asset_tag,
      asset_type,
      current_location,
    }));
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const digestDate = new Date().toISOString().slice(0, 10);
  const [{ data: setting }, { data: profiles, error: profilesError }, { count: openExitRequests }, { count: pendingClearanceSteps }, { count: unverifiedKnowledgeDocuments }, { data: missingAssets, error: missingAssetsError }] = await Promise.all([
    supabase.from("system_settings").select("value").eq("key", "notification_channel").maybeSingle(),
    supabase.from("profiles").select("id, full_name, role").eq("active", true).in("role", ["Administrator", "HR", "Management", "ICT", "Library"]),
    supabase.from("exit_requests").select("id", { count: "exact", head: true }).not("status", "in", "(completed,rejected,cancelled)"),
    supabase.from("clearance_steps").select("id", { count: "exact", head: true }).neq("status", "approved"),
    supabase.from("knowledge_documents").select("id", { count: "exact", head: true }).neq("status", "verified"),
    supabase.rpc("get_assets_missing_daily_checks", { p_check_date: digestDate }),
  ]);

  let assetsAwaitingCheck = (missingAssets as MissingDailyCheckAsset[] | null) ?? [];
  if (missingAssetsError) {
    if (missingAssetsError.code !== "PGRST202" && missingAssetsError.code !== "42883") {
      return Response.json({ error: missingAssetsError.message }, { status: 500 });
    }
    try {
      assetsAwaitingCheck = await queryMissingDailyCheckAssets(digestDate);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Asset reminder query failed";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  if (profilesError) {
    return Response.json(
      { error: profilesError.message },
      { status: 500 },
    );
  }

  const channel = setting?.value ?? "email";
  if (!["email", "in_app", "both"].includes(channel)) {
    return Response.json({ error: "Invalid notification channel configuration" }, { status: 500 });
  }
  const emailEnabled = channel === "email" || channel === "both";
  const inAppEnabled = channel === "in_app" || channel === "both";

  const counts = {
    openExitRequests: openExitRequests ?? 0,
    pendingClearanceSteps: pendingClearanceSteps ?? 0,
    unverifiedKnowledgeDocuments: unverifiedKnowledgeDocuments ?? 0,
    assetsMissingDailyCheck: assetsAwaitingCheck.length,
  };

  if (Object.values(counts).every((count) => count === 0)) {
    return Response.json({ sent: 0, reason: "no outstanding work" });
  }

  let sent = 0;

  for (const profile of (profiles ?? []) as Profile[]) {
    let delivered = false;
    let email: string | null = null;

    if (emailEnabled) {
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(profile.id);
      email = authUser.user?.email ?? null;
      if (authError || !email) {
        console.error("Unable to resolve a recipient for the daily email digest");
      } else {
        const { data: existing } = await supabase
          .from("notification_delivery_log")
          .select("id")
          .eq("digest_date", digestDate)
          .eq("recipient_email", email)
          .eq("status", "sent")
          .maybeSingle();

        if (!existing) {
          try {
            await sendEmail(
              email,
              profile.full_name ?? email.split("@")[0],
              counts,
              assetsAwaitingCheck,
            );
            await supabase.from("notification_delivery_log").upsert({
              digest_date: digestDate,
              recipient_user_id: profile.id,
              recipient_email: email,
              status: "sent",
              sent_at: new Date().toISOString(),
            }, { onConflict: "digest_date,recipient_email" });
            delivered = true;
          } catch (error) {
            console.error("Unable to send daily email digest", error);
            await supabase.from("notification_delivery_log").upsert({
              digest_date: digestDate,
              recipient_user_id: profile.id,
              recipient_email: email,
              status: "failed",
            }, { onConflict: "digest_date,recipient_email" });
          }
        }
      }
    }

    if (inAppEnabled) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: profile.id,
        type: "info",
        title: counts.assetsMissingDailyCheck
          ? "Assigned asset checks are due"
          : "Daily operations digest",
        message: `${counts.openExitRequests} open exits, ${counts.pendingClearanceSteps} pending clearances, ${counts.unverifiedKnowledgeDocuments} unverified knowledge documents, and ${counts.assetsMissingDailyCheck} assigned assets without today's daily check.`,
        entity_type: "daily_digest",
        entity_id: digestDate,
      });

      if (!notificationError || notificationError.code === "23505") {
        delivered = true;
      } else {
        console.error("Unable to create in-app daily digest", notificationError);
      }
    }

    if (delivered) sent += 1;
  }

  return Response.json({ sent, digestDate, counts, channel });
});
