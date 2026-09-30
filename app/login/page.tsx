"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up" | "forgot" | "set_password";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Someone arriving from a password-reset email lands here with a recovery
  // session already established by the browser client — switch to the
  // "choose a new password" form rather than the normal sign-in one.
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("set_password");
        setError(null);
        setInfo("Choose a new password for your account.");
      }
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (mode === "sign_in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } else if (mode === "sign_up") {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(
          error.message.toLowerCase().includes("already registered")
            ? "That email already has an account. Use \"Forgot password?\" below to set a password for it."
            : error.message
        );
      } else {
        setInfo(
          "Account created. If email confirmation is enabled on your Supabase project, check your inbox before signing in."
        );
        setMode("sign_in");
      }
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        setError(error.message);
      } else {
        setInfo("Password reset link sent — check your email, then come back here.");
      }
    } else {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  const heading = {
    sign_in: "Sign in to your projects.",
    sign_up: "Create an account.",
    forgot: "Reset your password.",
    set_password: "Set a new password.",
  }[mode];

  const submitLabel = {
    sign_in: "Sign in",
    sign_up: "Sign up",
    forgot: "Send reset link",
    set_password: "Save password",
  }[mode];

  const showEmail = mode !== "set_password";
  const showPassword = mode !== "forgot";

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">PM Dashboard</h1>
        <p className="mb-6 text-sm text-slate-500">{heading}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showEmail && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>
          )}
          {showPassword && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {mode === "set_password" ? "New password" : "Password"}
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-700">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? "Please wait..." : submitLabel}
          </button>
        </form>

        {mode !== "set_password" && (
          <div className="mt-4 space-y-2 text-center text-sm text-slate-500">
            <button
              type="button"
              onClick={() => {
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
                setError(null);
                setInfo(null);
              }}
              className="w-full hover:text-slate-700"
            >
              {mode === "sign_in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
            {mode !== "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setInfo(null);
                }}
                className="w-full hover:text-slate-700"
              >
                Forgot password?
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
