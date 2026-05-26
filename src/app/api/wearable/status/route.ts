// src/app/api/wearable/status/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: token } = await supabase
    .from("wearable_tokens")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ connected: !!token });
}