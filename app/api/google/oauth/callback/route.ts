import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, fetchGoogleUserEmail } from "@/lib/googleAuth";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("state"));
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const redirectWithError = (message: string) => {
    const url = new URL(returnTo, request.url);
    url.searchParams.set("google_error", message);
    return NextResponse.redirect(url);
  };

  if (error) {
    return redirectWithError(error === "access_denied" ? "Google connection was cancelled." : error);
  }
  if (!code) {
    return redirectWithError("Missing authorization code from Google.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const redirectUri = new URL("/api/google/oauth/callback", request.url).toString();

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, redirectUri);
  } catch (e) {
    return redirectWithError(e instanceof Error ? e.message : "Failed to connect Google account.");
  }

  if (!tokens.refresh_token) {
    // Happens if the user previously connected and Google skips the consent
    // screen (no new refresh token issued) — ask them to fully reconnect.
    return redirectWithError(
      "Google didn't return a refresh token — disconnect and try connecting again."
    );
  }

  const email = await fetchGoogleUserEmail(tokens.access_token);
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const { error: upsertError } = await supabase.from("google_tokens").upsert({
    user_id: user.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry,
    scope: tokens.scope,
    connected_email: email,
    connected_at: new Date().toISOString(),
  });

  if (upsertError) {
    return redirectWithError(upsertError.message);
  }

  return NextResponse.redirect(new URL(returnTo, request.url));
}
