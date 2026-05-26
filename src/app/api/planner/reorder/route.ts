// src/app/api/planner/reorder/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { taskIds } = await request.json(); // array of task IDs in new order (non‑completed)
  if (!Array.isArray(taskIds) || taskIds.length < 1) {
    return NextResponse.json({ error: "taskIds array required" }, { status: 400 });
  }

  // Get user's wake/sleep hours
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("wake_time, sleep_time")
    .eq("user_id", user.id)
    .single();

  const wakeHour = profile?.wake_time ?? 7;
  const sleepHour = profile?.sleep_time ?? 22;
  const totalSlots = taskIds.length;

  // Calculate new times: spread evenly between wake and sleep
  const newTimes: Date[] = [];
  const startHour = wakeHour;
  const endHour = sleepHour;
  const interval = (endHour - startHour) / (totalSlots + 1); // avoid placing at exact start/end

  for (let i = 0; i < totalSlots; i++) {
    const hour = startHour + interval * (i + 1);
    const date = new Date();
    date.setHours(Math.floor(hour), (hour % 1) * 60, 0, 0);
    newTimes.push(date);
  }

  // Update each task with new scheduled_time
  const updates = taskIds.map((id, index) => {
    return supabase
      .from("planner_tasks")
      .update({ scheduled_time: newTimes[index].toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("completed", false); // only update uncompleted tasks
  });

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.map(e => e.error?.message).join(", ") }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}