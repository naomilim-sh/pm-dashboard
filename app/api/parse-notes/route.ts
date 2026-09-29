import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NotesUpdateProposal, TrackerItem } from "@/lib/types";

const TOOL_NAME = "propose_project_updates";

const TOOL_PARAMETERS = {
  type: "object",
  properties: {
    readme_summary: {
      type: ["string", "null"],
      description:
        "The FULL replacement README text (markdown), rewritten as a current, concise snapshot — not an addition to append. Null if nothing needs to change.",
    },
    tracker_updates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          new_status: {
            type: ["string", "null"],
            enum: ["todo", "in_progress", "done", null],
          },
          new_owner: { type: ["string", "null"] },
          new_deadline: {
            type: ["string", "null"],
            description: "ISO date YYYY-MM-DD, or null",
          },
          reason: { type: "string" },
        },
        required: ["task_id", "reason"],
      },
    },
    new_tasks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          owner: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          deadline: { type: ["string", "null"] },
          reason: { type: "string" },
        },
        required: ["task", "status", "reason"],
      },
    },
  },
  required: ["tracker_updates", "new_tasks"],
};

function buildPrompt(
  readme: string,
  trackerItems: TrackerItem[],
  previousNotes: string | null,
  newNotes: string
): string {
  const trackerList = trackerItems.length
    ? trackerItems
        .map(
          (t) =>
            `- id=${t.id} | task="${t.task}" | owner="${t.owner}" | status=${t.status} | deadline=${t.deadline ?? "none"}`
        )
        .join("\n")
    : "(no tracker items yet)";

  return `You help a project manager keep their project dashboard in sync with quick notes they jot down while working.

## Current README
${readme || "(empty)"}

## Current open/tracked tasks
${trackerList}

## Notes from last time this was run (may be empty if this is the first run)
${previousNotes ? previousNotes : "(none — this is the first update for this project)"}

## New notes just written
${newNotes}

Compare the new notes to the previous notes and the current tasks — actually diff them, don't just scan the new notes in isolation. Figure out:
1. Which existing tasks (by id) changed status, owner, or deadline based on what's newly written. IMPORTANT: if a task is now finished, set new_status to "done" — it will be *removed* from the tracker entirely (not left sitting there marked done), so the tracker stays a clean list of what's still pending.
2. Deletions by omission: if a task's topic was described in the *previous* notes but has been removed — no longer mentioned anywhere in the *new* notes — treat that omission itself as a done/resolved signal, even though nothing explicitly says "done" or "finished". These notes represent a full rewritten snapshot each time the PM updates them, so deliberately cutting a chunk means it's no longer active — set new_status to "done" for the corresponding task(s) just as if it had been stated outright. Only hold back on this if the new notes are obviously a short one-off aside about a single unrelated thing rather than a rewritten summary (e.g. much shorter and narrower in scope than the previous notes) — when genuinely unsure, prefer treating a dropped topic as resolved. Tasks that were never mentioned in the previous notes either are simply unrelated to this diff and should be left alone.
3. Any new action items mentioned in the notes that aren't already tracked as a task — propose them as new tasks.
4. The README should always read as a current, concise snapshot of what's pending and important — never a dated changelog, and never carrying forward content about a topic that was dropped from the notes per point 2 above. Rewrite it (readme_summary) as the FULL new README text: carry forward anything still relevant, drop or rewrite bullet points about items that are now resolved or removed (don't just keep appending "Update — <date>" sections), and fold in new context/decisions from the notes. Return null only if truly nothing about it needs to change.

Do not invent information that isn't in the notes. Every tracker_updates and new_tasks entry needs a short "reason" grounded in the actual note text — for a deletion-by-omission, say so explicitly (e.g. "no longer mentioned in the new notes; was present before").`;
}

export async function POST(request: Request) {
  const { projectId, notes } = await request.json();
  if (!projectId || !notes || !notes.trim()) {
    return NextResponse.json({ error: "Missing projectId or notes." }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, readme, last_notes_raw")
    .eq("id", projectId)
    .single();
  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: trackerItems, error: trackerError } = await supabase
    .from("tracker_items")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (trackerError) {
    return NextResponse.json({ error: trackerError.message }, { status: 500 });
  }

  const prompt = buildPrompt(project.readme, trackerItems ?? [], project.last_notes_raw, notes);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
      tools: [
        {
          name: TOOL_NAME,
          description:
            "Propose structured updates to a project's tracker and README based on new notes.",
          input_schema: TOOL_PARAMETERS,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: `Claude API request failed (${res.status}): ${body}` },
      { status: 502 }
    );
  }

  const data = await res.json();
  const toolUse = (data.content ?? []).find(
    (block: { type: string }) => block.type === "tool_use"
  );
  if (!toolUse) {
    return NextResponse.json({ error: "Claude didn't return a structured proposal." }, { status: 502 });
  }

  const proposal = toolUse.input as NotesUpdateProposal;
  // Models sometimes emit literal "\n" text instead of a real line break
  // inside JSON string values — normalize so the markdown renders correctly.
  if (proposal.readme_summary) {
    proposal.readme_summary = proposal.readme_summary.replace(/\\n/g, "\n");
  }
  return NextResponse.json({ proposal });
}
