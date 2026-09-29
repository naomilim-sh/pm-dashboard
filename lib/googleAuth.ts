import type { SupabaseClient } from "@supabase/supabase-js";

export const GOOGLE_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.metadata.readonly";

export function buildGoogleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to exchange code for tokens (${res.status}): ${body}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  }>;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

/**
 * Returns a live access token for the given user, refreshing it first if
 * expired. Throws a user-facing error if they haven't connected Google yet.
 */
export async function getUserAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: token } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!token) {
    throw new Error("Google account not connected. Connect it below, then try again.");
  }

  if (new Date(token.expiry).getTime() > Date.now() + 30_000) {
    return token.access_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to refresh your Google access — please reconnect your Google account.");
  }

  const body = await res.json();
  const expiry = new Date(Date.now() + body.expires_in * 1000).toISOString();

  await supabase
    .from("google_tokens")
    .update({ access_token: body.access_token, expiry })
    .eq("user_id", userId);

  return body.access_token;
}
