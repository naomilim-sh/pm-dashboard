import Link from "next/link";
import { Project, ProjectProgress, resolvePercent } from "@/lib/types";
import { extractReadmePreview } from "@/lib/readmePreview";
import { ProjectStatus, chaseLevel, daysUntil, formatDate, statusOf } from "@/lib/projectStatus";
import ChasePicsTag from "@/components/ChasePicsTag";

export const STATUS_STYLE: Record<
  ProjectStatus,
  { rail: string; bar: string; number: string; label: string; pill: string; stroke: string }
> = {
  overdue: { rail: "bg-red-700", bar: "bg-red-700", number: "text-red-700", label: "Overdue", pill: "bg-red-100 text-red-700", stroke: "text-red-700" },
  in_progress: { rail: "bg-navy-600", bar: "bg-navy-600", number: "text-navy-900", label: "In progress", pill: "bg-navy-50 text-navy-700", stroke: "text-navy-600" },
  not_started: { rail: "bg-slate-300", bar: "bg-slate-400", number: "text-slate-400", label: "Not started", pill: "bg-slate-100 text-slate-600", stroke: "text-slate-300" },
  done: { rail: "bg-emerald-500", bar: "bg-emerald-500", number: "text-emerald-600", label: "Done", pill: "bg-emerald-50 text-emerald-700", stroke: "text-emerald-500" },
  archived: { rail: "bg-slate-200", bar: "bg-slate-300", number: "text-slate-400", label: "Archived", pill: "bg-slate-100 text-slate-500", stroke: "text-slate-300" },
};

// Urgent tiles get a tint so they pop; finished ones recede (muted, a touch
// smaller) so the eye lands on what still needs work.
const TILE_SURFACE: Record<ProjectStatus, string> = {
  overdue: "bg-red-50 ring-red-200 hover:-translate-y-0.5",
  in_progress: "bg-white ring-slate-200 hover:-translate-y-0.5",
  not_started: "bg-white ring-slate-200 hover:-translate-y-0.5",
  done: "bg-slate-50 ring-slate-200 opacity-75 scale-[0.97] hover:scale-100 hover:opacity-100",
  archived: "bg-slate-50 ring-slate-200 opacity-60 scale-[0.97] hover:scale-100 hover:opacity-100",
};

function ProgressRing({ percent, status }: { percent: number | null; status: ProjectStatus }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const style = STATUS_STYLE[status];
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90" aria-hidden>
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-slate-200" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          stroke="currentColor"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - (percent ?? 0) / 100)}
          className={`${style.stroke} transition-[stroke-dashoffset] duration-500`}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-black tabular-nums tracking-tighter ${percent === 100 ? "text-[11px]" : "text-sm"} ${style.number}`}
      >
        {percent === null ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

export function EtaLabel({
  eta,
  status,
  onDark = false,
}: {
  eta: string | null;
  status: ProjectStatus;
  onDark?: boolean;
}) {
  const days = daysUntil(eta);
  if (days === null || status === "done" || status === "archived") {
    return <span className="text-slate-500">{formatDate(eta)}</span>;
  }
  if (days < 0) {
    return (
      <span className={`font-bold ${onDark ? "text-red-400" : "text-red-700"}`}>
        {-days}d overdue
      </span>
    );
  }
  if (days <= 14) {
    return (
      <span className={`font-bold ${onDark ? "text-white" : "text-navy-900"}`}>
        {days === 0 ? "Due today" : `Due in ${days}d`}
      </span>
    );
  }
  // On the dark header the date input already shows the plain date.
  if (onDark) return null;
  return <span className="text-navy-800">{formatDate(eta)}</span>;
}

export default function ProjectTile({
  project,
  progress,
  onArchiveToggle,
}: {
  project: Project;
  progress: ProjectProgress;
  onArchiveToggle?: (projectId: string, archive: boolean) => void;
}) {
  const percent = resolvePercent(progress, project.tracker_percent_cached);
  const preview = extractReadmePreview(project.readme);
  const status = statusOf(project, percent);
  const style = STATUS_STYLE[status];
  const isArchived = status === "archived";
  const fromSheet = project.tracker_percent_cached !== null && project.tracker_percent_cached !== undefined;
  const chase = chaseLevel(project, status);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl p-4 pt-5 ring-1 transition hover:shadow-lg hover:ring-2 hover:ring-navy-900 ${TILE_SURFACE[status]}`}
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${style.rail}`} aria-hidden />

      {/* Fixed-height slots so names, tags and footers line up across a row. */}
      <div className="flex h-5 items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.pill}`}>
          {style.label}
        </span>
        <ChasePicsTag level={chase} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <h3 className="line-clamp-2 h-[2.75rem] min-w-0 flex-1 text-base font-bold leading-snug text-navy-900 group-hover:underline">
          {project.name}
        </h3>
        <ProgressRing percent={percent} status={status} />
      </div>

      <p className={`mt-1 line-clamp-2 h-8 text-xs ${preview ? "text-slate-500" : "italic text-slate-400"}`}>
        {preview || "No updates yet"}
      </p>

      <div className="mt-2 flex h-5 items-center justify-between gap-2 text-xs text-slate-400">
        <span title={fromSheet ? "From linked Google Sheet" : undefined}>
          {fromSheet
            ? "% from sheet"
            : progress.total === 0
              ? "No tasks yet"
              : `${progress.done} of ${progress.total} tasks done`}
        </span>
        {project.tracker_sheet_url && (
          <button
            type="button"
            title="Open tracker sheet"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(project.tracker_sheet_url!, "_blank", "noopener,noreferrer");
            }}
            className="rounded-md px-1.5 py-0.5 font-semibold text-slate-500 hover:bg-navy-50 hover:text-navy-900"
          >
            Sheet ↗
          </button>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-900/5 pt-2.5 text-sm">
        <span suppressHydrationWarning>
          <EtaLabel eta={project.eta} status={status} />
        </span>
        {onArchiveToggle && (isArchived || status === "done") ? (
          <button
            type="button"
            title={isArchived ? "Unarchive project" : "Archive project"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchiveToggle(project.id, !isArchived);
            }}
            className="rounded-md px-2 py-0.5 text-xs font-semibold text-slate-500 hover:bg-navy-50 hover:text-navy-900"
          >
            {isArchived ? "Unarchive" : "Archive"}
          </button>
        ) : (
          <span className="text-xs text-slate-400">Started {formatDate(project.start_date)}</span>
        )}
      </div>
    </Link>
  );
}
