"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { Document, Project, TrackerItem, TrackerItemStatus, resolvePercent } from "@/lib/types";
import CompletionBadge from "@/components/CompletionBadge";
import TrackerTable from "@/components/TrackerTable";
import Documents from "@/components/Documents";
import SheetSync from "@/components/SheetSync";
import GoogleConnect from "@/components/GoogleConnect";
import NotesUpdate from "@/components/NotesUpdate";

export default function ProjectDetail({
  initialProject,
  initialTrackerItems,
  initialDocuments,
  googleConnected,
  googleEmail,
  readOnly,
}: {
  initialProject: Project;
  initialTrackerItems: TrackerItem[];
  initialDocuments: Document[];
  googleConnected: boolean;
  googleEmail: string | null;
  readOnly: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const googleError = searchParams.get("google_error");

  const [project, setProject] = useState<Project>(initialProject);
  const [trackerItems, setTrackerItems] = useState<TrackerItem[]>(initialTrackerItems);
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showNotesUpdate, setShowNotesUpdate] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    // initialProject can be served from Next.js's client router cache, so
    // re-fetch the live row rather than trusting it alone (e.g. after a sheet
    // sync from another tab/session).
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("id", initialProject.id)
        .single();
      if (!cancelled && data) setProject(data);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProject.id]);

  async function handleFieldChange(
    patch: Partial<
      Pick<
        Project,
        | "start_date"
        | "eta"
        | "tracker_sheet_url"
        | "tracker_percent_cell"
        | "tracker_percent_numerator_cell"
        | "tracker_percent_denominator_cell"
        | "tracker_label_column"
        | "tracker_value_column"
        | "tracker_numerator_labels"
        | "tracker_denominator_label"
        | "tracker_start_date_cell"
        | "tracker_eta_cell"
      >
    >
  ) {
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, ...patch }));
    }
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/sync-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const body = await res.json();
      if (!res.ok) {
        setSyncError(body.error ?? "Sync failed.");
      } else {
        setProject((prev) => ({
          ...prev,
          ...(body.percent !== null
            ? { tracker_percent_cached: body.percent, tracker_percent_synced_at: body.syncedAt }
            : {}),
          ...(body.startDate ? { start_date: body.startDate } : {}),
          ...(body.eta ? { eta: body.eta } : {}),
        }));
      }
    } catch {
      setSyncError("Sync failed — could not reach the server.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleReadmeSave(readme: string) {
    const { error } = await supabase.from("projects").update({ readme }).eq("id", project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, readme }));
    }
  }

  async function handleAddTrackerItem(item: {
    task: string;
    owner: string;
    deadline: string | null;
  }) {
    const { data, error } = await supabase
      .from("tracker_items")
      .insert({ ...item, project_id: project.id })
      .select()
      .single();
    if (!error && data) {
      setTrackerItems((prev) => [...prev, data]);
    }
  }

  async function handleUpdateTrackerItem(id: string, patch: Partial<TrackerItem>) {
    const { error } = await supabase.from("tracker_items").update(patch).eq("id", id);
    if (!error) {
      setTrackerItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }
  }

  async function handleDeleteTrackerItem(id: string) {
    const { error } = await supabase.from("tracker_items").delete().eq("id", id);
    if (!error) {
      setTrackerItems((prev) => prev.filter((i) => i.id !== id));
    }
  }

  async function handleAddTrackerItemWithStatus(item: {
    task: string;
    owner: string;
    status: TrackerItemStatus;
    deadline: string | null;
  }) {
    const { data, error } = await supabase
      .from("tracker_items")
      .insert({ ...item, project_id: project.id })
      .select()
      .single();
    if (!error && data) {
      setTrackerItems((prev) => [...prev, data]);
    }
  }

  async function handleSaveNotesSnapshot(rawNotes: string) {
    const { error } = await supabase
      .from("projects")
      .update({ last_notes_raw: rawNotes })
      .eq("id", project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, last_notes_raw: rawNotes }));
    }
  }

  async function handleAddDocument(input: Partial<Document>) {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        project_id: project.id,
        subject: "",
        recipients: "",
        body: "",
        link_url: null,
        link_title: null,
        link_kind: null,
        link_icon: null,
        ...input,
      })
      .select()
      .single();
    if (!error && data) {
      setDocuments((prev) => [...prev, data]);
    }
  }

  async function handleUpdateDocument(id: string, patch: Partial<Document>) {
    const { error } = await supabase.from("documents").update(patch).eq("id", id);
    if (!error) {
      setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    }
  }

  async function handleDeleteDocument(id: string) {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (!error) {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  }

  async function handleDeleteProject() {
    const { error } = await supabase.from("projects").delete().eq("id", project.id);
    if (!error) {
      router.push("/");
    }
  }

  const done = trackerItems.filter((i) => i.status === "done").length;
  const canSync = Boolean(
    project.tracker_sheet_url &&
      (project.tracker_percent_cell ||
        (project.tracker_percent_numerator_cell && project.tracker_percent_denominator_cell) ||
        (project.tracker_label_column &&
          project.tracker_value_column &&
          project.tracker_numerator_labels &&
          project.tracker_denominator_label) ||
        project.tracker_start_date_cell ||
        project.tracker_eta_cell)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/" className="mb-4 inline-block text-sm text-slate-500 hover:text-slate-700">
        ← All projects
      </Link>

      {googleError && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{googleError}</p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-semibold">{project.name}</h1>
            <CompletionBadge
              done={done}
              total={trackerItems.length}
              sheetPercent={project.tracker_percent_cached}
            />
            {!readOnly && canSync && (
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing}
                title="Re-fetch the % from the linked Google Sheet"
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-40"
              >
                {syncing ? "Syncing..." : "⟳ Sync now"}
              </button>
            )}
          </div>

          {!readOnly &&
            (confirmingDelete ? (
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1.5 text-sm">
                <span className="text-red-700">Delete this project?</span>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="font-medium text-red-700 hover:underline"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="text-slate-500 hover:underline"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-slate-400 hover:text-red-600"
              >
                Delete project
              </button>
            ))}
        </div>

        {(() => {
          const percent = resolvePercent({ done, total: trackerItems.length }, project.tracker_percent_cached);
          if (project.tracker_percent_cached !== null) {
            return (
              <p className="mt-2 text-xs text-slate-400">
                Showing {percent}% synced from your linked Google Sheet — this takes priority
                over tracker-task completion while it's set.
              </p>
            );
          }
          if (trackerItems.length > 0) {
            return (
              <p className="mt-2 text-xs text-slate-400">
                Showing {percent}% based on {done}/{trackerItems.length} tracker tasks done — no
                Google Sheet % synced yet.
              </p>
            );
          }
          return null;
        })()}

        {syncError && (
          <p className="mt-2 text-sm text-red-600">{syncError}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Start date
            {readOnly ? (
              <span className="text-slate-500">{project.start_date ?? "—"}</span>
            ) : (
              <input
                key={project.start_date ?? "empty"}
                type="date"
                defaultValue={project.start_date ?? ""}
                onBlur={(e) =>
                  e.target.value !== (project.start_date ?? "") &&
                  handleFieldChange({ start_date: e.target.value || null })
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            )}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            ETA
            {readOnly ? (
              <span className="text-slate-500">{project.eta ?? "—"}</span>
            ) : (
              <input
                key={project.eta ?? "empty"}
                type="date"
                defaultValue={project.eta ?? ""}
                onBlur={(e) =>
                  e.target.value !== (project.eta ?? "") &&
                  handleFieldChange({ eta: e.target.value || null })
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              />
            )}
          </label>
        </div>

        <div className="mt-8 space-y-8">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">README / Instructions</h3>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setShowNotesUpdate((v) => !v)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white"
                >
                  {showNotesUpdate ? "Cancel update" : "Update notes"}
                </button>
              )}
            </div>

            <div className="prose prose-sm max-w-none rounded-md border border-slate-200 bg-white p-4">
              {project.readme.trim() ? (
                <ReactMarkdown>{project.readme}</ReactMarkdown>
              ) : (
                <p className="text-slate-400">Nothing here yet.</p>
              )}
            </div>

            {!readOnly && showNotesUpdate && (
              <div className="mt-4">
                <NotesUpdate
                  projectId={project.id}
                  trackerItems={trackerItems}
                  onReadmeSave={handleReadmeSave}
                  onUpdateTrackerItem={handleUpdateTrackerItem}
                  onDeleteTrackerItem={handleDeleteTrackerItem}
                  onAddTrackerItem={handleAddTrackerItemWithStatus}
                  onSaveNotesSnapshot={handleSaveNotesSnapshot}
                  onApplied={() => setShowNotesUpdate(false)}
                />
              </div>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-700">Google Sheet tracker</h3>
              {!readOnly && (
                <GoogleConnect
                  connected={googleConnected}
                  connectedEmail={googleEmail}
                  returnTo={`/projects/${project.id}`}
                />
              )}
            </div>
            <SheetSync project={project} onFieldChange={handleFieldChange} readOnly={readOnly} />
          </section>

          <section>
            <TrackerTable
              items={trackerItems}
              onAdd={handleAddTrackerItem}
              onUpdate={handleUpdateTrackerItem}
              onDelete={handleDeleteTrackerItem}
              readOnly={readOnly}
            />
          </section>

          <section>
            <Documents
              documents={documents}
              onAdd={handleAddDocument}
              onUpdate={handleUpdateDocument}
              onDelete={handleDeleteDocument}
              readOnly={readOnly}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
