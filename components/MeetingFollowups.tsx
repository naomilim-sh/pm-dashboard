"use client";

import { useState } from "react";
import { MeetingFollowup } from "@/lib/types";

function formatMeetingDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

export default function MeetingFollowups({
  followups,
  updatedAt,
  readOnly,
  onChange,
  onConvertToTodo,
  onOpenMeetingNotes,
}: {
  followups: MeetingFollowup[];
  updatedAt: string | null;
  readOnly: boolean;
  // Saves the whole list; resolves false if the save failed.
  onChange: (next: MeetingFollowup[]) => Promise<boolean>;
  onConvertToTodo: (todo: { task: string; owner: string; deadline: string | null }) => Promise<void>;
  onOpenMeetingNotes: () => void;
}) {
  const [newText, setNewText] = useState("");
  const [converting, setConverting] = useState<{ id: string; task: string; owner: string; deadline: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    if (await onChange([...followups, { id: crypto.randomUUID(), text }])) setNewText("");
  }

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!converting || !converting.task.trim()) return;
    setBusy(true);
    await onConvertToTodo({
      task: converting.task.trim(),
      owner: converting.owner.trim(),
      deadline: converting.deadline || null,
    });
    // Once it's a real task it no longer needs following up here.
    await onChange(followups.filter((f) => f.id !== converting.id));
    setConverting(null);
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-navy-800">Meeting follow-ups</h3>
        <span className="text-xs text-slate-500">
          {updatedAt ? `From meeting on ${formatMeetingDate(updatedAt)}` : "No meeting notes yet"}
        </span>
      </div>

      {followups.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
          Nothing to follow up.
          {!readOnly && (
            <>
              {" "}
              After your next catch-up, use{" "}
              <button
                type="button"
                onClick={onOpenMeetingNotes}
                className="font-semibold text-shopee hover:text-shopee-700"
              >
                ✨ Smart Notes → Meeting follow-ups
              </button>
              .
            </>
          )}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {followups.map((f) => (
            <li key={f.id} className="group px-3 py-2">
              {converting?.id === f.id ? (
                <form onSubmit={handleConvert} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-navy-700">New to-do</p>
                  <input
                    autoFocus
                    value={converting.task}
                    onChange={(e) => setConverting({ ...converting, task: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-shopee focus:outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={converting.owner}
                      onChange={(e) => setConverting({ ...converting, owner: e.target.value })}
                      placeholder="Owner"
                      className="w-32 rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-shopee focus:outline-none"
                    />
                    <input
                      type="date"
                      value={converting.deadline}
                      onChange={(e) => setConverting({ ...converting, deadline: e.target.value })}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-shopee focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || !converting.task.trim()}
                      className="rounded-lg bg-shopee px-3 py-1 text-sm font-bold text-white hover:bg-shopee-600 disabled:opacity-40"
                    >
                      {busy ? "Adding..." : "Add to tracker"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConverting(null)}
                      className="text-sm text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="pt-0.5 text-navy-400">•</span>
                  <input
                    key={f.text}
                    defaultValue={f.text}
                    readOnly={readOnly}
                    onBlur={(e) => {
                      const text = e.target.value.trim();
                      if (!text) {
                        e.target.value = f.text;
                        return;
                      }
                      if (text !== f.text) {
                        onChange(followups.map((x) => (x.id === f.id ? { ...x, text } : x)));
                      }
                    }}
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    className="min-w-0 flex-1 rounded bg-transparent px-1 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300"
                  />
                  {!readOnly && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setConverting({ id: f.id, task: f.text, owner: "", deadline: "" })}
                        title="Turn this into a task on the tracker"
                        className="rounded-md px-1.5 py-0.5 text-xs font-semibold text-navy-600 hover:bg-navy-50 hover:text-navy-900"
                      >
                        → To-do
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(followups.filter((x) => x.id !== f.id))}
                        title="Remove"
                        className="px-1 text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a follow-up…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-shopee focus:outline-none"
          />
          <button
            type="submit"
            disabled={!newText.trim()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Add
          </button>
        </form>
      )}
    </div>
  );
}
