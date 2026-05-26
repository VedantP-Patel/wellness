// src/app/api/rewards/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Points today and total
  const today = new Date().toISOString().split("T")[0];
  const { data: todayPoints } = await supabase
    .from("user_points")
    .select("points")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  const { data: totalPoints } = await supabase
    .rpc("get_total_points", { user_id: user.id }); // we can just sum, or create an RPC

  // Streaks
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("hydration_streak, exercise_streak, combined_streak")
    .eq("user_id", user.id)
    .single();

  // Badges
  const { data: badges } = await supabase
    .from("badges")
    .select("badge_key, earned_at")
    .eq("user_id", user.id);

  return NextResponse.json({
    points_today: todayPoints?.points || 0,
    total_points: await getTotalPoints(supabase, user.id),
    streaks: profile || { hydration_streak: 0, exercise_streak: 0, combined_streak: 0 },
    badges: badges || [],
  });
}

async function getTotalPoints(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_points")
    .select("points")
    .eq("user_id", userId);
  if (error || !data) return 0;
  return data.reduce((sum: number, row: any) => sum + row.points, 0);
}