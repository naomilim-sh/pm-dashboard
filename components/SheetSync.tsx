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
>;

type SyncMode = "cell" | "ratio" | "label";

const MODE_LABELS: Record<SyncMode, string> = {
  cell: "single % cell",
  ratio: "done/total cells",
  label: "done/total by label",
};

function modeFor(project: Project): SyncMode {
  if (project.tracker_label_column || project.tracker_denominator_label) return "label";
  if (project.tracker_percent_numerator_cell || project.tracker_percent_denominator_cell) return "ratio";
  return "cell";
}

function summarize(project: Project): string {
  const mode = modeFor(project);
  if (mode === "label" && project.tracker_denominator_label) {
    return `Synced by label ("${project.tracker_denominator_label}")`;
  }
  if (mode === "ratio" && project.tracker_percent_numerator_cell && project.tracker_percent_denominator_cell) {
    return `Synced from ${project.tracker_percent_numerator_cell} / ${project.tracker_percent_denominator_cell}`;
  }
  if (mode === "cell" && project.tracker_percent_cell) {
    return `Synced from cell ${project.tracker_percent_cell}`;
  }
  return "Sheet linked — no % source configured";
}

type Draft = {
  sheetUrl: string;
  percentCell: string;
  numeratorCell: string;
  denominatorCell: string;
  labelColumn: string;
  valueColumn: string;
  numeratorLabels: string;
  denominatorLabel: string;
};

function draftFrom(project: Project): Draft {
  return {
    sheetUrl: project.tracker_sheet_url ?? "",
    percentCell: project.tracker_percent_cell ?? "",
    numeratorCell: project.tracker_percent_numerator_cell ?? "",
    denominatorCell: project.tracker_percent_denominator_cell ?? "",
    labelColumn: project.tracker_label_column ?? "",
    valueColumn: project.tracker_value_column ?? "",
    numeratorLabels: project.tracker_numerator_labels ?? "",
    denominatorLabel: project.tracker_denominator_label ?? "",
  };
}

export default function SheetSync({
  project,
  onFieldChange,
  readOnly = false,
}: {
  project: Project;
  onFieldChange: (patch: Partial<SheetFields>) => Promise<void>;
  readOnly?: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [mode, setMode] = useState<SyncMode>(() => modeFor(project));
  const [draft, setDraft] = useState<Draft>(() => draftFrom(project));

  // Re-seed the draft when the user switches to a different project, but not
  // on every prop update (e.g. a "Sync now" refresh) — that would clobber an
  // in-progress edit.
  useEffect(() => {
    setMode(modeFor(project));
    setDraft(draftFrom(project));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Formatting a timestamp with the runtime's local timezone can differ
  // between the server (SSR) and the browser, causing a hydration mismatch —
  // so only compute/render this after the client has mounted.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const syncedAtLabel =
    mounted && project.tracker_percent_synced_at
      ? formatSyncedAt(project.tracker_percent_synced_at)
      : null;

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>{project.tracker_sheet_url ? "🔗" : "—"}</span>
        <span className={project.tracker_sheet_url ? "text-slate-700" : "text-slate-400"}>
          {project.tracker_sheet_url ? summarize(project) : "No Google Sheet linked"}
        </span>
        {syncedAtLabel && (
          <span className="text-xs text-slate-400">
            Last synced {syncedAtLabel} — {Math.round(project.tracker_percent_cached ?? 0)}%
          </span>
        )}
      </div>
    );
  }

  const isDirty =
    mode !== modeFor(project) || JSON.stringify(draft) !== JSON.stringify(draftFrom(project));

  async function handleSave() {
    setSaving(true);

    // Only the active mode's fields are kept — switching modes clears the
    // others so stale config from a previous mode can't silently win.
    const patch: Partial<SheetFields> = {
      tracker_sheet_url: draft.sheetUrl.trim() || null,
      tracker_percent_cell: mode === "cell" ? draft.percentCell.trim() || null : null,
      tracker_percent_numerator_cell: mode === "ratio" ? draft.numeratorCell.trim() || null : null,
      tracker_percent_denominator_cell: mode === "ratio" ? draft.denominatorCell.trim() || null : null,
      tracker_label_column: mode === "label" ? draft.labelColumn.trim() || null : null,
      tracker_value_column: mode === "label" ? draft.valueColumn.trim() || null : null,
      tracker_numerator_labels: mode === "label" ? draft.numeratorLabels.trim() || null : null,
      tracker_denominator_label: mode === "label" ? draft.denominatorLabel.trim() || null : null,
    };

    await onFieldChange(patch);
    setSaving(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  function handleReset() {
    setMode(modeFor(project));
    setDraft(draftFrom(project));
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-500">Google Sheet URL</label>
        {syncedAtLabel && (
          <span className="text-xs text-slate-400">
            Last synced {syncedAtLabel} — {Math.round(project.tracker_percent_cached ?? 0)}%
          </span>
        )}
      </div>
      <input
        value={draft.sheetUrl}
        onChange={(e) => setDraft((d) => ({ ...d, sheetUrl: e.target.value }))}
        placeholder="Google Sheet URL"
        className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="mt-3 flex items-center justify-between">
        <label className="text-xs font-medium text-slate-500">% source</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as SyncMode)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600"
        >
          {(Object.keys(MODE_LABELS) as SyncMode[]).map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode === "label" ? (
          <>
            <input
              value={draft.labelColumn}
              onChange={(e) => setDraft((d) => ({ ...d, labelColumn: e.target.value }))}
              placeholder="Label col (e.g. A)"
              className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <input
              value={draft.valueColumn}
              onChange={(e) => setDraft((d) => ({ ...d, valueColumn: e.target.value }))}
              placeholder="Value col (e.g. D)"
              className="w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </>
        ) : mode === "ratio" ? (
          <>
            <input
              value={draft.numeratorCell}
              onChange={(e) => setDraft((d) => ({ ...d, numeratorCell: e.target.value }))}
              placeholder="Done cell(s), e.g. D6 or D6,D13"
              className="w-52 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
            <span className="text-sm text-slate-400">/</span>
            <input
              value={draft.denominatorCell}
              onChange={(e) => setDraft((d) => ({ ...d, denominatorCell: e.target.value }))}
              placeholder="Total cell (e.g. D14)"
              className="w-36 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
            />
          </>
        ) : (
          <input
            value={draft.percentCell}
            onChange={(e) => setDraft((d) => ({ ...d, percentCell: e.target.value }))}
            placeholder="% cell (e.g. B2)"
            className="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
        )}
      </div>

      {mode === "label" && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            value={draft.numeratorLabels}
            onChange={(e) => setDraft((d) => ({ ...d, numeratorLabels: e.target.value }))}
            placeholder={`Done label(s), e.g. "Done Total, Won't do Total"`}
            className="w-72 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
          />
          <span className="text-sm text-slate-400">/</span>
          <input
            value={draft.denominatorLabel}
            onChange={(e) => setDraft((d) => ({ ...d, denominatorLabel: e.target.value }))}
            placeholder='Total label, e.g. "Grand Total"'
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

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Reset
          </button>
        )}
        {justSaved && <span className="text-xs text-green-600">✓ Saved</span>}
      </div>
    </div>
  );
}
