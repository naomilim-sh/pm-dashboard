"use client";

import { useState } from "react";
import { TrackerItem, TrackerItemStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: TrackerItemStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export default function TrackerTable({
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  items: TrackerItem[];
  onAdd: (item: { task: string; owner: string; deadline: string | null }) => Promise<void>;
  onUpdate: (id: string, patch: Partial<TrackerItem>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
        <h3 className="text-sm font-medium text-slate-700">Tracker</h3>
        <span className="text-xs text-slate-500">
          {items.length === 0 ? "No tasks yet" : `${done}/${items.length} tasks done`}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <textarea
                    ref={autoGrow}
                    rows={1}
                    defaultValue={item.task}
                    onInput={(e) => autoGrow(e.currentTarget)}
                    onBlur={(e) =>
                      e.target.value !== item.task &&
                      onUpdate(item.id, { task: e.target.value })
                    }
                    className="block w-full min-w-[180px] resize-none overflow-hidden bg-transparent leading-snug focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    defaultValue={item.owner}
                    onBlur={(e) =>
                      e.target.value !== item.owner &&
                      onUpdate(item.id, { owner: e.target.value })
                    }
                    className="w-full bg-transparent focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={item.status}
                    onChange={(e) =>
                      onUpdate(item.id, {
                        status: e.target.value as TrackerItemStatus,
                      })
                    }
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs"
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    defaultValue={item.deadline ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (item.deadline ?? "") &&
                      onUpdate(item.id, { deadline: e.target.value || null })
                    }
                    className="bg-transparent text-xs focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(item.id)}
                    className="text-slate-400 hover:text-red-600"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={handleAdd} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="New task"
          className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Owner"
          className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
        >
          Add
        </button>
      </form>
    </div>
  );
}
