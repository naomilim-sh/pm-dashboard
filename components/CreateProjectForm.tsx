"use client";

import { useState } from "react";

export default function CreateProjectForm({
  onImport,
  onDone,
  autoFocus = true,
}: {
  onImport: (input: { sheetUrl: string; startDate: string; eta: string }) => Promise<string | null>;
  onDone: () => void;
  autoFocus?: boolean;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [eta, setEta] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = sheetUrl.trim() && eta;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const errorMessage = await onImport({ sheetUrl: sheetUrl.trim(), startDate, eta });
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
    } else {
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-start gap-2">
      <input
        autoFocus={autoFocus}
        value={sheetUrl}
        onChange={(e) => setSheetUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onDone()}
        placeholder="Google Sheet URL (required)"
        className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-slate-500">
          ETA (required)
          <input
            type="date"
            value={eta}
            onChange={(e) => setEta(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Start (optional)
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {submitting ? "Importing..." : "Import"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
