import Link from "next/link";
import { Project, ProjectProgress, resolvePercent } from "@/lib/types";
import { extractReadmePreview } from "@/lib/readmePreview";
import CompletionBadge from "@/components/CompletionBadge";

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectCard({
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
  const isArchived = Boolean(project.archived_at);

  return (
    <Link
      href={`/projects/${project.id}`}
      className={`flex min-h-[160px] flex-col justify-between rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isArchived
          ? "border-slate-200 bg-slate-50 opacity-60 grayscale hover:opacity-90"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold text-slate-900">{project.name}</h3>
          <div className="flex shrink-0 items-center gap-1">
            {project.tracker_sheet_url && (
              <button
                type="button"
                title="Open tracker sheet"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(project.tracker_sheet_url!, "_blank", "noopener,noreferrer");
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                🔗
              </button>
            )}
            {onArchiveToggle && (isArchived || percent === 100) && (
              <button
                type="button"
                title={isArchived ? "Unarchive project" : "Archive project"}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onArchiveToggle(project.id, !isArchived);
                }}
                className="rounded-md px-1.5 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                {isArchived ? "Unarchive" : "Archive"}
              </button>
            )}
          </div>
        </div>
        {isArchived ? (
          <span className="inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
            Archived
          </span>
        ) : (
          <CompletionBadge
            done={progress.done}
            total={progress.total}
            sheetPercent={project.tracker_percent_cached}
          />
        )}
        {preview && (
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
            <span className="font-medium text-slate-400">Latest update: </span>
            {preview}
          </p>
        )}
      </div>

      <div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${percent ?? 0}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Start: {formatDate(project.start_date)}</span>
          <span>ETA: {formatDate(project.eta)}</span>
        </div>
      </div>
    </Link>
  );
}
