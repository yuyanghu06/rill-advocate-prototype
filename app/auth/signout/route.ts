import { NextResponse } from "next/server";
import { getAuthServerClient } from "@/lib/supabase.server";

export async function POST() {
  const supabase = await getAuthServerClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/auth", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
