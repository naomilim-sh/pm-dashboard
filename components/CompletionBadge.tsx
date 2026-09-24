import { ProjectProgress } from "@/lib/types";

function colorsFor(percent: number) {
  return percent === 100
    ? "bg-blue-100 text-blue-800 border-blue-300"
    : percent === 0
      ? "bg-slate-100 text-slate-600 border-slate-300"
      : "bg-green-100 text-green-800 border-green-300";
}

export default function CompletionBadge({
  done,
  total,
  sheetPercent,
}: ProjectProgress & { sheetPercent?: number | null }) {
  if (sheetPercent !== undefined && sheetPercent !== null) {
    const percent = Math.round(sheetPercent);
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorsFor(percent)}`}
        title="From linked Google Sheet"
      >
        {percent}%
      </span>
    );
  }

  if (total === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        No tasks yet
      </span>
    );
  }

  const percent = Math.round((done / total) * 100);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorsFor(percent)}`}
    >
      {percent}% ({done}/{total})
    </span>
  );
}
