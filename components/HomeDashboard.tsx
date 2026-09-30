"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardViewer, Project, ProjectProgress, resolvePercent } from "@/lib/types";
import ProjectTile from "@/components/ProjectTile";
import ProjectTimeline from "@/components/ProjectTimeline";
import { ProjectStatus, chaseLevel, statusOf } from "@/lib/projectStatus";

type Layout = "tiles" | "timeline";
const LAYOUT_KEY = "pm-dashboard:home-layout";
import CreateProjectForm from "@/components/CreateProjectForm";
import GoogleConnect from "@/components/GoogleConnect";
import DashboardSharing from "@/components/DashboardSharing";

export default function HomeDashboard({
  userEmail,
  initialProjects,
  progressByProject,
  googleConnected,
  googleEmail,
  readOnly,
  viewedOwnerId,
  viewedOwnerEmail,
  viewableOwners,
  myViewers,
}: {
  userEmail: string;
  initialProjects: Project[];
  progressByProject: Record<string, ProjectProgress>;
  googleConnected: boolean;
  googleEmail: string | null;
  readOnly: boolean;
  viewedOwnerId: string | null;
  viewedOwnerEmail: string | null;
  viewableOwners: { owner_user_id: string; owner_email: string }[];
  myViewers: Pick<DashboardViewer, "id" | "invited_email" | "viewer_user_id" | "created_at">[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("google_error");

  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [progress, setProgress] = useState<Record<string, ProjectProgress>>(progressByProject);
  const [creating, setCreating] = useState(false);
  const [layout, setLayout] = useState<Layout>("tiles");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAYOUT_KEY);
      if (saved === "tiles" || saved === "timeline") setLayout(saved);
    } catch {}
  }, []);

  function chooseLayout(next: Layout) {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {}
  }

  useEffect(() => {
    // The RSC payload for "/" can be served from Next.js's client router cache
    // after a sheet sync or edit on another page, so re-fetch fresh data here
    // rather than trusting the server-rendered props alone.
    let cancelled = false;

    (async () => {
      const targetOwnerId = viewedOwnerId ?? (await supabase.auth.getUser()).data.user?.id;
      if (!targetOwnerId) return;

      const { data: freshProjects } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", targetOwnerId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (freshProjects) setProjects(freshProjects);

      const ids = (freshProjects ?? []).map((p) => p.id);
      if (ids.length === 0) {
        setProgress({});
        return;
      }
      const { data: trackerItems } = await supabase
        .from("tracker_items")
        .select("project_id, status")
        .in("project_id", ids);
      if (cancelled) return;

      const freshProgress: Record<string, ProjectProgress> = {};
      for (const item of trackerItems ?? []) {
        const entry = freshProgress[item.project_id] ?? { done: 0, total: 0 };
        entry.total += 1;
        if (item.status === "done") entry.done += 1;
        freshProgress[item.project_id] = entry;
      }
      setProgress(freshProgress);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewedOwnerId]);

  async function handleImportSheet(input: { sheetUrl: string; startDate: string; eta: string }) {
    const res = await fetch("/api/import-sheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await res.json();
    if (!res.ok) {
      return body.error ?? "Import failed.";
    }

    router.push(`/projects/${body.projectId}`);
    return null;
  }

  async function handleArchiveToggle(projectId: string, archive: boolean) {
    const archived_at = archive ? new Date().toISOString() : null;
    const { error } = await supabase.from("projects").update({ archived_at }).eq("id", projectId);
    if (!error) {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, archived_at } : p)));
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const rows = projects.map((p) => {
    const prog = progress[p.id] ?? { done: 0, total: 0 };
    const percent = resolvePercent(prog, p.tracker_percent_cached);
    return { project: p, progress: prog, percent, status: statusOf(p, percent) };
  });
  const active = rows.filter((r) => r.status !== "archived" && r.status !== "done");
  // Anything due within a month (which includes the last two weeks) and not
  // yet done/overdue — the same projects that carry a "Chase PICs?" tag.
  const toChase = rows.filter((r) => chaseLevel(r.project, r.status) !== null).length;
  const overdue = rows.filter((r) => r.status === "overdue").length;

  const STATUS_ORDER: ProjectStatus[] = ["overdue", "in_progress", "not_started", "done", "archived"];
  const filters: { key: ProjectStatus | "all"; label: string; dot: string; active: string }[] = [
    { key: "all", label: "All", dot: "bg-navy-900", active: "bg-navy-900 text-white ring-navy-900" },
    { key: "overdue", label: "Overdue", dot: "bg-red-700", active: "bg-red-700 text-white ring-red-700" },
    { key: "in_progress", label: "In progress", dot: "bg-navy-600", active: "bg-navy-600 text-white ring-navy-600" },
    { key: "not_started", label: "Not started", dot: "bg-slate-400", active: "bg-slate-600 text-white ring-slate-600" },
    { key: "done", label: "Done", dot: "bg-emerald-500", active: "bg-emerald-600 text-white ring-emerald-600" },
    { key: "archived", label: "Archived", dot: "bg-slate-300", active: "bg-slate-500 text-white ring-slate-500" },
  ];
  const countFor = (key: ProjectStatus | "all") =>
    key === "all" ? rows.filter((r) => r.status !== "archived").length : rows.filter((r) => r.status === key).length;
  const archivedRows = rows.filter((r) => r.status === "archived");
  // One cluster: everything (minus archived, unless that filter is picked)
  // sorted by urgency — status first, then soonest ETA.
  const tileRows = rows
    .filter((r) => (statusFilter === "all" ? r.status !== "archived" : r.status === statusFilter))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        (a.project.eta ?? "9999").localeCompare(b.project.eta ?? "9999")
    );

  const stats = [
    { label: "Active", value: String(active.length), accent: "text-white" },
    { label: "Projects to chase", value: String(toChase), accent: toChase ? "text-shopee-400" : "text-white" },
    { label: "Overdue", value: String(overdue), accent: overdue ? "text-red-400" : "text-white" },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-shopee bg-navy-950 text-navy-50">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black tracking-tight">
              PM<span className="text-shopee">/</span>Dashboard
            </p>
            <div className="flex flex-wrap items-center gap-3 text-sm text-navy-200 [&_a]:text-navy-200 [&_a:hover]:text-white [&_div]:text-navy-200">
              {!readOnly && (
                <GoogleConnect connected={googleConnected} connectedEmail={googleEmail} returnTo="/" />
              )}
              <span className="hidden sm:inline">{userEmail}</span>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-md border border-navy-700 px-3 py-1 hover:bg-navy-900"
              >
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-navy-300">
                {readOnly ? `${viewedOwnerEmail}'s board` : "Your board"}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                {overdue > 0
                  ? `${overdue} project${overdue === 1 ? "" : "s"} need${overdue === 1 ? "s" : ""} attention.`
                  : active.length > 0
                    ? "Everything's on track."
                    : "Nothing in flight yet."}
              </h1>
            </div>
            {!readOnly && !creating && (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="rounded-lg bg-shopee px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-shopee/30 hover:bg-shopee-400"
              >
                + New project
              </button>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-y-3 border-t border-navy-800 pt-4 sm:max-w-xl">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-semibold uppercase tracking-wider text-navy-300">{s.label}</dt>
                <dd className={`mt-0.5 text-2xl font-black tabular-nums ${s.accent}`} suppressHydrationWarning>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        <DashboardSharing
          readOnly={readOnly}
          viewedOwnerEmail={viewedOwnerEmail}
          viewableOwners={viewableOwners}
          myViewers={myViewers}
        />

        {googleError && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{googleError}</p>
        )}

        {!readOnly && creating && (
          <div className="mb-6 rounded-xl border-2 border-shopee-300 bg-shopee-50 p-5">
            <p className="mb-3 text-sm font-bold text-shopee-700">Import a project from a Google Sheet</p>
            <CreateProjectForm onImport={handleImportSheet} onDone={() => setCreating(false)} />
          </div>
        )}

        {projects.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {layout === "tiles" ? (
              <div className="flex flex-wrap gap-2">
                {filters.map((f) => {
                  const count = countFor(f.key);
                  const selected = statusFilter === f.key;
                  if (count === 0 && !selected && f.key !== "all") return null;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setStatusFilter(selected && f.key !== "all" ? "all" : f.key)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1 transition ${
                        selected ? f.active : "bg-white text-navy-800 ring-slate-200 hover:ring-navy-400"
                      }`}
                    >
                      {!selected && <span className={`h-2 w-2 rounded-full ${f.dot}`} />}
                      {f.label}
                      <span className={selected ? "opacity-80" : "text-slate-400"}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm font-bold uppercase tracking-wider text-navy-800">By deadline</p>
            )}
            <div className="inline-flex rounded-lg bg-navy-50 p-1 text-sm font-bold" role="tablist">
              {(["tiles", "timeline"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  role="tab"
                  aria-selected={layout === l}
                  onClick={() => chooseLayout(l)}
                  className={`rounded-md px-3 py-1 capitalize transition ${
                    layout === l ? "bg-navy-900 text-white shadow-sm" : "text-navy-600 hover:text-navy-900"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {layout === "timeline" ? (
          <ProjectTimeline
            rows={rows.filter((r) => r.status !== "archived")}
            archivedCount={archivedRows.length}
          />
        ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tileRows.map((r) => (
            <ProjectTile
              key={r.project.id}
              project={r.project}
              progress={r.progress}
              onArchiveToggle={readOnly ? undefined : handleArchiveToggle}
            />
          ))}
        </div>
        )}

        {projects.length === 0 && !creating && (
          <div className="rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center">
            <p className="text-lg font-bold text-slate-700">No projects yet.</p>
            {!readOnly && (
              <p className="mt-1 text-sm text-slate-500">
                Hit <span className="font-bold text-shopee">+ New project</span> and paste a Google
                Sheet link to get started.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
