import { Project } from "@/lib/types";

export type ProjectStatus = "overdue" | "in_progress" | "not_started" | "done" | "archived";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00`);
}

export function startOfToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

export function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.round((parseDate(d).getTime() - startOfToday().getTime()) / DAY_MS);
}

export function formatDate(d: string | null) {
  if (!d) return "—";
  return parseDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function statusOf(project: Project, percent: number | null): ProjectStatus {
  if (project.archived_at) return "archived";
  if (percent === 100) return "done";
  const days = daysUntil(project.eta);
  if (days !== null && days < 0) return "overdue";
  if (!percent) return "not_started";
  return "in_progress";
}

// "Chase PICs?" nudges: a soft reminder from one month out, escalating to an
// urgent one in the final two weeks. Nothing for finished/archived/overdue
// projects — overdue has its own, louder label.
export type ChaseLevel = "month" | "two_weeks" | null;

export function chaseLevel(project: Project, status: ProjectStatus): ChaseLevel {
  if (status === "done" || status === "archived" || status === "overdue") return null;
  const days = daysUntil(project.eta);
  if (days === null || days < 0) return null;
  if (days <= 14) return "two_weeks";
  if (days <= 30) return "month";
  return null;
}
