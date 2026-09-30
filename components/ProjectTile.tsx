import Link from "next/link";
import { Project, ProjectProgress, resolvePercent } from "@/lib/types";
import { extractReadmePreview } from "@/lib/readmePreview";
import { ProjectStatus, chaseLevel, daysUntil, formatDate, statusOf } from "@/lib/projectStatus";
import ChasePicsTag from "@/components/ChasePicsTag";

export const STATUS_STYLE: Record<
  ProjectStatus,
  { rail: string; bar: string; number: string; label: string; pill: string }
> = {
  overdue: { rail: "bg-red-700", bar: "bg-red-700", number: "text-red-700", label: "Overdue", pill: "bg-red-50 text-red-700" },
  in_progress: { rail: "bg-navy-600", bar: "bg-navy-600", number: "text-navy-900", label: "In progress", pill: "bg-navy-50 text-navy-700" },
  not_started: { rail: "bg-slate-300", bar: "bg-slate-400", number: "text-slate-400", label: "Not started", pill: "bg-slate-100 text-slate-600" },
  done: { rail: "bg-emerald-500", bar: "bg-emerald-500", number: "text-emerald-600", label: "Done", pill: "bg-emerald-50 text-emerald-700" },
  archived: { rail: "bg-slate-200", bar: "bg-slate-300", number: "text-slate-400", label: "Archived", pill: "bg-slate-100 text-slate-500" },
};

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
      className={`group relative flex min-h-[176px] flex-col overflow-hidden rounded-2xl bg-white p-4 pt-5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-navy-900 ${
        isArchived ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <span className={`absolute inset-x-0 top-0 h-1.5 ${style.rail}`} aria-hidden />

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.pill}`}>
          {style.label}
        </span>
        <ChasePicsTag level={chase} />
      </div>

      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-navy-900 group-hover:underline">
          {project.name}
        </h3>
        {project.tracker_sheet_url && (
          <button
            type="button"
            title="Open tracker sheet"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              window.open(project.tracker_sheet_url!, "_blank", "noopener,noreferrer");
            }}
            className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-500 hover:bg-navy-50 hover:text-navy-900"
          >
            Sheet ↗
          </button>
        )}
      </div>

      {preview ? (
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{preview}</p>
      ) : (
        <p className="mt-1 text-xs italic text-slate-400">No updates yet</p>
      )}

      <div className="mt-auto pt-3">
        <div className="flex items-end justify-between gap-2">
          <span
            className={`text-2xl font-black tabular-nums tracking-tight ${style.number}`}
            title={fromSheet ? "From linked Google Sheet" : undefined}
          >
            {percent === null ? "—" : `${percent}%`}
          </span>
          <span className="pb-1 text-xs text-slate-400">
            {fromSheet
              ? "from sheet"
              : progress.total === 0
                ? "no tasks yet"
                : `${progress.done} of ${progress.total} tasks`}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent ?? 0}%` }} />
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-sm">
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
      </div>
    </Link>
  );
}
