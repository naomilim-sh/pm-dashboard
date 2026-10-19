import type { SupabaseClient } from "@supabase/supabase-js";

// Review mode lives on projects.review_status (see supabase/schema.sql):
// starting a review flags the given projects 'pending' (the caller passes the
// incomplete ones — "done" is computed client-side from sheet % / tasks); a Smart Notes apply
// or "No updates" flips one to 'reviewed'; closing clears them all to null.

function friendly(error: { message: string } | null): string | null {
  if (!error) return null;
  if (error.message.includes("review_status")) {
    return "Review mode needs a one-time database update: run the review_status lines from supabase/schema.sql in the Supabase SQL editor.";
  }
  return error.message;
}

export async function startReview(supabase: SupabaseClient, projectIds: string[]) {
  const { error } = await supabase
    .from("projects")
    .update({ review_status: "pending" })
    .in("id", projectIds);
  return friendly(error);
}

export async function endReview(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase
    .from("projects")
    .update({ review_status: null })
    .eq("user_id", userId)
    .not("review_status", "is", null);
  return friendly(error);
}

export async function markReviewed(supabase: SupabaseClient, projectId: string) {
  const { error } = await supabase
    .from("projects")
    .update({ review_status: "reviewed" })
    .eq("id", projectId);
  return friendly(error);
}

export async function countPending(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("review_status", "pending");
  return count ?? 0;
}
