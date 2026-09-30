import Link from "next/link";
import { Project, ProjectProgress } from "@/lib/types";
import {
  ProjectStatus,
  chaseLevel,
  daysUntil,
  formatDate,
  parseDate,
  startOfToday,
} from "@/lib/projectStatus";
import ChasePicsTag from "@/components/ChasePicsTag";

type TimelineRow = {
  project: Project;
  progress: ProjectProgress;
  percent: number | null;
  status: ProjectStatus;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const BAR_STYLE: Record<ProjectStatus, { track: string; fill: string; number: string }> = {
  overdue: { track: "bg-red-100", fill: "bg-red-700", number: "text-red-700" },
  in_progress: { track: "bg-navy-50", fill: "bg-navy-600", number: "text-navy-900" },
  not_started: { track: "bg-slate-200", fill: "bg-slate-400", number: "text-slate-400" },
  done: { track: "bg-emerald-100", fill: "bg-emerald-500", number: "text-emerald-600" },
  archived: { track: "bg-slate-100", fill: "bg-slate-300", number: "text-slate-400" },
};

function startFor(p: Project): Date {
  if (p.start_date) return parseDate(p.start_date);
  if (p.created_at) {
    const d = new Date(p.created_at);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(parseDate(p.eta!).getTime() - 30 * DAY_MS);
}

export default function ProjectTimeline({
  rows,
  archivedCount,
}: {
  rows: TimelineRow[];
  archivedCount: number;
}) {
  const scheduled = rows
    .filter((r) => r.project.eta)
    .sort((a, b) => a.project.eta!.localeCompare(b.project.eta!));
  const unscheduled = rows.filter((r) => !r.project.eta);

  if (scheduled.length === 0 && unscheduled.length === 0) return null;

  const today = startOfToday();
  const starts = scheduled.map((r) => startFor(r.project).getTime());
  const ends = scheduled.map((r) => parseDate(r.project.eta!).getTime());
  let min = Math.min(today.getTime() - 14 * DAY_MS, ...starts);
  let max = Math.max(today.getTime() + 30 * DAY_MS, ...ends);
  const pad = (max - min) * 0.03;
  min -= pad;
  max += pad;
  const pos = (t: number) => ((t - min) / (max - min)) * 100;
  const todayPos = pos(today.getTime());

  const months: { label: string; left: number }[] = [];
  const cursor = new Date(min);
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor.getTime() < max) {
    months.push({
      label: cursor.toLocaleDateString("en-US", {
        month: "short",
        ...(cursor.getMonth() === 0 ? { year: "numeric" } : {}),
      }),
      left: pos(cursor.getTime()),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  // Long ranges get crowded (especially on phones) — label every 2nd/3rd
  // month, and drop any label that would clip the edges or sit under "Today".
  const step = months.length > 14 ? 3 : months.length > 7 ? 2 : 1;
  const monthLabels = months.filter(
    (m, i) => i % step === 0 && m.left > 5 && m.left < 95 && Math.abs(m.left - todayPos) > 9
  );

  const gridLines = (
    <>
      {months.map((m) => (
        <span
          key={m.label + m.left}
          className="absolute inset-y-0 w-px bg-slate-100"
          style={{ left: `${m.left}%` }}
          aria-hidden
        />
      ))}
      <span
        className="absolute inset-y-0 z-10 w-0.5 bg-navy-900"
        style={{ left: `${todayPos}%` }}
        aria-hidden
      />
    </>
  );

  return (
    <div className="space-y-6" suppressHydrationWarning>
      {scheduled.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="grid grid-cols-1 border-b border-slate-200 bg-navy-50 sm:grid-cols-[300px_1fr]">
            <div className="hidden px-4 py-2 text-xs font-bold uppercase tracking-wider text-navy-600 sm:block">
              Project
            </div>
            <div className="relative h-8 text-[11px] font-semibold text-navy-400">
              {monthLabels.map((m) => (
                <span
                  key={m.label + m.left}
                  className="absolute top-2 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${m.left}%` }}
                >
                  {m.label}
                </span>
              ))}
              <span
                className="absolute bottom-0 z-10 -translate-x-1/2 rounded-t-md bg-navy-900 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-white"
                style={{ left: `${todayPos}%` }}
              >
                Today
              </span>
            </div>
          </div>

          {scheduled.map(({ project, progress, percent, status }) => {
            const style = BAR_STYLE[status];
            const start = pos(startFor(project).getTime());
            const end = pos(parseDate(project.eta!).getTime());
            const width = Math.max(end - start, 1.5);
            const days = daysUntil(project.eta);
            const chase = chaseLevel(project, status);
            const chaseStart = pos(parseDate(project.eta!).getTime() - 30 * DAY_MS);

            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="group grid grid-cols-1 border-b border-slate-100 last:border-b-0 hover:bg-navy-50/50 sm:grid-cols-[300px_1fr]"
              >
                <div className="flex items-center gap-3 px-4 pb-1 pt-3 sm:py-3">
                  <span className={`w-14 shrink-0 text-lg font-black tabular-nums ${style.number}`}>
                    {percent === null ? "—" : `${percent}%`}
                  </span>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-navy-900 group-hover:underline">
                      {project.name}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      {status === "overdue" ? (
                        <span className="font-bold text-red-700">{-(days ?? 0)}d overdue</span>
                      ) : status === "done" ? (
                        <span className="font-semibold text-emerald-600">Done</span>
                      ) : (
                        <span>ETA {formatDate(project.eta)}</span>
                      )}
                      <ChasePicsTag level={chase} />
                    </p>
                  </div>
                </div>

                <div className="relative mx-4 mb-3 h-10 sm:mx-0 sm:mb-0 sm:h-auto sm:min-h-[56px]">
                  {gridLines}
                  {chase && (
                    <span
                      className="absolute inset-y-1 border-l-2 border-dashed border-shopee-300 bg-shopee-50"
                      style={{ left: `${chaseStart}%`, width: `${end - chaseStart}%` }}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full ${style.track}`}
                    style={{ left: `${start}%`, width: `${width}%` }}
                  >
                    <div className={`h-full ${style.fill}`} style={{ width: `${percent ?? 0}%` }} />
                  </div>
                  <span
                    className="absolute top-1/2 z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white bg-navy-900"
                    style={{ left: `${end}%` }}
                    title={`ETA ${formatDate(project.eta)}`}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-5 rounded-full bg-navy-600" /> Done so far
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rotate-45 bg-navy-900" /> ETA
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 border-l-2 border-dashed border-shopee-300 bg-shopee-50" /> Last month
          before ETA
        </span>
        {archivedCount > 0 && <span>{archivedCount} archived hidden</span>}
      </div>

      {unscheduled.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">No ETA set</p>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map(({ project }) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-navy-800 ring-1 ring-slate-200 hover:ring-navy-400"
              >
                {project.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
