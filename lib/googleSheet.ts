export function parseSheetUrl(url: string): { sheetId: string; gid: string } | null {
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;

  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : "0" };
}

export function isValidCellRef(ref: string): boolean {
  return /^[A-Za-z]+[0-9]+$/.test(ref.trim());
}

export function extractPercent(rawValue: string): number | null {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  const hadPercentSign = trimmed.includes("%");
  const num = parseFloat(trimmed.replace(/%/g, "").replace(/,/g, ""));
  if (isNaN(num)) return null;

  if (hadPercentSign) return num;
  // A bare fraction like 0.76 means 76%; a bare number like 76 already means 76%.
  return num <= 1 ? num * 100 : num;
}

export function parsePlainNumber(rawValue: string): number | null {
  if (!rawValue) return null;
  const num = parseFloat(rawValue.trim().replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

export function isValidColumnLetter(col: string): boolean {
  return /^[A-Za-z]+$/.test(col.trim());
}

function columnLetterToIndex(letter: string): number {
  let col = 0;
  for (const ch of letter.trim().toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 64);
  }
  return col - 1;
}

/**
 * Finds a value by scanning a label column for an exact (trimmed,
 * case-insensitive) match, then reading the value column on that same row.
 * Robust to pivot-table row shifts, unlike a fixed cell reference — the row
 * position doesn't matter, only the label text.
 */
export function findValueByLabel(
  grid: string[][],
  labelColumn: string,
  valueColumn: string,
  label: string
): string | null {
  const labelIdx = columnLetterToIndex(labelColumn);
  const valueIdx = columnLetterToIndex(valueColumn);
  const target = label.trim().toLowerCase();

  for (const row of grid) {
    const cell = (row[labelIdx] ?? "").trim().toLowerCase();
    if (cell === target) {
      return row[valueIdx] ?? null;
    }
  }
  return null;
}

function authFailureHint(status: number): string {
  return status === 401 || status === 403
    ? " Your Google connection may have lost access to this sheet, or it's no longer shared with you."
    : "";
}

async function getSheetMeta(
  sheetId: string,
  gid: string,
  accessToken: string
): Promise<{ spreadsheetTitle: string; tabTitle: string }> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=properties.title,sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not read sheet metadata (${res.status}).${authFailureHint(res.status)} ${body}`);
  }
  const data = await res.json();
  const sheet = (data.sheets ?? []).find(
    (s: { properties: { sheetId: number } }) => String(s.properties.sheetId) === gid
  );
  if (!sheet) {
    throw new Error(`Could not find a tab matching gid=${gid} in that spreadsheet.`);
  }
  return { spreadsheetTitle: data.properties?.title ?? "Untitled", tabTitle: sheet.properties.title };
}

async function getSheetTabTitle(sheetId: string, gid: string, accessToken: string): Promise<string> {
  const { tabTitle } = await getSheetMeta(sheetId, gid, accessToken);
  return tabTitle;
}

/** Spreadsheet title + resolved tab title for the tab a sheet URL's gid points to. */
export async function fetchSheetMeta(
  sheetUrl: string,
  accessToken: string
): Promise<{ spreadsheetTitle: string; tabTitle: string }> {
  const sheetRef = parseSheetUrl(sheetUrl);
  if (!sheetRef) throw new Error("Could not parse that Google Sheet URL.");
  return getSheetMeta(sheetRef.sheetId, sheetRef.gid, accessToken);
}

/** Fetches the full used grid of a sheet's tab (bounded to keep imports sane). */
export async function fetchSheetGrid(
  sheetUrl: string,
  accessToken: string,
  maxRows = 2000
): Promise<string[][]> {
  const sheetRef = parseSheetUrl(sheetUrl);
  if (!sheetRef) throw new Error("Could not parse that Google Sheet URL.");

  const tabTitle = await getSheetTabTitle(sheetRef.sheetId, sheetRef.gid, accessToken);
  const range = encodeURIComponent(`${tabTitle}!A1:Z${maxRows}`);

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetRef.sheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not read sheet data (${res.status}).${authFailureHint(res.status)} ${body}`);
  }
  const data = await res.json();
  return data.values ?? [];
}

export async function fetchCellValue(
  sheetUrl: string,
  cellRef: string,
  accessToken: string
): Promise<string | null> {
  const [value] = await fetchCellValues(sheetUrl, [cellRef], accessToken);
  return value;
}

/** Fetches multiple cells from the same sheet/tab in one batched request. */
export async function fetchCellValues(
  sheetUrl: string,
  cellRefs: string[],
  accessToken: string
): Promise<(string | null)[]> {
  const sheetRef = parseSheetUrl(sheetUrl);
  if (!sheetRef) throw new Error("Could not parse that Google Sheet URL.");
  for (const ref of cellRefs) {
    if (!isValidCellRef(ref)) {
      throw new Error(`Invalid cell reference "${ref}" — use e.g. B2.`);
    }
  }

  const tabTitle = await getSheetTabTitle(sheetRef.sheetId, sheetRef.gid, accessToken);
  const ranges = cellRefs
    .map((ref) => `ranges=${encodeURIComponent(`${tabTitle}!${ref}`)}`)
    .join("&");

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetRef.sheetId}/values:batchGet?${ranges}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Could not read cells ${cellRefs.join(", ")} (${res.status}).${authFailureHint(res.status)} ${body}`
    );
  }

  const data = await res.json();
  const valueRanges: { values?: string[][] }[] = data.valueRanges ?? [];
  return valueRanges.map((vr) => {
    const value = vr.values?.[0]?.[0];
    return value !== undefined ? String(value) : null;
  });
}
