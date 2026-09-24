import Link from "next/link";
import { Project, ProjectProgress, resolvePercent } from "@/lib/types";
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
}: {
  project: Project;
  progress: ProjectProgress;
}) {
  const percent = resolvePercent(progress, project.tracker_percent_cached);

  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex min-h-[160px] flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
    >
      <div>
        <div className="mb-2 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold text-slate-900">{project.name}</h3>
          {project.tracker_sheet_url && (
            <button
              type="button"
              title="Open tracker sheet"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(project.tracker_sheet_url!, "_blank", "noopener,noreferrer");
              }}
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              🔗
            </button>
          )}
        </div>
        <CompletionBadge
          done={progress.done}
          total={progress.total}
          sheetPercent={project.tracker_percent_cached}
        />
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
