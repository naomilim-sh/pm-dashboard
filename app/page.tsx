import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeDashboard from "@/components/HomeDashboard";
import { ProjectProgress } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: projects }, { data: trackerItems }, { data: googleToken }] = await Promise.all([
    supabase.from("projects").select("*").order("created_at", { ascending: true }),
    supabase.from("tracker_items").select("project_id, status"),
    supabase.from("google_tokens").select("connected_email").eq("user_id", user.id).maybeSingle(),
  ]);

  const progressByProject: Record<string, ProjectProgress> = {};
  for (const item of trackerItems ?? []) {
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
    />
  );
}
