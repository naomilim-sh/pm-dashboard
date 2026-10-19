"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setHasSession(Boolean(data.user)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-navy-600 focus:outline-none focus:ring-4 focus:ring-navy-600/20";

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b-4 border-shopee bg-navy-950 px-8 py-6 text-navy-50">
          <p className="text-sm font-black tracking-tight">
            PM<span className="text-shopee">/</span>Dashboard
          </p>
          <p className="mt-5 text-xs font-bold uppercase tracking-widest text-shopee-400">Almost there</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">Set a new password.</h1>
        </div>

        <div className="p-8">
          {hasSession === null ? (
            <p className="text-sm text-slate-500">Checking your reset link…</p>
          ) : !hasSession ? (
            <div className="space-y-3 text-sm">
              <p className="font-semibold text-navy-900">This reset link has expired or was already used.</p>
              <p className="text-slate-600">
                Reset links work once and only for a short time. Request a new one and open it in this
                same browser.
              </p>
              <Link
                href="/login?forgot=1"
                className="inline-block rounded-lg bg-navy-900 px-4 py-2 font-bold text-white hover:bg-navy-700"
              >
                Send a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">New password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
                <p className="mt-1 text-xs text-slate-400">At least 6 characters.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Confirm new password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg bg-navy-900 px-3 py-2.5 text-sm font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save password and continue"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
