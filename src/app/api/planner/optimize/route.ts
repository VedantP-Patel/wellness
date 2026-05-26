// src/app/api/planner/optimize/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface TimeSlotStats {
  total: number;
  completed: number;
}

interface FamilyStats {
  total: number;
  completed: number;
}

interface BenefitStats {
  totalRatings: number;
  sumRatings: number;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Fetch tasks from the past 7 days (completed + feedback)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: tasks, error: tasksError } = await supabase
    .from("planner_tasks")
    .select("id, task_type, scheduled_time, completed, exercise_id, suggestion_reason")
    .eq("user_id", user.id)
    .gte("scheduled_time", sevenDaysAgo.toISOString())
    .order("scheduled_time", { ascending: false });

  if (tasksError || !tasks) {
    return NextResponse.json({ error: tasksError?.message || "No tasks" }, { status: 500 });
  }

  // 2. Fetch feedback for these tasks
  const taskIds = tasks.map(t => t.id);
  const { data: feedbacks, error: fbError } = await supabase
    .from("planner_feedback")
    .select("task_id, user_rating, benefit_rating")
    .in("task_id", taskIds);

  if (fbError) {
    return NextResponse.json({ error: fbError.message }, { status: 500 });
  }

  const feedbackMap = new Map(feedbacks?.map(f => [f.task_id, f]) || []);

  // 3. Aggregate stats
  const timeSlots: Record<string, TimeSlotStats> = {}; // hour as key
  const families: Record<string, FamilyStats> = {};
  const benefits: Record<string, BenefitStats> = {};

  tasks.forEach(task => {
    const hour = new Date(task.scheduled_time).getHours().toString();
    if (!timeSlots[hour]) timeSlots[hour] = { total: 0, completed: 0 };
    timeSlots[hour].total++;

    const family = task.exercise_id?.family || task.task_type;
    if (!families[family]) families[family] = { total: 0, completed: 0 };
    families[family].total++;

    if (task.completed) {
      timeSlots[hour].completed++;
      families[family].completed++;
    }

    const fb = feedbackMap.get(task.id);
    if (fb && task.task_type === "exercise") {
      const exBenefits = task.exercise_id?.benefits || [];
      exBenefits.forEach((b: string) => {
        if (!benefits[b]) benefits[b] = { totalRatings: 0, sumRatings: 0 };
        benefits[b].totalRatings++;
        benefits[b].sumRatings += fb.benefit_rating || 0;
      });
    }
  });

  // 4. Build preferences
  const avoidHours: string[] = [];
  for (const [hour, stats] of Object.entries(timeSlots)) {
    if (stats.total >= 3 && stats.completed === 0) {
      avoidHours.push(hour);
    }
  }

  const avoidFamilies: string[] = [];
  for (const [family, stats] of Object.entries(families)) {
    if (stats.total >= 5 && stats.completed / stats.total < 0.2) {
      avoidFamilies.push(family);
    }
  }

  const benefitBoosts: Record<string, number> = {};
  const benefitDowngrades: Record<string, number> = {};
  for (const [benefit, stats] of Object.entries(benefits)) {
    if (stats.totalRatings >= 3) {
      const avg = stats.sumRatings / stats.totalRatings;
      if (avg >= 4) benefitBoosts[benefit] = (avg - 3) * 0.5; // +0.5..1.0
      if (avg <= 2) benefitDowngrades[benefit] = (3 - avg) * 0.5;
    }
  }

  const preferences = {
    avoidHours,
    avoidFamilies,
    benefitBoosts,
    benefitDowngrades,
    lastOptimized: new Date().toISOString(),
  };

  // 5. Save to user_profiles
  const { error: updateError } = await supabase
    .from("user_profiles")
    .update({ planner_preferences: preferences })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ preferences });
}