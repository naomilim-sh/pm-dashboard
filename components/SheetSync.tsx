"use client";

import { useEffect, useState } from "react";
import { Project } from "@/lib/types";

function formatSyncedAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SheetFields = Pick<
  Project,
  | "tracker_sheet_url"
  | "tracker_percent_cell"
  | "tracker_percent_numerator_cell"
  | "tracker_percent_denominator_cell"
  | "tracker_label_column"
  | "tracker_value_column"
  | "tracker_numerator_labels"
  | "tracker_denominator_label"
  | "tracker_start_date_cell"
  | "tracker_eta_cell"
>;

function SheetUrlField({
  url,
  onSave,
}: {
  url: string | null;
  onSave: (value: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(!url);

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={url ?? ""}
        placeholder="Google Sheet URL"
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (value !== (url ?? "")) onSave(value);
          setEditing(false);
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="min-w-64 flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
    );
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm text-slate-400 underline hover:text-slate-600"
      >
        + Add Google Sheet link
      </button>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="truncate text-sm text-blue-600 underline hover:text-blue-800"
      >
        {url}
      </a>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="shrink-0 text-xs text-slate-400 underline hover:text-slate-600"
      >
        Edit
      </button>
    </div>
  );
}

type SyncMode = "cell" | "ratio" | "label";

const MODE_LABELS: Record<SyncMode, string> = {
  cell: "single % cell",
  ratio: "done/total cells",
  label: "done/total by label",
};

export default function SheetSync({
  project,
  onFieldChange,
}: {
  project: Project;
  onFieldChange: (patch: Partial<SheetFields>) => Promise<void>;
}) {
  const [mode, setMode] = useState<SyncMode>(
    project.tracker_label_column || project.tracker_denominator_label
      ? "label"
      : project.tracker_percent_numerator_cell || project.tracker_percent_denominator_cell
        ? "ratio"
        : "cell"
  );

  // Formatting a timestamp with the runtime's local timezone can differ
  // between the server (SSR) and the browser, causing a hydration mismatch —
  // so only compute/render this after the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const syncedAtLabel =
    mounted && project.tracker_percent_synced_at
      ? formatSyncedAt(project.tracker_percent_synced_at)
      : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <SheetUrlField
          url={project.tracker_sheet_url}
          onSave={(value) => onFieldChange({ tracker_sheet_url: value || null })}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode === "label" ? (
          <>
            <input
              defaultValue={project.tracker_label_column ?? ""}
              placeholder="Label col (e.g. A)"
              onBlur={(e) =>
                e.target.value !== (project.tracker_label_column ?? "") &&
                onFieldChange({ tracker_label_column: e.target.value || null })
              }
              className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <input
              defaultValue={project.tracker_value_column ?? ""}
              placeholder="Value col (e.g. D)"
              onBlur={(e) =>
                e.target.value !== (project.tracker_value_column ?? "") &&
                onFieldChange({ tracker_value_column: e.target.value || null })
              }
              className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </>
        ) : mode === "ratio" ? (
          <>
            <input
              defaultValue={project.tracker_percent_numerator_cell ?? ""}
              placeholder="Done cell(s), e.g. D6 or D6,D13"
              onBlur={(e) =>
                e.target.value !== (project.tracker_percent_numerator_cell ?? "") &&
                onFieldChange({ tracker_percent_numerator_cell: e.target.value || null })
              }
              className="w-52 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <span className="text-sm text-slate-400">/</span>
            <input
              defaultValue={project.tracker_percent_denominator_cell ?? ""}
              placeholder="Total cell (e.g. D14)"
              onBlur={(e) =>
                e.target.value !== (project.tracker_percent_denominator_cell ?? "") &&
                onFieldChange({ tracker_percent_denominator_cell: e.target.value || null })
              }
              className="w-36 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </>
        ) : (
          <input
            defaultValue={project.tracker_percent_cell ?? ""}
            placeholder="% cell (e.g. B2)"
            onBlur={(e) =>
              e.target.value !== (project.tracker_percent_cell ?? "") &&
              onFieldChange({ tracker_percent_cell: e.target.value || null })
            }
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}

        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SyncMode)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-500"
        >
          {(Object.keys(MODE_LABELS) as SyncMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {mode === "label" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            defaultValue={project.tracker_numerator_labels ?? ""}
            placeholder={`Done label(s), e.g. "Done Total, Won't do Total"`}
            onBlur={(e) =>
              e.target.value !== (project.tracker_numerator_labels ?? "") &&
              onFieldChange({ tracker_numerator_labels: e.target.value || null })
            }
            className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <span className="text-sm text-slate-400">/</span>
          <input
            defaultValue={project.tracker_denominator_label ?? ""}
            placeholder='Total label, e.g. "Grand Total"'
            onBlur={(e) =>
              e.target.value !== (project.tracker_denominator_label ?? "") &&
              onFieldChange({ tracker_denominator_label: e.target.value || null })
            }
            className="w-48 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        </div>
      )}

      {mode === "label" && (
        <p className="mt-1 text-xs text-slate-400">
          Looks up rows by label text instead of a fixed cell — survives a pivot
          table's rows shifting around.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-xs text-slate-500">Also sync dates:</span>
        <input
          defaultValue={project.tracker_start_date_cell ?? ""}
          placeholder={mode === "label" ? "Start date label" : "Start date cell"}
          onBlur={(e) =>
            e.target.value !== (project.tracker_start_date_cell ?? "") &&
            onFieldChange({ tracker_start_date_cell: e.target.value || null })
          }
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
        <input
          defaultValue={project.tracker_eta_cell ?? ""}
          placeholder={mode === "label" ? "ETA label" : "ETA cell"}
          onBlur={(e) =>
            e.target.value !== (project.tracker_eta_cell ?? "") &&
            onFieldChange({ tracker_eta_cell: e.target.value || null })
          }
          className="w-40 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
        />
      </div>

      {syncedAtLabel && (
        <p className="mt-2 text-xs text-slate-400">
          Last synced {syncedAtLabel} — {Math.round(project.tracker_percent_cached ?? 0)}%
        </p>
      )}
    </div>
  );
}
