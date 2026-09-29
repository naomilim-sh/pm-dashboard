import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProjectDetail from "@/components/ProjectDetail";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    redirect("/");
  }

  // Not the owner but RLS still let the select through — must be a
  // dashboard viewer (see the "*_viewer_select" policies in schema.sql).
  const readOnly = project.user_id !== user.id;

  const [{ data: trackerItems }, { data: documents }, { data: googleToken }] = await Promise.all([
    supabase
      .from("tracker_items")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    readOnly
      ? Promise.resolve({ data: null })
      : supabase.from("google_tokens").select("connected_email").eq("user_id", user.id).maybeSingle(),
  ]);

  return (
    <ProjectDetail
      initialProject={project}
      initialTrackerItems={trackerItems ?? []}
      initialDocuments={documents ?? []}
      googleConnected={Boolean(googleToken)}
      googleEmail={googleToken?.connected_email ?? null}
      readOnly={readOnly}
    />
  );
}
