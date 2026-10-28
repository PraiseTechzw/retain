import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function validSecret(header: string | null, expected: string) {
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ASSET_TRACKING_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "Asset tracking integration is not configured." }, { status: 503 });
  }
  if (!validSecret(request.headers.get("authorization"), expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON request body." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid tracking event." }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const assetTag = typeof body.asset_tag === "string" ? body.asset_tag.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const externalEventId = typeof body.event_id === "string" ? body.event_id.trim() : null;
  const recordedAt = typeof body.recorded_at === "string" ? new Date(body.recorded_at) : new Date();
  if (!assetTag || assetTag.length > 80 || !location || location.length > 180) {
    return NextResponse.json({ error: "asset_tag and location are required and must fit the configured limits." }, { status: 400 });
  }
  if (externalEventId && externalEventId.length > 180) {
    return NextResponse.json({ error: "event_id must be 180 characters or fewer." }, { status: 400 });
  }
  if (Number.isNaN(recordedAt.getTime()) || recordedAt.getTime() > Date.now() + 5 * 60_000) {
    return NextResponse.json({ error: "recorded_at must be a valid timestamp no more than five minutes in the future." }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .select("id")
      .eq("asset_tag", assetTag)
      .maybeSingle();
    if (assetError) {
      console.error("Asset tracking lookup failed", { code: assetError.code });
      return NextResponse.json({ error: "Unable to look up the asset." }, { status: 500 });
    }
    if (!asset) return NextResponse.json({ error: "Unknown asset_tag." }, { status: 404 });

    const { error } = await supabase.from("asset_tracking_events").insert({
      asset_id: asset.id,
      source: "gps_mdm",
      location,
      recorded_at: recordedAt.toISOString(),
      external_event_id: externalEventId,
    });
    if (error?.code === "23505") {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
    }
    if (error) {
      console.error("Asset tracking webhook insert failed", { code: error.code });
      return NextResponse.json({ error: "Unable to record the tracking event." }, { status: 500 });
    }
    return NextResponse.json({ received: true }, { status: 202 });
  } catch (error) {
    console.error("Asset tracking webhook unavailable", error);
    return NextResponse.json({ error: "Asset tracking integration is unavailable." }, { status: 503 });
  }
}
