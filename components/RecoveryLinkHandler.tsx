"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Password-recovery emails sent from the Supabase dashboard ("Send password
// recovery") don't use the app's /auth/confirm link. They land on the Site URL
// with the session in the URL fragment (#access_token=...&type=recovery),
// which the server never sees and the PKCE browser client refuses to read.
// Pick those up here, on whatever page they land, and continue to the
// "set a new password" page.
export default function RecoveryLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const isRecovery = params.get("type") === "recovery";
    const linkError = params.get("error_code") || params.get("error");
    if (!isRecovery && !linkError) return;

    // Don't leave tokens sitting in the address bar / history.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);

    if (linkError) {
      router.replace("/login?reset_error=1");
      return;
    }

    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) {
      router.replace("/login?reset_error=1");
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => router.replace(error ? "/login?reset_error=1" : "/reset-password"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
