import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeDashboard from "@/components/HomeDashboard";
import { ProjectProgress } from "@/lib/types";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Attach this login to any pending "view my dashboard" invite addressed to
  // this exact (verified) email — a no-op once already claimed.
  if (user.email) {
    await supabase
      .from("dashboard_viewers")
      .update({ viewer_user_id: user.id })
      .is("viewer_user_id", null)
      .ilike("invited_email", user.email);
  }

  const [{ data: viewableOwners }, { data: myViewers }] = await Promise.all([
    supabase
      .from("dashboard_viewers")
      .select("owner_user_id, owner_email")
      .eq("viewer_user_id", user.id),
    supabase
      .from("dashboard_viewers")
      .select("id, invited_email, viewer_user_id, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: true }),
  ]);

  const isViewingOther = Boolean(view && view !== user.id);
  const viewedOwner = isViewingOther
    ? (viewableOwners ?? []).find((o) => o.owner_user_id === view)
    : undefined;
  // Fall back to your own dashboard if `view` doesn't match a real, granted invite.
  const activeOwnerId = viewedOwner ? viewedOwner.owner_user_id : user.id;
  const readOnly = Boolean(viewedOwner);

  const [{ data: projects }, { data: trackerItems }, { data: googleToken }] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("user_id", activeOwnerId)
      .order("created_at", { ascending: true }),
    supabase.from("tracker_items").select("project_id, status"),
    readOnly
      ? Promise.resolve({ data: null })
      : supabase.from("google_tokens").select("connected_email").eq("user_id", user.id).maybeSingle(),
  ]);

  const ownProjectIds = new Set((projects ?? []).map((p) => p.id));
  const progressByProject: Record<string, ProjectProgress> = {};
  for (const item of trackerItems ?? []) {
    if (!ownProjectIds.has(item.project_id)) continue;
    const entry = progressByProject[item.project_id] ?? { done: 0, total: 0 };
    entry.total += 1;
    if (item.status === "done") entry.done += 1;
    progressByProject[item.project_id] = entry;
  }

  return (
    <HomeDashboard
      userEmail={user.email ?? ""}
      initialProjects={projects ?? []}
      progressByProject={progressByProject}
      googleConnected={Boolean(googleToken)}
      googleEmail={googleToken?.connected_email ?? null}
      readOnly={readOnly}
      viewedOwnerId={viewedOwner?.owner_user_id ?? null}
      viewedOwnerEmail={viewedOwner?.owner_email ?? null}
      viewableOwners={viewableOwners ?? []}
      myViewers={myViewers ?? []}
    />
  );
}
