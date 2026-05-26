// src/app/api/planner/adjust-hydration/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get profile for wake/sleep times
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("wake_time, sleep_time, daily_goal_ml")
    .eq("user_id", user.id)
    .single();

  const wake = profile?.wake_time ?? 7;
  const sleep = profile?.sleep_time ?? 22;
  const goal = profile?.daily_goal_ml ?? 2000;

  // Get today's water entries
  const today = new Date().toISOString().split("T")[0];
  const { data: entries } = await supabase
    .from("water_entries")
    .select("amount_ml, logged_at")
    .eq("user_id", user.id)
    .eq("date", today);

  const totalIntake = entries?.reduce((sum, e) => sum + e.amount_ml, 0) || 0;

  // Get upcoming uncompleted hydration tasks
  const now = new Date();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: tasks } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("user_id", user.id)
    .eq("task_type", "hydration")
    .eq("completed", false)
    .gte("scheduled_time", now.toISOString())
    .lt("scheduled_time", todayEnd.toISOString())
    .order("scheduled_time", { ascending: true });

  if (!tasks || tasks.length === 0) {
    return NextResponse.json({ message: "No upcoming hydration tasks." });
  }

  // Calculate remaining time until sleep
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const sleepHour = sleep;
  const remainingHours = Math.max(sleepHour - nowHour, 0.1);

  const remainingGoal = Math.max(goal - totalIntake, 0);
  // Ideal amount per remaining task (spread across upcoming tasks)
  const amountPerTask = Math.round(remainingGoal / tasks.length);

  // Apply to each task, but enforce min 150ml
  for (const task of tasks) {
    const newAmount = Math.max(150, amountPerTask);
    await supabase
      .from("planner_tasks")
      .update({ amount_ml: newAmount })
      .eq("id", task.id);
  }

  return NextResponse.json({
    adjusted: tasks.length,
    newAmount: Math.max(150, amountPerTask),
  });
}