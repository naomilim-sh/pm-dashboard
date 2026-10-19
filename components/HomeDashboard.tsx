"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardViewer, Project, ProjectProgress, resolvePercent } from "@/lib/types";
import ProjectTile from "@/components/ProjectTile";
import ProjectTimeline from "@/components/ProjectTimeline";
import { ProjectStatus, chaseLevel, statusOf } from "@/lib/projectStatus";
import { endReview, markReviewed, startReview } from "@/lib/review";
import ReviewCompleteDialog from "@/components/ReviewCompleteDialog";

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
  const [showArchived, setShowArchived] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPopupDismissed, setReviewPopupDismissed] = useState(false);
  const [confirmingEndReview, setConfirmingEndReview] = useState(false);

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

  async function currentUserId() {
    return (await supabase.auth.getUser()).data.user?.id ?? null;
  }

  async function handleStartReview() {
    // Only incomplete work gets reviewed — done and archived projects sit out.
    const ids = new Set(toReviewIds);
    if (ids.size === 0) return;
    setReviewBusy(true);
    setReviewError(null);
    const error = await startReview(supabase, [...ids]);
    if (error) {
      setReviewError(error);
    } else {
      setProjects((prev) =>
        prev.map((p) => (ids.has(p.id) ? { ...p, review_status: "pending" } : p))
      );
      setReviewPopupDismissed(false);
    }
    setReviewBusy(false);
  }

  async function handleEndReview() {
    const userId = await currentUserId();
    if (!userId) return;
    setReviewBusy(true);
    setReviewError(null);
    const error = await endReview(supabase, userId);
    if (error) {
      setReviewError(error);
    } else {
      setProjects((prev) => prev.map((p) => ({ ...p, review_status: null })));
    }
    setConfirmingEndReview(false);
    setReviewBusy(false);
  }

  async function handleMarkReviewed(projectId: string) {
    const error = await markReviewed(supabase, projectId);
    if (error) {
      setReviewError(error);
    } else {
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, review_status: "reviewed" } : p))
      );
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

  const toReviewIds = rows
    .filter((r) => r.status !== "archived" && r.status !== "done")
    .map((r) => r.project.id);
  // Review mode is on while any live project carries a review status.
  const inReview = rows.filter((r) => r.status !== "archived" && r.project.review_status);
  const reviewMode = inReview.length > 0;
  const reviewedCount = inReview.filter((r) => r.project.review_status === "reviewed").length;
  const pendingCount = inReview.length - reviewedCount;

  const STATUS_ORDER: ProjectStatus[] = ["overdue", "in_progress", "not_started", "done", "archived"];
  const archivedRows = rows.filter((r) => r.status === "archived");
  // One cluster sorted by urgency — status first, then soonest ETA. Archived
  // projects stay out of the way unless asked for.
  const tileRows = rows
    .filter((r) => showArchived || r.status !== "archived")
    .sort(
      (a, b) =>
        // During a review, what still needs looking at comes first.
        (reviewMode
          ? Number(b.project.review_status === "pending") - Number(a.project.review_status === "pending")
          : 0) ||
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
            {!readOnly && (
              <div className="flex flex-wrap items-center gap-2">
                {!reviewMode && toReviewIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleStartReview}
                    disabled={reviewBusy}
                    title={`Flag your ${toReviewIds.length} incomplete project${toReviewIds.length === 1 ? "" : "s"} as unreviewed until you update them or mark them as having no updates`}
                    className="rounded-lg border border-navy-600 px-4 py-2.5 text-sm font-bold text-white hover:border-navy-300 hover:bg-navy-900 disabled:opacity-50"
                  >
                    {reviewBusy ? "Starting..." : "Start review"}
                  </button>
                )}
                {!creating && (
                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="rounded-lg bg-shopee px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-shopee/30 hover:bg-shopee-400"
                  >
                    + New project
                  </button>
                )}
              </div>
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

        {reviewMode && (
          <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-white p-4 ring-2 ring-navy-600">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                <span className="font-black uppercase tracking-wider text-navy-900">Review mode</span>
                <span className="font-semibold text-navy-600">
                  {reviewedCount} of {inReview.length} reviewed
                </span>
              </p>
              <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-navy-50">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${(reviewedCount / inReview.length) * 100}%` }}
                />
              </div>
              {!readOnly && pendingCount > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Open each project and run ✨ Smart Notes, or hit{" "}
                  <span className="font-semibold text-slate-700">No updates ✓</span> on its card if
                  nothing changed.
                </p>
              )}
            </div>
            {!readOnly &&
              (pendingCount === 0 ? (
                <button
                  type="button"
                  onClick={handleEndReview}
                  disabled={reviewBusy}
                  className="rounded-lg bg-shopee px-3 py-1.5 text-sm font-bold text-white hover:bg-shopee-600 disabled:opacity-50"
                >
                  {reviewBusy ? "Closing..." : "Close review mode"}
                </button>
              ) : confirmingEndReview ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-600">
                    {pendingCount} still unreviewed — end anyway?
                  </span>
                  <button
                    type="button"
                    onClick={handleEndReview}
                    disabled={reviewBusy}
                    className="font-bold text-red-700 hover:underline disabled:opacity-50"
                  >
                    Yes, end
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingEndReview(false)}
                    className="text-slate-500 hover:underline"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingEndReview(true)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  End review early
                </button>
              ))}
          </div>
        )}

        {reviewError && (
          <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{reviewError}</p>
        )}

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
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold uppercase tracking-wider text-navy-800">
                {layout === "tiles" ? "Most urgent first" : "By deadline"}
              </p>
              {layout === "tiles" && archivedRows.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-navy-900 hover:underline"
                >
                  {showArchived ? "Hide archived" : `Show archived (${archivedRows.length})`}
                </button>
              )}
            </div>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {tileRows.map((r) => (
            <ProjectTile
              key={r.project.id}
              project={r.project}
              progress={r.progress}
              onArchiveToggle={readOnly ? undefined : handleArchiveToggle}
              onMarkReviewed={readOnly ? undefined : handleMarkReviewed}
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
      {!readOnly && reviewMode && pendingCount === 0 && !reviewPopupDismissed && (
        <ReviewCompleteDialog
          total={inReview.length}
          closing={reviewBusy}
          onClose={handleEndReview}
          onDismiss={() => setReviewPopupDismissed(true)}
        />
      )}
    </div>
  );
}
