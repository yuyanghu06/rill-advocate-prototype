import { NextRequest, NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

/**
 * POST /api/bug-report
 *
 * Accepts a bug report with optional screenshot files (multipart/form-data).
 * Uploads screenshots to the bug-screenshots Storage bucket, then inserts
 * a row into bug_reports with the resulting URLs.
 *
 * Form fields:
 *   title        string  (required)
 *   description  string  (required)
 *   page_url     string  (optional — current page the user was on)
 *   screenshots  File[]  (optional, up to 3, png/jpg/webp/gif, max 5 MB each)
 */
export async function POST(req: NextRequest) {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const title       = (form.get("title") as string | null)?.trim();
  const description = (form.get("description") as string | null)?.trim();
  const page_url    = (form.get("page_url") as string | null)?.trim() || null;

  if (!title || !description) {
    return NextResponse.json(
      { error: "title and description are required" },
      { status: 400 }
    );
  }

  const screenshots = form.getAll("screenshots") as File[];
  const db = getServerClient();
  const screenshotUrls: string[] = [];

  for (const file of screenshots.slice(0, 3)) {
    if (!file.size) continue;
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await db.storage
      .from("bug-screenshots")
      .upload(path, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error("Screenshot upload failed:", uploadError.message);
      continue;
    }

    const { data: signed } = await db.storage
      .from("bug-screenshots")
      .createSignedUrl(path, 60 * 60 * 24 * 30); // 30-day signed URL

    if (signed?.signedUrl) screenshotUrls.push(signed.signedUrl);
  }

  const { error } = await db.from("bug_reports").insert({
    user_id:         user.id,
    user_email:      user.email,
    title,
    description,
    page_url,
    screenshot_urls: screenshotUrls,
    status:          "open",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
