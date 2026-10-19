import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing point for links in Supabase auth emails (password reset). Handles
// both link styles Supabase can send:
//  - ?token_hash=...&type=recovery  (custom email template; works in any browser)
//  - ?code=...                       (default PKCE link; must be opened in the
//                                     same browser the reset was requested from)
// On success the session cookies are set and we continue to `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";
  // Only ever redirect within this site.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/reset-password";

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: "missing token" };
  }

  if (error) {
    const url = new URL("/login", origin);
    url.searchParams.set("reset_error", "1");
    return NextResponse.redirect(url);
  }
  return NextResponse.redirect(new URL(safeNext, origin));
}
