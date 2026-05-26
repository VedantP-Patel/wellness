// src/app/api/planner/regenerate/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  // Delete all incomplete tasks for today
  const { error: deleteError } = await supabase
    .from("planner_tasks")
    .delete()
    .eq("user_id", user.id)
    .gte("scheduled_time", todayStart.toISOString())
    .lt("scheduled_time", todayEnd.toISOString())
    .eq("completed", false);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Return empty – the frontend will refetch GET /api/planner to regenerate
  return NextResponse.json({ success: true });
}