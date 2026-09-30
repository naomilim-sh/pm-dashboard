"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { createClient } from "@/lib/supabase/client";
import { Document, Project, TrackerItem, TrackerItemStatus, resolvePercent } from "@/lib/types";
import { STATUS_STYLE, EtaLabel } from "@/components/ProjectTile";
import ChasePicsTag from "@/components/ChasePicsTag";
import { chaseLevel, statusOf } from "@/lib/projectStatus";
import TrackerTable from "@/components/TrackerTable";
import Documents from "@/components/Documents";
import SheetSync from "@/components/SheetSync";
import GoogleConnect from "@/components/GoogleConnect";
import NotesUpdate from "@/components/NotesUpdate";
import { useDismissed } from "@/lib/useDismissed";

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
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [tipDismissed, dismissTip] = useDismissed("pm-dashboard:smart-notes-tip-dismissed");
  const notesRef = useRef<HTMLElement>(null);

  function openSmartNotes() {
    setShowNotesUpdate(true);
    dismissTip();
    requestAnimationFrame(() =>
      notesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  // Arriving from the home page's Smart Notes promo (?smart_notes=1) opens
  // the panel straight away.
  useEffect(() => {
    if (!readOnly && searchParams.get("smart_notes") === "1") openSmartNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleNameSave(name: string) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === project.name) return;
    const { error } = await supabase.from("projects").update({ name: trimmed }).eq("id", project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, name: trimmed }));
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

  async function handleBackupBeforeApply() {
    const patch = {
      readme_backup: project.readme,
      tracker_backup: trackerItems,
      backup_created_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
    if (!error) {
      setProject((prev) => ({ ...prev, ...patch }));
    }
  }

  async function handleRestoreBackup() {
    if (!project.backup_created_at) return;
    setRestoring(true);

    const readme = project.readme_backup ?? "";
    const backupItems = project.tracker_backup ?? [];

    const { error: readmeError } = await supabase
      .from("projects")
      .update({ readme })
      .eq("id", project.id);
    if (!readmeError) {
      setProject((prev) => ({ ...prev, readme }));
    }

    await supabase.from("tracker_items").delete().eq("project_id", project.id);
    if (backupItems.length > 0) {
      const { data } = await supabase
        .from("tracker_items")
        .insert(
          backupItems.map((t) => ({
            id: t.id,
            project_id: project.id,
            task: t.task,
            owner: t.owner,
            status: t.status,
            deadline: t.deadline,
            created_at: t.created_at,
          }))
        )
        .select();
      setTrackerItems(data ?? []);
    } else {
      setTrackerItems([]);
    }

    setRestoring(false);
    setConfirmingRestore(false);
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

  const percent = resolvePercent({ done, total: trackerItems.length }, project.tracker_percent_cached);
  const status = statusOf(project, percent);
  const style = STATUS_STYLE[status];
  const chase = chaseLevel(project, status);
  const headerNumber: Record<typeof status, string> = {
    overdue: "text-red-400",
    in_progress: "text-white",
    not_started: "text-white",
    done: "text-emerald-400",
    archived: "text-navy-200",
  };
  const card = "rounded-2xl bg-white p-5 ring-1 ring-slate-200";
  const sectionTitle = "text-sm font-bold uppercase tracking-wider text-navy-800";
  const darkDate =
    "rounded-md border border-navy-700 bg-navy-900 px-2 py-1 text-sm font-semibold text-white [color-scheme:dark] focus:border-shopee focus:outline-none";

  return (
    <div className="min-h-screen">
      <header className="border-b-4 border-shopee bg-navy-950 text-navy-50">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-sm font-black tracking-tight">
              PM<span className="text-shopee">/</span>Dashboard
            </Link>
            <Link href="/" className="text-sm font-semibold text-navy-200 hover:text-white">
              ← All projects
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${style.pill}`}>
              {style.label}
            </span>
            <ChasePicsTag level={chase} />
          </div>

          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            {readOnly ? (
              <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{project.name}</h1>
            ) : (
              <input
                key={project.name}
                defaultValue={project.name}
                size={Math.max(project.name.length, 8)}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  if (!value) {
                    e.target.value = project.name;
                    return;
                  }
                  handleNameSave(value);
                }}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                title="Click to rename"
                className="-mx-1.5 min-w-0 max-w-full rounded-md border border-transparent bg-transparent px-1.5 text-2xl font-black tracking-tight text-white hover:border-navy-700 focus:border-shopee focus:outline-none sm:text-3xl"
              />
            )}

            {!readOnly && (
              <div className="flex items-center gap-2 text-sm">
                {canSync && (
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={syncing}
                    title="Re-fetch the % from the linked Google Sheet"
                    className="rounded-lg bg-shopee px-3 py-1.5 font-bold text-white shadow-lg shadow-shopee/30 hover:bg-shopee-400 disabled:opacity-50"
                  >
                    {syncing ? "Syncing..." : "⟳ Sync now"}
                  </button>
                )}
                {confirmingDelete ? (
                  <div className="flex items-center gap-2 rounded-lg bg-red-950/60 px-3 py-1.5 ring-1 ring-red-800">
                    <span className="text-red-200">Delete this project?</span>
                    <button
                      type="button"
                      onClick={handleDeleteProject}
                      className="font-bold text-red-300 hover:underline"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="text-navy-200 hover:underline"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="rounded-lg border border-navy-700 px-3 py-1.5 text-navy-200 hover:border-red-700 hover:text-red-300"
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-navy-800 pt-4 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-navy-300">Complete</dt>
              <dd className={`mt-0.5 text-2xl font-black tabular-nums ${headerNumber[status]}`}>
                {percent === null ? "—" : `${percent}%`}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-navy-300">Tasks done</dt>
              <dd className="mt-0.5 text-2xl font-black tabular-nums text-white">
                {trackerItems.length === 0 ? "—" : `${done}/${trackerItems.length}`}
              </dd>
            </div>
            <div>
              <dt className="mb-1 text-xs font-semibold uppercase tracking-wider text-navy-300">Start date</dt>
              <dd>
                {readOnly ? (
                  <span className="text-lg font-bold text-white">{project.start_date ?? "—"}</span>
                ) : (
                  <input
                    key={project.start_date ?? "empty"}
                    type="date"
                    defaultValue={project.start_date ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (project.start_date ?? "") &&
                      handleFieldChange({ start_date: e.target.value || null })
                    }
                    className={darkDate}
                  />
                )}
              </dd>
            </div>
            <div>
              <dt className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-navy-300">
                ETA
                {status !== "done" && status !== "archived" && project.eta && (
                  <span className="normal-case tracking-normal" suppressHydrationWarning>
                    <EtaLabel eta={project.eta} status={status} onDark />
                  </span>
                )}
              </dt>
              <dd>
                {readOnly ? (
                  <span className="text-lg font-bold text-white">{project.eta ?? "—"}</span>
                ) : (
                  <input
                    key={project.eta ?? "empty"}
                    type="date"
                    defaultValue={project.eta ?? ""}
                    onBlur={(e) =>
                      e.target.value !== (project.eta ?? "") &&
                      handleFieldChange({ eta: e.target.value || null })
                    }
                    className={darkDate}
                  />
                )}
              </dd>
            </div>
          </dl>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-navy-800">
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${percent ?? 0}%` }} />
          </div>
          <p className="mt-2 text-xs text-navy-300">
            {project.tracker_percent_cached !== null
              ? `${percent}% synced from your linked Google Sheet — this takes priority over tracker-task completion while it's set.`
              : trackerItems.length > 0
                ? `${percent}% based on ${done}/${trackerItems.length} tracker tasks done — no Google Sheet % synced yet.`
                : "No progress data yet — add tracker tasks or link a Google Sheet."}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">
        {googleError && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{googleError}</p>
        )}
        {syncError && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{syncError}</p>}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <section ref={notesRef} className={`${card} scroll-mt-4`}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className={sectionTitle}>README / Instructions</h3>
                {!readOnly &&
                  (showNotesUpdate ? (
                    <button
                      type="button"
                      onClick={() => setShowNotesUpdate(false)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Close Smart Notes
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openSmartNotes}
                      className="relative rounded-lg bg-shopee px-3 py-1.5 text-sm font-bold text-white shadow-md shadow-shopee/30 hover:bg-shopee-600"
                    >
                      ✨ Smart Notes
                      {!tipDismissed && (
                        <span className="absolute -right-2 -top-2 rounded-full bg-navy-900 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white ring-2 ring-white">
                          New
                        </span>
                      )}
                    </button>
                  ))}
              </div>

              {!readOnly && !showNotesUpdate && !tipDismissed && (
                <div className="mb-3 flex items-start gap-3 rounded-xl bg-navy-50 p-3 text-sm ring-1 ring-navy-200">
                  <span className="text-lg leading-none" aria-hidden>
                    ✨
                  </span>
                  <div className="flex-1">
                    <p className="font-bold text-navy-900">Let your notes do the admin.</p>
                    <p className="mt-0.5 text-navy-700">
                      Paste what was said in your last sync — Smart Notes spots finished tasks, new
                      action items, owners and deadlines, and refreshes this README. Nothing changes
                      until you approve it.
                    </p>
                    <button
                      type="button"
                      onClick={openSmartNotes}
                      className="mt-2 font-bold text-shopee hover:text-shopee-700"
                    >
                      Try Smart Notes →
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={dismissTip}
                    title="Dismiss"
                    className="rounded-md px-1 text-navy-400 hover:bg-navy-200/50 hover:text-navy-900"
                  >
                    ✕
                  </button>
                </div>
              )}

            {!readOnly && showNotesUpdate && (
              <div className="mb-4 rounded-xl bg-shopee-50/60 p-4 ring-1 ring-shopee-200">
                <NotesUpdate
                  projectId={project.id}
                  trackerItems={trackerItems}
                  onReadmeSave={handleReadmeSave}
                  onUpdateTrackerItem={handleUpdateTrackerItem}
                  onDeleteTrackerItem={handleDeleteTrackerItem}
                  onAddTrackerItem={handleAddTrackerItemWithStatus}
                  onSaveNotesSnapshot={handleSaveNotesSnapshot}
                  onBackupBeforeApply={handleBackupBeforeApply}
                  onApplied={() => setShowNotesUpdate(false)}
                />
              </div>
            )}

              <div className="prose prose-sm max-w-none rounded-xl border-l-4 border-navy-600 bg-navy-50/50 p-4 prose-headings:text-navy-900 prose-strong:text-navy-900 prose-a:text-navy-600">
                {project.readme.trim() ? (
                  <ReactMarkdown>{project.readme}</ReactMarkdown>
                ) : (
                  <p className="text-slate-400">Nothing here yet.</p>
                )}
              </div>


            {!readOnly && project.backup_created_at && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>
                  Backup from{" "}
                  {new Date(project.backup_created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}{" "}
                  (before the last notes update)
                </span>
                {confirmingRestore ? (
                  <>
                    <span className="text-red-600">Restore it? This replaces the current README and tracker.</span>
                    <button
                      type="button"
                      onClick={handleRestoreBackup}
                      disabled={restoring}
                      className="font-medium text-red-600 hover:underline disabled:opacity-40"
                    >
                      {restoring ? "Restoring..." : "Yes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingRestore(false)}
                      className="hover:underline"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingRestore(true)}
                    className="underline hover:text-slate-600"
                  >
                    Restore previous version
                  </button>
                )}
              </div>
            )}
            </section>

            <section className={card}>
              <TrackerTable
                items={trackerItems}
                onAdd={handleAddTrackerItem}
                onUpdate={handleUpdateTrackerItem}
                onDelete={handleDeleteTrackerItem}
                readOnly={readOnly}
              />
            </section>
          </div>

          <div className="space-y-5">
            <section className={card}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className={sectionTitle}>Google Sheet</h3>
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

            <section className={card}>
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
      </main>
    </div>
  );
}
