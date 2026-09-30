export function extractDriveFileId(url: string): string | null {
  const dMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (dMatch) return dMatch[1];
  const idParam = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  return idParam ? idParam[1] : null;
}

const MIME_KIND: Record<string, { kind: string; icon: string }> = {
  "application/vnd.google-apps.document": { kind: "Google Doc", icon: "📄" },
  "application/vnd.google-apps.spreadsheet": { kind: "Google Sheet", icon: "📊" },
  "application/vnd.google-apps.presentation": { kind: "Google Slides", icon: "📽️" },
  "application/vnd.google-apps.form": { kind: "Google Form", icon: "📝" },
  "application/pdf": { kind: "PDF", icon: "📕" },
};

export function isGoogleLink(value: string): boolean {
  return /^https?:\/\//.test(value.trim()) && /google\.com\//.test(value.trim());
}

export async function fetchDriveFileMeta(
  url: string,
  accessToken: string
): Promise<{ title: string; kind: string; icon: string }> {
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    throw new Error("Couldn't find a Google file ID in that link.");
  }

  // supportsAllDrives is required or Drive API returns a bare 404 for files
  // that live in a Shared/Team Drive rather than the user's own My Drive,
  // even when they have full access to it.
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to read that document's title (${res.status}): ${body}`);
  }

  const data = await res.json();
  const meta = MIME_KIND[data.mimeType as string] ?? { kind: "Link", icon: "🔗" };
  return { title: data.name as string, kind: meta.kind, icon: meta.icon };
}
