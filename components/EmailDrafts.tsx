"use client";

import { useState } from "react";
import { EmailDraft } from "@/lib/types";

export default function EmailDrafts({
  drafts,
  onAdd,
  onUpdate,
  onDelete,
}: {
  drafts: EmailDraft[];
  onAdd: () => Promise<void>;
  onUpdate: (id: string, patch: Partial<EmailDraft>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(drafts[0]?.id ?? null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Email drafts</h3>
        <span className="text-xs text-slate-500">
          {drafts.length === 0 ? "No drafts yet" : `${drafts.length} draft(s)`}
        </span>
      </div>

      <div className="space-y-2">
        {drafts.map((d) => {
          const isOpen = openId === d.id;
          return (
            <div key={d.id} className="rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : d.id)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
              >
                <span className="font-medium">
                  {d.subject.trim() || "(no subject)"}
                </span>
                <span className="text-xs text-slate-400">
                  {isOpen ? "Collapse" : "Expand"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-slate-100 p-3">
                  <input
                    defaultValue={d.subject}
                    placeholder="Subject"
                    onBlur={(e) =>
                      e.target.value !== d.subject &&
                      onUpdate(d.id, { subject: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <input
                    defaultValue={d.recipients}
                    placeholder="Recipients (optional)"
                    onBlur={(e) =>
                      e.target.value !== d.recipients &&
                      onUpdate(d.id, { recipients: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <textarea
                    defaultValue={d.body}
                    placeholder="Draft body..."
                    rows={8}
                    onBlur={(e) =>
                      e.target.value !== d.body &&
                      onUpdate(d.id, { body: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Delete draft
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-3 rounded-md border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        + New draft
      </button>
    </div>
  );
}
