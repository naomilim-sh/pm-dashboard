import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessToken } from "@/lib/googleAuth";
import { fetchSheetGrid, fetchSheetMeta } from "@/lib/googleSheet";
import { parseTrackerSheet } from "@/lib/sheetImport";

export async function POST(request: Request) {
  const { sheetUrl, startDate, eta } = await request.json();
  if (!sheetUrl) {
    return NextResponse.json({ error: "Missing sheetUrl." }, { status: 400 });
  }
  if (!startDate || !eta) {
    return NextResponse.json(
      { error: "Start date and ETA are required for every new project." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let meta: Awaited<ReturnType<typeof fetchSheetMeta>>;
  let grid: string[][];
  try {
    const accessToken = await getUserAccessToken(supabase, user.id);
    [meta, grid] = await Promise.all([
      fetchSheetMeta(sheetUrl, accessToken),
      fetchSheetGrid(sheetUrl, accessToken),
    ]);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read the sheet." },
      { status: 502 }
    );
  }

  const parsed = parseTrackerSheet(grid);
  if (parsed.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Could not find any task rows in that sheet — check it has a header row with data below it.",
      },
      { status: 422 }
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      name: meta.spreadsheetTitle,
      tracker_sheet_url: sheetUrl,
      start_date: startDate,
      eta,
    })
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? "Failed to create project." },
      { status: 500 }
    );
  }

  const { error: itemsError } = await supabase.from("tracker_items").insert(
    parsed.rows.map((r) => ({
      project_id: project.id,
      task: r.task,
      owner: r.owner,
      status: r.status,
      deadline: r.deadline,
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  return NextResponse.json({
    projectId: project.id,
    imported: parsed.rows.length,
    columns: parsed.columns,
  });
}
