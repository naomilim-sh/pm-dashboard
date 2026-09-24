import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl } from "@/lib/googleAuth";

function sanitizeReturnTo(value: string | null): string {
  if (!value) return "/";
  // Only allow same-site relative paths — never a scheme-relative or absolute URL.
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));
  const redirectUri = new URL("/api/google/oauth/callback", request.url).toString();
  const authUrl = buildGoogleAuthUrl(redirectUri, returnTo);

  return NextResponse.redirect(authUrl);
}
