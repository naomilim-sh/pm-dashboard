"use client";

import { useState } from "react";
import { Document } from "@/lib/types";
import { isGoogleLink } from "@/lib/googleDrive";

function displayTitle(d: Document): string {
  if (d.link_url) return d.link_title || d.link_url;
  return d.subject.trim() || "(no subject)";
}

const KIND_COLORS: Record<string, string> = {
  "Google Doc": "#4285F4",
  "Google Sheet": "#0F9D58",
  "Google Slides": "#F4B400",
  "Google Form": "#673AB7",
  PDF: "#EA4335",
};

function LinkIcon({ kind }: { kind: string | null }) {
  if (!kind || !(kind in KIND_COLORS)) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
        <path
          d="M9 15l6-6M10 6.5l.7-.7a4 4 0 1 1 5.7 5.7l-1.7 1.7M14 17.5l-.7.7a4 4 0 1 1-5.7-5.7l1.7-1.7"
          stroke="#94A3B8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M6 3.5A1.5 1.5 0 0 1 7.5 2H14l4 4v14.5A1.5 1.5 0 0 1 16.5 22h-9A1.5 1.5 0 0 1 6 20.5v-17z"
        fill={KIND_COLORS[kind]}
      />
      <path d="M14 2v4h4" fill="#fff" fillOpacity={0.35} />
    </svg>
  );
}

export default function Documents({
  documents,
  onAdd,
  onUpdate,
  onDelete,
  readOnly = false,
}: {
  documents: Document[];
  onAdd: (input: Partial<Document>) => Promise<void>;
  onUpdate: (id: string, patch: Partial<Document>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");
  const [adding, setAdding] = useState(false);
  const [addWarning, setAddWarning] = useState<string | null>(null);

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = newValue.trim();
    if (!value || adding) return;

    setAdding(true);
    setAddWarning(null);

    if (isGoogleLink(value)) {
      try {
        const res = await fetch("/api/fetch-doc-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: value }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to read that link.");
        await onAdd({
          link_url: value,
          link_title: body.title,
          link_kind: body.kind,
          link_icon: body.icon,
        });
      } catch (err) {
        setAddWarning(
          `Added the link, but couldn't fetch its title (${
            err instanceof Error ? err.message : "unknown error"
          }). You can rename it below.`
        );
        await onAdd({ link_url: value, link_title: null, link_kind: null, link_icon: null });
      }
    } else {
      await onAdd({ subject: value, recipients: "", body: "" });
    }

    setAdding(false);
    setNewValue("");
  }

  const links = documents.filter((d) => d.link_url);
  const drafts = documents.filter((d) => !d.link_url);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">Documents</h3>
        <span className="text-xs text-slate-500">
          {documents.length === 0 ? "No documents yet" : `${documents.length} document(s)`}
        </span>
      </div>

      {links.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {links.map((d) => {
            const isRenaming = !readOnly && renamingId === d.id;
            return (
              <div
                key={d.id}
                className="group flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1"
              >
                {isRenaming ? (
                  <form
                    className="flex items-center"
                    onSubmit={(e) => {
                      e.preventDefault();
                      setRenamingId(null);
                    }}
                  >
                    <input
                      autoFocus
                      defaultValue={d.link_title ?? ""}
                      placeholder="Document title"
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (d.link_title ?? "")) onUpdate(d.id, { link_title: v || null });
                        setRenamingId(null);
                      }}
                      className="w-40 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-slate-500 focus:outline-none"
                    />
                  </form>
                ) : (
                  <a
                    href={d.link_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={displayTitle(d)}
                    className="flex h-8 w-8 items-center justify-center rounded hover:bg-slate-50"
                  >
                    <LinkIcon kind={d.link_kind} />
                  </a>
                )}

                {!isRenaming && !readOnly && (
                  <div className="hidden items-center gap-0.5 pr-1 group-hover:flex">
                    <button
                      type="button"
                      onClick={() => setRenamingId(d.id)}
                      title="Rename"
                      className="text-xs text-slate-300 hover:text-slate-600"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(d.id)}
                      title="Remove"
                      className="text-xs text-slate-300 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        {drafts.map((d) => {
          const isOpen = openId === d.id;
          return (
            <div key={d.id} className="rounded-md border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : d.id)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm"
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="shrink-0">✉️</span>
                  <span className="truncate font-medium">{displayTitle(d)}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">
                  {isOpen ? "Collapse" : "Expand"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-slate-100 p-3">
                  <input
                    defaultValue={d.subject}
                    placeholder="Subject"
                    readOnly={readOnly}
                    onBlur={(e) =>
                      !readOnly &&
                      e.target.value !== d.subject &&
                      onUpdate(d.id, { subject: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <input
                    defaultValue={d.recipients}
                    placeholder="Recipients (optional)"
                    readOnly={readOnly}
                    onBlur={(e) =>
                      !readOnly &&
                      e.target.value !== d.recipients &&
                      onUpdate(d.id, { recipients: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <textarea
                    defaultValue={d.body}
                    placeholder="Draft body..."
                    rows={8}
                    readOnly={readOnly}
                    onBlur={(e) =>
                      !readOnly && e.target.value !== d.body && onUpdate(d.id, { body: e.target.value })
                    }
                    className="w-full rounded-md border border-slate-300 p-3 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  {!readOnly && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => onDelete(d.id)}
                        className="text-xs text-slate-400 hover:text-red-600"
                      >
                        Delete draft
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <form onSubmit={handleAddSubmit} className="mt-3 flex items-center gap-2">
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Paste a Google Doc/Slides/Sheet link, or type an email draft subject..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={adding || !newValue.trim()}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {adding ? "Adding..." : "+ Add"}
          </button>
        </form>
      )}
      {addWarning && <p className="mt-1 text-xs text-amber-600">{addWarning}</p>}
    </div>
  );
}
