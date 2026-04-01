import { NextRequest, NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase.server";
import { getServerClient } from "@/lib/supabase";

/**
 * PATCH /api/settings/profile
 * Body: { display_name?, headline?, is_visible? }
 */
export async function PATCH(req: NextRequest) {
  const supabase = await getAuthServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    display_name?: string;
    headline?: string;
    is_visible?: boolean;
    company_name?: string;
    avatar_url?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if (body.display_name !== undefined) updates.display_name = body.display_name.trim();
  if (body.headline !== undefined) updates.headline = body.headline.trim();
  if (body.is_visible !== undefined) updates.is_visible = body.is_visible;
  if (body.company_name !== undefined) updates.company_name = body.company_name.trim() || null;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const db = getServerClient();
  const { error } = await db
    .from("user_profiles")
    .update(updates)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
