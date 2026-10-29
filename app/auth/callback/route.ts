import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const authError = searchParams.get("error_description");
  const loginUrl = new URL("/auth/login", origin);

  if (!code || authError) {
    loginUrl.searchParams.set(
      "message",
      authError
        ? "The invitation or sign-in link could not be accepted. Ask an administrator for a new invitation."
        : "The authentication link is incomplete. Please request a new one.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Authentication callback failed", { code: error.code });
    loginUrl.searchParams.set(
      "message",
      "The authentication link has expired or could not be verified. Request a new link.",
    );
    return NextResponse.redirect(loginUrl);
  }

  const nextPath = searchParams.get("next") ?? "/dashboard";
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }

  const destination = new URL(nextPath, origin);
  if (destination.origin !== origin) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }
  return NextResponse.redirect(destination);
}
