import { TrackerItemStatus } from "@/lib/types";

export type ImportedTrackerRow = {
  task: string;
  owner: string;
  status: TrackerItemStatus;
  deadline: string | null;
};

export type SheetImportResult = {
  headerRowIndex: number;
  columns: {
    task: number | null;
    owner: number | null;
    status: number | null;
    deadline: number | null;
  };
  rows: ImportedTrackerRow[];
};

const TASK_KEYWORDS = ["task", "mcp name", "name", "system type", "address", "subject", "title", "item"];
const OWNER_KEYWORDS = ["pic", "owner", "assignee", "responsible"];
const STATUS_KEYWORDS = ["status"];
const DEADLINE_KEYWORDS = ["eta", "deadline", "due"];

/** Sheets often have title/summary rows above the real header; pick the row
 * with the most filled-in cells (within the first 10 rows) as the header. */
function findHeaderRow(grid: string[][]): number {
  let bestIdx = 0;
  let bestCount = -1;
  const searchLimit = Math.min(grid.length, 10);
  for (let i = 0; i < searchLimit; i++) {
    const count = (grid[i] ?? []).filter((c) => c && c.trim()).length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function findColumn(header: string[], keywords: string[]): number | null {
  for (const kw of keywords) {
    const idx = header.findIndex((h) => h && h.toLowerCase().includes(kw));
    if (idx !== -1) return idx;
  }
  return null;
}

function columnCardinality(grid: string[][], col: number, headerRowIndex: number): number {
  const values = new Set<string>();
  for (let r = headerRowIndex + 1; r < grid.length; r++) {
    const v = grid[r]?.[col];
    if (v && v.trim()) values.add(v.trim());
  }
  return values.size;
}

/** Picks the column that best identifies each row (e.g. a URL or unique
 * name), not just the first column whose header happens to match a keyword —
 * a low-cardinality category column like "System Type" (Harbor/Airflow/...)
 * would make a poor, repetitive task label even if its header contains "type". */
function findTaskColumn(
  grid: string[][],
  header: string[],
  headerRowIndex: number,
  excludedCols: (number | null)[]
): number | null {
  const excluded = new Set(excludedCols.filter((c): c is number => c !== null));
  const cardinalities = header.map((_, c) =>
    excluded.has(c) ? -1 : columnCardinality(grid, c, headerRowIndex)
  );
  const maxCardinality = Math.max(...cardinalities, 0);
  if (maxCardinality <= 0) return null;

  // Only consider columns that are reasonably unique per row, not categories.
  const candidates = cardinalities
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v > 0 && v >= maxCardinality * 0.6)
    .map(({ i }) => i);

  for (const kw of TASK_KEYWORDS) {
    const match = candidates.find((i) => header[i] && header[i].toLowerCase().includes(kw));
    if (match !== undefined) return match;
  }

  return candidates[0] ?? null;
}

function mapStatus(raw: string): TrackerItemStatus {
  const lower = raw.toLowerCase();
  if (lower.includes("done")) return "done";
  if (lower.includes("progress") || lower.includes("doing") || lower.includes("ongoing")) {
    return "in_progress";
  }
  return "todo";
}

function isoFrom(y: string, m: string, d: string): string | null {
  const year = parseInt(y, 10);
  const month = parseInt(m, 10);
  const day = parseInt(d, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

/** Best-effort date parsing across the handful of formats seen in practice
 * (ISO, dot-separated, day-first slash-separated, and month-name dates —
 * the latter two searched anywhere in the string rather than anchored, since
 * a date is often embedded in a longer sentence like "Deadline: 31 July
 * 2026"). Returns null rather than guess wrong. */
export function parseDateFlexible(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return isoFrom(m[1], m[2], m[3]);

  m = s.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})$/);
  if (m) return isoFrom(m[1], m[2], m[3]);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoFrom(m[3], m[2], m[1]);

  // "31 July 2026" / "31 Jul 2026", possibly embedded in a longer sentence.
  m = s.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m) {
    const month = MONTH_NAMES[m[2].toLowerCase()];
    if (month) return isoFrom(m[3], String(month), m[1]);
  }

  // "July 31, 2026" / "July 31 2026", possibly embedded in a longer sentence.
  m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const month = MONTH_NAMES[m[1].toLowerCase()];
    if (month) return isoFrom(m[3], String(month), m[2]);
  }

  return null;
}

export function parseTrackerSheet(grid: string[][]): SheetImportResult {
  const headerRowIndex = findHeaderRow(grid);
  const header = grid[headerRowIndex] ?? [];

  const statusCol = findColumn(header, STATUS_KEYWORDS);
  const ownerCol = findColumn(header, OWNER_KEYWORDS);
  const deadlineCol = findColumn(header, DEADLINE_KEYWORDS);
  const taskCol = findTaskColumn(grid, header, headerRowIndex, [statusCol, ownerCol, deadlineCol]);

  const rows: ImportedTrackerRow[] = [];
  if (taskCol !== null) {
    for (let r = headerRowIndex + 1; r < grid.length; r++) {
      const row = grid[r] ?? [];
      const task = (row[taskCol] ?? "").trim();
      if (!task) continue;

      const owner = ownerCol !== null ? (row[ownerCol] ?? "").trim() : "";
      const statusRaw = statusCol !== null ? (row[statusCol] ?? "").trim() : "";
      const status = statusRaw ? mapStatus(statusRaw) : "todo";
      const deadlineRaw = deadlineCol !== null ? (row[deadlineCol] ?? "").trim() : "";
      const deadline = deadlineRaw ? parseDateFlexible(deadlineRaw) : null;

      rows.push({ task, owner, status, deadline });
    }
  }

  return {
    headerRowIndex,
    columns: { task: taskCol, owner: ownerCol, status: statusCol, deadline: deadlineCol },
    rows,
  };
}
