import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessToken } from "@/lib/googleAuth";
import {
  extractPercent,
  fetchCellValue,
  fetchCellValues,
  fetchSheetGrid,
  findValueByLabel,
  parsePlainNumber,
} from "@/lib/googleSheet";
import { parseDateFlexible } from "@/lib/sheetImport";

function computeRatioPercent(
  numeratorValues: (string | null)[],
  denominatorValue: string | null
): { percent: number } | { error: string } {
  const numeratorNumbers = numeratorValues.map((v) => parsePlainNumber(v ?? ""));
  const denominator = parsePlainNumber(denominatorValue ?? "");

  if (numeratorNumbers.some((n) => n === null) || denominator === null) {
    return {
      error: `Done/total don't all contain readable numbers (found: "${numeratorValues.join(", ")}" / "${denominatorValue ?? ""}").`,
    };
  }
  if (denominator === 0) {
    return { error: "Total is 0 — can't divide." };
  }
  const numerator = numeratorNumbers.reduce((sum, n) => sum! + n!, 0)!;
  return { percent: (numerator / denominator) * 100 };
}

export async function POST(request: Request) {
  const { projectId } = await request.json();
  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId." }, { status: 400 });
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
    .select(
      "id, tracker_sheet_url, tracker_percent_cell, tracker_percent_numerator_cell, tracker_percent_denominator_cell, tracker_label_column, tracker_value_column, tracker_numerator_labels, tracker_denominator_label, tracker_start_date_cell, tracker_eta_cell"
    )
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }
  if (!project.tracker_sheet_url) {
    return NextResponse.json({ error: "Set the sheet URL first." }, { status: 400 });
  }

  const useLabels =
    project.tracker_label_column &&
    project.tracker_value_column &&
    project.tracker_numerator_labels &&
    project.tracker_denominator_label;
  const useRatio =
    !useLabels && project.tracker_percent_numerator_cell && project.tracker_percent_denominator_cell;
  const hasPercentConfig = Boolean(useLabels || useRatio || project.tracker_percent_cell);
  const hasDateConfig = Boolean(project.tracker_start_date_cell || project.tracker_eta_cell);
  // Dates reuse the label/value column config if it's set up, regardless of
  // which mode is driving the percent (or even if percent isn't configured).
  const datesUseLabels = Boolean(project.tracker_label_column && project.tracker_value_column);

  if (!hasPercentConfig && !hasDateConfig) {
    return NextResponse.json(
      {
        error:
          "Set either the % cell, the done/total cells, the label-based lookup, or a start/ETA date source.",
      },
      { status: 400 }
    );
  }

  let percent: number | null = null;
  let startDate: string | null = null;
  let eta: string | null = null;

  try {
    const accessToken = await getUserAccessToken(supabase, user.id);
    let grid: string[][] | null = null;
    const getGrid = async () => {
      if (!grid) grid = await fetchSheetGrid(project.tracker_sheet_url!, accessToken);
      return grid;
    };

    if (hasPercentConfig) {
      if (useLabels) {
        const sheetGrid = await getGrid();
        const numeratorLabels = (project.tracker_numerator_labels as string)
          .split(",")
          .map((l: string) => l.trim())
          .filter(Boolean);

        const numeratorValues = numeratorLabels.map((label: string) =>
          findValueByLabel(sheetGrid, project.tracker_label_column!, project.tracker_value_column!, label)
        );
        const denominatorValue = findValueByLabel(
          sheetGrid,
          project.tracker_label_column!,
          project.tracker_value_column!,
          project.tracker_denominator_label!
        );

        const result = computeRatioPercent(numeratorValues, denominatorValue);
        if ("error" in result) {
          return NextResponse.json(
            {
              error: `${result.error} Check the labels match a row in column ${project.tracker_label_column} exactly.`,
            },
            { status: 422 }
          );
        }
        percent = result.percent;
      } else if (useRatio) {
        // The numerator cell field accepts a comma-separated list of cells to sum
        // (e.g. "D6,D13" for Done + Won't-do), so a single sheet cell isn't required.
        const numeratorRefs = (project.tracker_percent_numerator_cell as string)
          .split(",")
          .map((r: string) => r.trim())
          .filter(Boolean);

        const [numeratorValues, denominatorValue] = await Promise.all([
          fetchCellValues(project.tracker_sheet_url, numeratorRefs, accessToken),
          fetchCellValue(
            project.tracker_sheet_url,
            project.tracker_percent_denominator_cell!,
            accessToken
          ),
        ]);

        const result = computeRatioPercent(numeratorValues, denominatorValue);
        if ("error" in result) {
          return NextResponse.json({ error: result.error }, { status: 422 });
        }
        percent = result.percent;
      } else {
        const cellValue = await fetchCellValue(
          project.tracker_sheet_url,
          project.tracker_percent_cell!,
          accessToken
        );
        percent = extractPercent(cellValue ?? "");
        if (percent === null) {
          return NextResponse.json(
            {
              error: `Cell ${project.tracker_percent_cell} doesn't contain a readable number (found: "${cellValue ?? ""}").`,
            },
            { status: 422 }
          );
        }
      }
    }

    if (project.tracker_start_date_cell) {
      const raw = datesUseLabels
        ? findValueByLabel(
            await getGrid(),
            project.tracker_label_column!,
            project.tracker_value_column!,
            project.tracker_start_date_cell
          )
        : await fetchCellValue(project.tracker_sheet_url, project.tracker_start_date_cell, accessToken);
      startDate = parseDateFlexible(raw ?? "");
    }

    if (project.tracker_eta_cell) {
      const raw = datesUseLabels
        ? findValueByLabel(
            await getGrid(),
            project.tracker_label_column!,
            project.tracker_value_column!,
            project.tracker_eta_cell
          )
        : await fetchCellValue(project.tracker_sheet_url, project.tracker_eta_cell, accessToken);
      eta = parseDateFlexible(raw ?? "");
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read the sheet." },
      { status: 502 }
    );
  }

  const syncedAt = new Date().toISOString();
  const patch: Record<string, unknown> = {};
  if (hasPercentConfig && percent !== null) {
    patch.tracker_percent_cached = percent;
    patch.tracker_percent_synced_at = syncedAt;
  }
  if (project.tracker_start_date_cell && startDate) patch.start_date = startDate;
  if (project.tracker_eta_cell && eta) patch.eta = eta;

  if (Object.keys(patch).length > 0) {
    const { error: updateError } = await supabase.from("projects").update(patch).eq("id", projectId);
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ percent, syncedAt, startDate, eta });
}
