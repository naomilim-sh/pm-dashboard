"use client";

import { useState } from "react";
import { TrackerItem, TrackerItemStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TrackerItemStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const STATUS_STYLES: Record<TrackerItemStatus, string> = {
  todo: "bg-slate-100 text-slate-500",
  in_progress: "bg-shopee-50 text-shopee-700",
  done: "bg-emerald-50 text-emerald-700",
};

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function isOverdue(item: TrackerItem): boolean {
  if (!item.deadline || item.status === "done") return false;
  return item.deadline < new Date().toISOString().slice(0, 10);
}

export default function TrackerTable({
  items,
  onAdd,
  onUpdate,
  onDelete,
  readOnly = false,
}: {
  items: TrackerItem[];
  onAdd: (item: { task: string; owner: string; deadline: string | null }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<TrackerItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [task, setTask] = useState("");
  const [owner, setOwner] = useState("");
  const [deadline, setDeadline] = useState("");

  const done = items.filter((i) => i.status === "done").length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!task.trim()) return;
    await onAdd({ task: task.trim(), owner: owner.trim(), deadline: deadline || null });
    setTask("");
    setOwner("");
    setDeadline("");
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-navy-800">Tracker</h3>
        <span className="text-xs text-slate-500">
          {items.length === 0 ? "No tasks yet" : `${done}/${items.length} tasks done`}
        </span>
      </div>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {items.map((item) => {
          const overdue = isOverdue(item);
          return (
            <div
              key={item.id}
              className="group flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50"
            >
              <button
                type="button"
                onClick={() =>
                  !readOnly &&
                  onUpdate(item.id, { status: item.status === "done" ? "todo" : "done" })
                }
                disabled={readOnly}
                title={item.status === "done" ? "Mark as not done" : "Mark as done"}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
                  item.status === "done"
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 text-transparent hover:border-slate-400"
                } ${readOnly ? "cursor-default" : ""}`}
              >
                ✓
              </button>

              <textarea
                ref={autoGrow}
                rows={1}
                defaultValue={item.task}
                readOnly={readOnly}
                onInput={(e) => autoGrow(e.currentTarget)}
                onBlur={(e) =>
                  !readOnly &&
                  e.target.value !== item.task &&
                  onUpdate(item.id, { task: e.target.value })
                }
                className={`block flex-1 resize-none overflow-hidden bg-transparent pt-0.5 text-sm leading-snug focus:outline-none ${
                  item.status === "done" ? "text-slate-400 line-through" : "text-slate-800"
                }`}
              />

              <input
                defaultValue={item.owner}
                placeholder="Owner"
                readOnly={readOnly}
                onBlur={(e) =>
                  !readOnly &&
                  e.target.value !== item.owner &&
                  onUpdate(item.id, { owner: e.target.value })
                }
                className="w-24 shrink-0 rounded-md bg-transparent px-1 py-0.5 text-right text-xs text-slate-500 placeholder:text-slate-300 focus:bg-white focus:text-left focus:outline-none focus:ring-1 focus:ring-slate-300"
              />

              {readOnly ? (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {STATUS_OPTIONS.find((o) => o.value === item.status)?.label}
                </span>
              ) : (
                <select
                  value={item.status}
                  onChange={(e) =>
                    onUpdate(item.id, { status: e.target.value as TrackerItemStatus })
                  }
                  className={`shrink-0 rounded-full border-none px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}

              <input
                type="date"
                defaultValue={item.deadline ?? ""}
                readOnly={readOnly}
                onBlur={(e) =>
                  !readOnly &&
                  e.target.value !== (item.deadline ?? "") &&
                  onUpdate(item.id, { deadline: e.target.value || null })
                }
                className={`w-32 shrink-0 rounded-md bg-transparent px-1 py-0.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-300 ${
                  overdue ? "font-medium text-red-600" : "text-slate-500"
                }`}
              />

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  title="Remove task"
                  className="shrink-0 text-slate-300 opacity-0 hover:text-red-600 group-hover:opacity-100"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <p className="px-3 py-4 text-sm text-slate-400">Nothing tracked yet — add a task below.</p>
        )}
      </div>

      {!readOnly && (
        <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="New task"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-shopee focus:outline-none"
          />
          <input
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner"
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-shopee focus:outline-none"
          />
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-shopee focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-shopee px-3 py-1.5 text-sm font-bold text-white hover:bg-shopee-600">
            Add
          </button>
        </form>
      )}
    </div>
  );
}
