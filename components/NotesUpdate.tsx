"use client";

import { useState } from "react";
import { NotesUpdateProposal, TrackerItem, TrackerItemStatus } from "@/lib/types";

export default function NotesUpdate({
  projectId,
  trackerItems,
  onReadmeSave,
  onUpdateTrackerItem,
  onDeleteTrackerItem,
  onAddTrackerItem,
  onSaveNotesSnapshot,
  onApplied,
}: {
  projectId: string;
  trackerItems: TrackerItem[];
  onReadmeSave: (newReadme: string) => Promise<void>;
  onUpdateTrackerItem: (id: string, patch: Partial<TrackerItem>) => Promise<void>;
  onDeleteTrackerItem: (id: string) => Promise<void>;
  onAddTrackerItem: (item: {
    task: string;
    owner: string;
    status: TrackerItemStatus;
    deadline: string | null;
  }) => Promise<void>;
  onSaveNotesSnapshot: (rawNotes: string) => Promise<void>;
  onApplied?: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<NotesUpdateProposal | null>(null);
  const [selectedReadme, setSelectedReadme] = useState(true);
  const [selectedUpdates, setSelectedUpdates] = useState<Set<number>>(new Set());
  const [selectedNewTasks, setSelectedNewTasks] = useState<Set<number>>(new Set());

  async function handleAnalyze() {
    if (!notes.trim()) return;
    setAnalyzing(true);
    setError(null);
    setProposal(null);
    try {
      const res = await fetch("/api/parse-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, notes }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Analysis failed.");
      } else {
        const p: NotesUpdateProposal = body.proposal;
        setProposal(p);
        setSelectedReadme(Boolean(p.readme_summary));
        setSelectedUpdates(new Set(p.tracker_updates.map((_, i) => i)));
        setSelectedNewTasks(new Set(p.new_tasks.map((_, i) => i)));
      }
    } catch {
      setError("Analysis failed — could not reach the server.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleApply() {
    if (!proposal) return;
    setApplying(true);

    if (selectedReadme && proposal.readme_summary) {
      await onReadmeSave(proposal.readme_summary);
    }

    for (const i of selectedUpdates) {
      const u = proposal.tracker_updates[i];
      if (u.new_status === "done") {
        // Finished tasks are removed, not left marked done, so the tracker
        // stays a clean list of what's pending.
        await onDeleteTrackerItem(u.task_id);
        continue;
      }
      const patch: Partial<TrackerItem> = {};
      if (u.new_status) patch.status = u.new_status;
      if (u.new_owner) patch.owner = u.new_owner;
      if (u.new_deadline) patch.deadline = u.new_deadline;
      if (Object.keys(patch).length > 0) {
        await onUpdateTrackerItem(u.task_id, patch);
      }
    }

    for (const i of selectedNewTasks) {
      const t = proposal.new_tasks[i];
      await onAddTrackerItem({ task: t.task, owner: t.owner, status: t.status, deadline: t.deadline });
    }

    await onSaveNotesSnapshot(notes);

    setApplying(false);
    setProposal(null);
    setNotes("");
    onApplied?.();
  }

  function toggle(set: Set<number>, setSet: (s: Set<number>) => void, i: number) {
    const next = new Set(set);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSet(next);
  }

  function taskLabel(id: string) {
    return trackerItems.find((t) => t.id === id)?.task ?? "(unknown task)";
  }

  const nothingProposed =
    proposal &&
    proposal.tracker_updates.length === 0 &&
    proposal.new_tasks.length === 0 &&
    !proposal.readme_summary;

  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">Update from notes</h3>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={6}
        placeholder="Paste your quick notes here..."
        className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!notes.trim() || analyzing}
        className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
      >
        {analyzing ? "Analyzing..." : "Analyze updates"}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {proposal && (
        <div className="mt-4 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          {proposal.readme_summary && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedReadme}
                onChange={() => setSelectedReadme((v) => !v)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Replace README with updated summary:</span>
                <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-2 font-sans text-slate-600">
                  {proposal.readme_summary}
                </pre>
              </span>
            </label>
          )}

          {proposal.tracker_updates.map((u, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedUpdates.has(i)}
                onChange={() => toggle(selectedUpdates, setSelectedUpdates, i)}
                className="mt-1"
              />
              <span>
                {u.new_status === "done" ? (
                  <>
                    <span className="font-medium text-red-600">🗑 Remove (done):</span>{" "}
                    {taskLabel(u.task_id)}
                  </>
                ) : (
                  <>
                    <span className="font-medium">{taskLabel(u.task_id)}</span>
                    {u.new_status && (
                      <>
                        {" "}
                        → status: <span className="font-medium">{u.new_status}</span>
                      </>
                    )}
                    {u.new_owner && <> · owner: {u.new_owner}</>}
                    {u.new_deadline && <> · deadline: {u.new_deadline}</>}
                  </>
                )}
                <div className="text-xs text-slate-500">{u.reason}</div>
              </span>
            </label>
          ))}

          {proposal.new_tasks.map((t, i) => (
            <label key={i} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedNewTasks.has(i)}
                onChange={() => toggle(selectedNewTasks, setSelectedNewTasks, i)}
                className="mt-1"
              />
              <span>
                <span className="font-medium">+ New task:</span> {t.task}
                {t.owner && <> · owner: {t.owner}</>} · status: {t.status}
                {t.deadline && <> · deadline: {t.deadline}</>}
                <div className="text-xs text-slate-500">{t.reason}</div>
              </span>
            </label>
          ))}

          {nothingProposed && (
            <p className="text-sm text-slate-500">Nothing looks like it changed.</p>
          )}

          {!nothingProposed && (
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              {applying ? "Applying..." : "Apply selected changes"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
