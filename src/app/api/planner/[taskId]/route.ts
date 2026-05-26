// src/app/api/planner/[taskId]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { taskId: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = params.taskId;
  const { data: task, error: fetchError } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  if (task.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (task.completed) return NextResponse.json({ error: "Already completed" }, { status: 400 });

  // Determine points
  const points = task.task_type === "hydration" ? 10 : 20;

  // Mark task completed
  const { error: updateError } = await supabase
    .from("planner_tasks")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      points_earned: points,
    })
    .eq("id", taskId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  // If hydration task, also create water entry
  if (task.task_type === "hydration" && task.amount_ml) {
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("water_entries").insert({
      user_id: user.id,
      amount_ml: task.amount_ml,
      source: "planner",
      date: today,
    });
  }

  // Update points for today
  const today = new Date().toISOString().split("T")[0];
  const { data: pointsRow } = await supabase
    .from("user_points")
    .select("points")
    .eq("user_id", user.id)
    .eq("date", today)
    .maybeSingle();

  if (pointsRow) {
    await supabase
      .from("user_points")
      .update({ points: pointsRow.points + points })
      .eq("user_id", user.id)
      .eq("date", today);
  } else {
    await supabase.from("user_points").insert({
      user_id: user.id,
      date: today,
      points: points,
    });
  }

  // Update streaks (simplified: call a function)
  await updateStreaks(supabase, user.id, task.task_type, points);

  // Check and award badges
  await checkBadges(supabase, user.id, task);

  return NextResponse.json({ success: true, points_earned: points });
}

// Helper: update streaks
async function updateStreaks(supabase: any, userId: string, taskType: string, points: number) {
  const todayStr = new Date().toISOString().split("T")[0];
  // Fetch current streak values
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("hydration_streak, exercise_streak, combined_streak, last_streak_date")
    .eq("user_id", userId)
    .single();

  if (!profile) return;

  const lastDate = profile.last_streak_date ? new Date(profile.last_streak_date).toISOString().split("T")[0] : null;
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

  const isConsecutive = lastDate === yesterday || lastDate === todayStr;
  // We'll increment if activity today and (either first activity or consecutive)
  const updates: any = { last_streak_date: todayStr };

  if (isConsecutive || !lastDate) {
    // increment streaks
    if (taskType === "hydration") {
      updates.hydration_streak = (profile.hydration_streak || 0) + 1;
    } else {
      updates.exercise_streak = (profile.exercise_streak || 0) + 1;
    }
    updates.combined_streak = (profile.combined_streak || 0) + 1;
  } else {
    // reset to 1
    if (taskType === "hydration") {
      updates.hydration_streak = 1;
      updates.exercise_streak = profile.exercise_streak || 0;
    } else {
      updates.exercise_streak = 1;
      updates.hydration_streak = profile.hydration_streak || 0;
    }
    updates.combined_streak = 1;
  }

  await supabase
    .from("user_profiles")
    .update(updates)
    .eq("user_id", userId);
}

// Badge definitions
const BADGES = {
  early_bird: { name: "Early Bird", condition: async (supabase: any, userId: string) => {
    const { data } = await supabase.from("water_entries")
      .select("logged_at").eq("user_id", userId)
      .gte("logged_at", new Date(new Date().setHours(5,0,0,0)).toISOString())
      .lt("logged_at", new Date(new Date().setHours(7,0,0,0)).toISOString())
      .limit(1);
    return data && data.length > 0;
  }},
  gym_hero: { name: "Gym Hero", condition: async (supabase: any, userId: string) => {
    const { count } = await supabase.from("planner_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("task_type", "exercise")
      .eq("completed", true);
    return count >= 10;
  }},
  // more can be defined similarly
};

async function checkBadges(supabase: any, userId: string, task: any) {
  for (const [key, badge] of Object.entries(BADGES)) {
    // check if already earned
    const { data: existing } = await supabase
      .from("badges")
      .select("id")
      .eq("user_id", userId)
      .eq("badge_key", key)
      .maybeSingle();
    if (existing) continue;

    const earned = await badge.condition(supabase, userId);
    if (earned) {
      await supabase.from("badges").insert({ user_id: userId, badge_key: key });
    }
  }
}