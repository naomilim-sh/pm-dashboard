function stripMarkdown(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^[-*+]\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

// Pulls a short preview line out of a project's README to show on its home
// pill — prefers the first sentence under an "Overview" heading (how the
// notes-update feature writes READMEs), falling back to the first real line.
export function extractReadmePreview(readme: string, maxLength = 140): string | null {
  const lines = readme.split("\n").map((l) => l.trim());

  const overviewIdx = lines.findIndex((l) => /^#{1,6}\s*overview\b/i.test(l));
  const searchFrom = overviewIdx >= 0 ? overviewIdx + 1 : 0;

  let candidate: string | null = null;
  for (let i = searchFrom; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (/^#{1,6}\s/.test(line)) {
      if (overviewIdx >= 0) break; // hit the next heading — overview section ended
      continue;
    }
    candidate = stripMarkdown(line);
    if (candidate) break;
  }

  if (!candidate) return null;
  return candidate.length > maxLength ? `${candidate.slice(0, maxLength - 1).trimEnd()}…` : candidate;
}
