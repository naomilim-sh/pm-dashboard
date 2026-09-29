"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardViewer, Project, ProjectProgress } from "@/lib/types";
import ProjectCard from "@/components/ProjectCard";
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">PM Dashboard</h1>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {!readOnly && (
            <GoogleConnect connected={googleConnected} connectedEmail={googleEmail} returnTo="/" />
          )}
          <span>{userEmail}</span>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-md border border-slate-300 px-3 py-1 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>

      <DashboardSharing
        readOnly={readOnly}
        viewedOwnerEmail={viewedOwnerEmail}
        viewableOwners={viewableOwners}
        myViewers={myViewers}
      />

      {googleError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{googleError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} progress={progress[p.id] ?? { done: 0, total: 0 }} />
        ))}

        {!readOnly &&
          (creating ? (
            <div className="flex min-h-[160px] flex-col justify-center rounded-2xl border border-dashed border-slate-300 p-5">
              <CreateProjectForm onImport={handleImportSheet} onDone={() => setCreating(false)} />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-[160px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 hover:border-slate-400 hover:text-slate-700"
            >
              <span className="text-2xl leading-none">+</span>
              <span>New project</span>
            </button>
          ))}
      </div>

      {projects.length === 0 && !creating && (
        <p className="mt-4 px-1 text-sm text-slate-400">
          {readOnly ? "No projects yet." : "No projects yet — create your first one above."}
        </p>
      )}
    </div>
  );
}
