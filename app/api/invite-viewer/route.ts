import { NextResponse } from "next/server";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { email } = await request.json();
  if (!email) {
    return NextResponse.json({ error: "Missing email." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: viewer, error: insertError } = await supabase
    .from("dashboard_viewers")
    .insert({ owner_user_id: user.id, owner_email: user.email, invited_email: email })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: insertError.message.includes("duplicate") ? "Already invited." : insertError.message },
      { status: 400 }
    );
  }

  // Sent from a plain, session-isolated client (implicit flow, no PKCE) so it
  // never touches the inviting owner's own auth cookies — and so the link
  // works when clicked in a completely different browser than this request,
  // which a PKCE-flow magic link (tied to this server, not a real browser)
  // could never do.
  const anon = createPlainClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
  const origin = new URL(request.url).origin;
  const { error: otpError } = await anon.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: origin },
  });

  return NextResponse.json({
    viewer,
    emailSent: !otpError,
    emailError: otpError?.message ?? null,
  });
}
