"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardViewer } from "@/lib/types";

type ViewableOwner = { owner_user_id: string; owner_email: string };

export default function DashboardSharing({
  readOnly,
  viewedOwnerEmail,
  viewableOwners,
  myViewers,
}: {
  readOnly: boolean;
  viewedOwnerEmail: string | null;
  viewableOwners: ViewableOwner[];
  myViewers: Pick<DashboardViewer, "id" | "invited_email" | "viewer_user_id" | "created_at">[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewers, setViewers] = useState(myViewers);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value || inviting) return;
    setInviting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setError("Not signed in.");
      setInviting(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("dashboard_viewers")
      .insert({ owner_user_id: user.id, owner_email: user.email, invited_email: value })
      .select()
      .single();

    if (insertError) {
      setError(
        insertError.message.includes("duplicate") ? "Already invited." : insertError.message
      );
    } else if (data) {
      setViewers((prev) => [...prev, data]);
      setEmail("");
    }
    setInviting(false);
  }

  async function handleRevoke(id: string) {
    const { error: deleteError } = await supabase.from("dashboard_viewers").delete().eq("id", id);
    if (!deleteError) {
      setViewers((prev) => prev.filter((v) => v.id !== id));
    }
  }

  return (
    <div className="mb-6 space-y-3">
      {(readOnly || viewableOwners.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Viewing:</span>
          <button
            type="button"
            onClick={() => router.push("/")}
            className={`rounded-full px-3 py-1 ${
              !readOnly
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-100"
            }`}
          >
            My dashboard
          </button>
          {viewableOwners.map((o) => (
            <button
              key={o.owner_user_id}
              type="button"
              onClick={() => router.push(`/?view=${o.owner_user_id}`)}
              className={`rounded-full px-3 py-1 ${
                readOnly && viewedOwnerEmail === o.owner_email
                  ? "bg-slate-900 text-white"
                  : "border border-slate-300 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {o.owner_email}
            </button>
          ))}
        </div>
      )}

      {readOnly && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Viewing {viewedOwnerEmail}&apos;s dashboard — read-only.
        </p>
      )}

      {!readOnly && (
        <details className="rounded-md border border-slate-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">
            Manager access {viewers.length > 0 && `(${viewers.length})`}
          </summary>
          <div className="mt-3 space-y-2">
            {viewers.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-1.5"
              >
                <span className="text-slate-600">
                  {v.invited_email}{" "}
                  <span className="text-xs text-slate-400">
                    {v.viewer_user_id ? "(active)" : "(pending — hasn't logged in yet)"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRevoke(v.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  Revoke
                </button>
              </div>
            ))}

            <form onSubmit={handleInvite} className="flex items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@company.com"
                className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={inviting || !email.trim()}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
              >
                {inviting ? "Inviting..." : "Invite"}
              </button>
            </form>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-slate-400">
              They&apos;ll see your whole dashboard read-only once they sign up or log in with
              this email.
            </p>
          </div>
        </details>
      )}
    </div>
  );
}
