export type Project = {
  id: string;
  user_id: string;
  name: string;
  start_date: string | null;
  eta: string | null;
  readme: string;
  tracker_sheet_url: string | null;
  tracker_percent_cell: string | null;
  tracker_percent_numerator_cell: string | null;
  tracker_percent_denominator_cell: string | null;
  tracker_percent_cached: number | null;
  tracker_percent_synced_at: string | null;
  last_notes_raw: string | null;
  tracker_label_column: string | null;
  tracker_value_column: string | null;
  tracker_numerator_labels: string | null;
  tracker_denominator_label: string | null;
  tracker_start_date_cell: string | null;
  tracker_eta_cell: string | null;
  created_at: string;
  updated_at: string;
};

export type TrackerItemStatus = "todo" | "in_progress" | "done";

export type TrackerItem = {
  id: string;
  project_id: string;
  task: string;
  owner: string;
  status: TrackerItemStatus;
  deadline: string | null;
  created_at: string;
};

// A project "document": either a plain email draft (subject/recipients/body)
// or a pasted Google Docs/Slides/Sheets link (link_url set, with
// link_title/link_kind/link_icon auto-fetched from Drive).
export type Document = {
  id: string;
  project_id: string;
  subject: string;
  recipients: string;
  body: string;
  link_url: string | null;
  link_title: string | null;
  link_kind: string | null;
  link_icon: string | null;
  created_at: string;
  updated_at: string;
};

// An invite for someone to view an owner's *entire* dashboard, read-only.
// viewer_user_id is null until the invited person first logs in with a
// matching email (see the "claim_own_invite" RLS policy in schema.sql).
export type DashboardViewer = {
  id: string;
  owner_user_id: string;
  owner_email: string;
  invited_email: string;
  viewer_user_id: string | null;
  created_at: string;
};

export type ProjectProgress = {
  done: number;
  total: number;
};

export type NotesUpdateProposal = {
  // The full replacement README text (a rewritten, current snapshot) — not
  // an addition to append. Null if nothing about it needs to change.
  readme_summary: string | null;
  tracker_updates: {
    task_id: string;
    // "done" means the task is finished and will be *removed* from the
    // tracker, not just flagged, so the tracker stays a list of what's
    // pending. Anything else just updates the row in place.
    new_status: TrackerItemStatus | null;
    new_owner: string | null;
    new_deadline: string | null;
    reason: string;
  }[];
  new_tasks: {
    task: string;
    owner: string;
    status: TrackerItemStatus;
    deadline: string | null;
    reason: string;
  }[];
};

export function resolvePercent(
  progress: ProjectProgress,
  sheetPercent?: number | null
): number | null {
  if (sheetPercent !== undefined && sheetPercent !== null) {
    return Math.round(sheetPercent);
  }
  if (progress.total === 0) return null;
  return Math.round((progress.done / progress.total) * 100);
}
