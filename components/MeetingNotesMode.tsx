"use client";

import { useState } from "react";
import { MeetingFollowup } from "@/lib/types";

// Smart Notes in "Meeting follow-ups" mode: paste what came up in a catch-up,
// get it back as short editable lines, save them as this project's follow-up
// list (replacing the previous meeting's).
export default function MeetingNotesMode({
  projectId,
  existingCount,
  onSave,
}: {
  projectId: string;
  existingCount: number;
  onSave: (followups: MeetingFollowup[]) => Promise<boolean>;
}) {
  const [notes, setNotes] = useState("");
  const [tidying, setTidying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<MeetingFollowup[] | null>(null);

  async function handleTidy() {
    if (!notes.trim()) return;
    setTidying(true);
    setError(null);
    try {
      const res = await fetch("/api/meeting-followups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, notes }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't tidy those notes.");
      } else {
        setDraft((body.followups as string[]).map((text) => ({ id: crypto.randomUUID(), text })));
      }
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setTidying(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    const cleaned = draft.map((f) => ({ ...f, text: f.text.trim() })).filter((f) => f.text);
    setSaving(true);
    const ok = await onSave(cleaned);
    setSaving(false);
    if (ok) {
      setDraft(null);
      setNotes("");
    }
  }

  return (
    <div>
      <p className="mb-2 text-xs text-slate-500">
        Paste what you need to clarify or chase from today&apos;s catch-up. It&apos;s tidied into short
        notes for the <span className="font-semibold text-slate-700">Meeting follow-ups</span> list —
        the README and tracker aren&apos;t touched.
      </p>

      {!draft && (
        <>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={6}
            placeholder={"e.g.\n- check w YC if old data migration is fully dropped\n- who owns the CDN cost report after oct??\n- Haogang mentioned a new BU wants in — get name"}
            className="w-full rounded-xl border border-slate-300 p-3 text-sm placeholder:text-slate-400 focus:border-shopee focus:outline-none"
          />
          <button
            type="button"
            onClick={handleTidy}
            disabled={!notes.trim() || tidying}
            className="mt-2 rounded-lg bg-shopee px-3 py-1.5 text-sm font-bold text-white hover:bg-shopee-600 disabled:opacity-40"
          >
            {tidying ? "Tidying..." : "✨ Turn into follow-ups"}
          </button>
        </>
      )}

      {draft && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-navy-800">
            Review before saving
          </p>
          {draft.length === 0 && (
            <p className="text-sm text-slate-500">No follow-ups found in those notes.</p>
          )}
          <ul className="space-y-1.5">
            {draft.map((f) => (
              <li key={f.id} className="flex items-center gap-2">
                <span className="text-navy-400">•</span>
                <input
                  value={f.text}
                  onChange={(e) =>
                    setDraft((d) => d!.map((x) => (x.id === f.id ? { ...x, text: e.target.value } : x)))
                  }
                  className="flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-sm focus:border-shopee focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setDraft((d) => d!.filter((x) => x.id !== f.id))}
                  title="Remove"
                  className="text-slate-300 hover:text-red-600"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setDraft((d) => [...d!, { id: crypto.randomUUID(), text: "" }])}
            className="text-xs font-semibold text-navy-600 hover:text-navy-900"
          >
            + Add a line
          </button>

          {existingCount > 0 && (
            <p className="rounded-lg bg-navy-50 px-3 py-2 text-xs font-medium text-navy-700">
              Saving replaces the current {existingCount} follow-up{existingCount === 1 ? "" : "s"}{" "}
              from the last meeting.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-shopee px-3 py-1.5 text-sm font-bold text-white hover:bg-shopee-600 disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save follow-ups"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="text-sm text-slate-500 hover:text-slate-800"
            >
              Back to notes
            </button>
          </div>
        </div>
      )}

      {!draft && error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
