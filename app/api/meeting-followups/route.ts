import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// "Meeting follow-ups" mode of Smart Notes: turns whatever the PM pasted after
// a catch-up into a short list of things to clarify. It deliberately does NOT
// look at or touch the README/tracker — that's the general update mode.

const FOLLOWUPS_SCHEMA = {
  type: "object",
  properties: {
    followups: {
      type: "array",
      items: { type: "string" },
      description: "One short line per follow-up item, in the order they appear in the notes.",
    },
  },
  required: ["followups"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You tidy a project manager's raw notes from a catch-up meeting into a short follow-up list.

Every point in the notes is something the PM wants to clarify or chase after the meeting. Rewrite each one as a single short line in note style — roughly 4 to 14 words, no full sentences needed, no trailing period. Keep names, owners, dates, and system names exactly as written. Merge points that are clearly duplicates. Do not drop any distinct point, do not add anything that isn't in the notes, and do not add numbering or bullet characters.`;

const client = new Anthropic();

export async function POST(request: Request) {
  const { projectId, notes } = await request.json();
  if (!projectId || typeof notes !== "string" || !notes.trim()) {
    return NextResponse.json({ error: "Missing projectId or notes." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
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

  // RLS limits this to projects the caller owns.
  const { data: project } = await supabase.from("projects").select("id").eq("id", projectId).single();
  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4096,
      // Short rewrite task — low effort keeps it quick.
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: FOLLOWUPS_SCHEMA },
      },
      // If a safety classifier declines, retry server-side on Anthropic's
      // recommended fallback model instead of failing the request.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: notes }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Claude declined to process these notes. Try rephrasing them." },
        { status: 422 }
      );
    }
    if (response.stop_reason === "max_tokens") {
      return NextResponse.json(
        { error: "These notes are too long to tidy in one go — try splitting them." },
        { status: 422 }
      );
    }

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ error: "Claude didn't return a follow-up list." }, { status: 502 });
    }
    const parsed = JSON.parse(text.text) as { followups: string[] };
    const followups = parsed.followups.map((f) => f.trim()).filter(Boolean);
    return NextResponse.json({ followups });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json({ error: "Claude is busy right now — try again in a minute." }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API request failed (${error.status}): ${error.message}` },
        { status: 502 }
      );
    }
    throw error;
  }
}
