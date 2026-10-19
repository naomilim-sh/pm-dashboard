"use client";

import { useEffect } from "react";

export default function ReviewCompleteDialog({
  total,
  closing,
  onClose,
  onDismiss,
}: {
  total: number;
  closing: boolean;
  onClose: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-complete-title"
      onClick={onDismiss}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b-4 border-shopee bg-navy-950 px-6 py-5 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-navy-300">Review mode</p>
          <h2 id="review-complete-title" className="mt-1 text-2xl font-black tracking-tight">
            All {total} project{total === 1 ? "" : "s"} reviewed 🎉
          </h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-slate-600">
            Every project has been updated or confirmed as having no updates. Close review mode to
            clear the Reviewed labels.
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={closing}
              autoFocus
              className="rounded-lg bg-shopee px-4 py-2 text-sm font-bold text-white shadow-lg shadow-shopee/30 hover:bg-shopee-600 disabled:opacity-50"
            >
              {closing ? "Closing..." : "Close review mode"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
