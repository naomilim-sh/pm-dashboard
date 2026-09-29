import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessToken } from "@/lib/googleAuth";
import { fetchDriveFileMeta } from "@/lib/googleDrive";

export async function POST(request: Request) {
  const { url } = await request.json();
  if (!url) {
    return NextResponse.json({ error: "Missing url." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const accessToken = await getUserAccessToken(supabase, user.id);
    const meta = await fetchDriveFileMeta(url, accessToken);
    return NextResponse.json(meta);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to read that link." },
      { status: 502 }
    );
  }
}
