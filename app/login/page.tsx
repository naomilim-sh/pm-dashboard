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
            ? "That email already has an account. Switch to Sign in and use \"Forgot password?\" to set a password for it."
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

  const theme = {
    sign_in: {
      panel: "bg-navy-950 text-navy-50 border-b-4 border-shopee md:border-b-0 md:border-r-4",
      eyebrow: "text-shopee-400",
      kicker: "Welcome back",
      title: "Your projects missed you.",
      blurb: "Pick up right where you left off — trackers, updates and ETAs are all where you left them.",
      points: [] as string[],
      button: "bg-navy-900 hover:bg-navy-700 focus-visible:outline-navy-900",
      ring: "focus:border-navy-600 focus:ring-navy-600/20",
      formTitle: "Sign in",
      formSub: "Enter your email and password.",
    },
    sign_up: {
      panel: "bg-gradient-to-br from-shopee-400 via-shopee to-shopee-700 text-white",
      eyebrow: "text-shopee-100",
      kicker: "New here?",
      title: "Start tracking in minutes.",
      blurb: "No setup — bring the Google Sheets you already use.",
      points: [
        "Import any Google Sheet tracker",
        "Turn meeting notes into task updates",
        "Share a read-only view with your manager",
      ],
      button: "bg-shopee hover:bg-shopee-600 focus-visible:outline-shopee",
      ring: "focus:border-shopee focus:ring-shopee/20",
      formTitle: "Create your account",
      formSub: "Use your work email — managers find you by it.",
    },
    forgot: {
      panel: "bg-shopee-50 text-navy-900",
      eyebrow: "text-shopee-600",
      kicker: "Locked out?",
      title: "It happens to everyone.",
      blurb: "We'll email you a link to choose a new password.",
      points: [] as string[],
      button: "bg-shopee-600 hover:bg-shopee-700 focus-visible:outline-shopee-600",
      ring: "focus:border-shopee focus:ring-shopee/20",
      formTitle: "Reset your password",
      formSub: "Enter the email you signed up with.",
    },
    set_password: {
      panel: "bg-navy-800 text-navy-50",
      eyebrow: "text-shopee-300",
      kicker: "Almost there",
      title: "Pick a new password.",
      blurb: "Once it's saved you'll go straight to your dashboard.",
      points: [] as string[],
      button: "bg-navy-800 hover:bg-navy-700 focus-visible:outline-navy-800",
      ring: "focus:border-navy-600 focus:ring-navy-600/20",
      formTitle: "Set a new password",
      formSub: "At least 6 characters.",
    },
  }[mode];

  const submitLabel = {
    sign_in: "Sign in",
    sign_up: "Create account",
    forgot: "Send reset link",
    set_password: "Save password",
  }[mode];

  const showEmail = mode !== "set_password";
  const showPassword = mode !== "forgot";

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
  }

  const inputClass = `w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-4 ${theme.ring}`;

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl md:grid-cols-[1.1fr_1fr]">
        <div className={`flex flex-col justify-between gap-8 p-8 transition-colors duration-300 md:p-10 ${theme.panel}`}>
          <p className="text-sm font-black tracking-tight">
            PM<span className={mode === "sign_up" ? "text-navy-900" : "text-shopee"}>/</span>Dashboard
          </p>
          <div>
            <p className={`mb-2 text-xs font-bold uppercase tracking-widest ${theme.eyebrow}`}>
              {theme.kicker}
            </p>
            <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{theme.title}</h1>
            <p className="mt-3 text-sm opacity-85">{theme.blurb}</p>
            {theme.points.length > 0 && (
              <ol className="mt-6 space-y-3">
                {theme.points.map((pt, i) => (
                  <li key={pt} className="flex items-center gap-3 text-sm font-semibold">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/25 text-xs font-black">
                      {i + 1}
                    </span>
                    {pt}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="p-8 md:p-10">
          {(mode === "sign_in" || mode === "sign_up") && (
            <div className="mb-6 grid grid-cols-2 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
              <button
                type="button"
                onClick={() => switchMode("sign_in")}
                className={`rounded-md py-1.5 transition ${
                  mode === "sign_in" ? "bg-navy-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("sign_up")}
                className={`rounded-md py-1.5 transition ${
                  mode === "sign_up" ? "bg-shopee text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Create account
              </button>
            </div>
          )}

          <h2 className="text-xl font-bold text-slate-900">{theme.formTitle}</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">{theme.formSub}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {showEmail && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {mode === "sign_up" ? "Work email" : "Email"}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
            )}
            {showPassword && (
              <div>
                <div className="mb-1 flex items-baseline justify-between">
                  <label className="block text-sm font-medium text-slate-700">
                    {mode === "set_password"
                      ? "New password"
                      : mode === "sign_up"
                        ? "Choose a password"
                        : "Password"}
                  </label>
                  {mode === "sign_in" && (
                    <button
                      type="button"
                      onClick={() => switchMode("forgot")}
                      className="text-xs font-semibold text-shopee hover:text-shopee-700"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                {mode === "sign_up" && (
                  <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
                )}
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {info && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-lg px-3 py-2.5 text-sm font-bold text-white transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${theme.button}`}
            >
              {loading ? "Please wait..." : submitLabel}
            </button>
          </form>

          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => switchMode("sign_in")}
              className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              ← Back to sign in
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
