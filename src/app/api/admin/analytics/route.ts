// src/app/api/admin/analytics/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 1. Most suggested benefits (from planner_feedback benefit_rating)
  const { data: benefitRatings } = await supabase
    .from("planner_feedback")
    .select("benefit_rating, task_id")
    .gte("benefit_rating", 1);

  const benefitCounts: Record<string, { total: number; sum: number }> = {};
  // We need to join with tasks to get benefits, but for simplicity we can aggregate the benefit rating numbers themselves.
  // This would require a more complex query. We'll approximate by counting tasks rated positively.
  // For a quick analytics, we can count exercises that have been completed and rated.
  const { data: completedTasks } = await supabase
    .from("planner_tasks")
    .select("id, exercise_id")
    .eq("completed", true)
    .eq("task_type", "exercise")
    .limit(1000);

  const exerciseBenefitMap: Record<string, any> = {};
  // Fetch exercises
  const exerciseIds = [...new Set(completedTasks?.map(t => t.exercise_id) || [])];
  if (exerciseIds.length > 0) {
    const { data: exercises } = await supabase
      .from("exercise_library")
      .select("id, benefits")
      .in("id", exerciseIds);
    exercises?.forEach(ex => { exerciseBenefitMap[ex.id] = ex.benefits; });
  }

  // Count benefits
  const benefitFrequency: Record<string, number> = {};
  (completedTasks || []).forEach(task => {
    const benefits = exerciseBenefitMap[task.exercise_id] || [];
    benefits.forEach((b: string) => {
      benefitFrequency[b] = (benefitFrequency[b] || 0) + 1;
    });
  });

  // Sort by count
  const topBenefits = Object.entries(benefitFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 2. Popular exercises (most completed)
  // Workaround: Aggregate in JavaScript since Supabase JS client lacks .group()
  const exerciseCounts: Record<string, number> = {};
  
  (completedTasks || []).forEach(task => {
    if (task.exercise_id) {
      exerciseCounts[task.exercise_id] = (exerciseCounts[task.exercise_id] || 0) + 1;
    }
  });

  const popularExercises = Object.entries(exerciseCounts)
    .map(([exercise_id, count]) => ({ exercise_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 3. Feedback summary
  const { count: totalFeedback, data: feedbackSum } = await supabase
    .from("planner_feedback")
    .select("user_rating")
    .not("user_rating", "is", null);

  const helpfulCount = feedbackSum?.filter((f: any) => f.user_rating === true).length || 0;
  const unhelpfulCount = (feedbackSum?.length || 0) - helpfulCount;

  return NextResponse.json({
    topBenefits,
    popularExercises,
    feedback: { total: feedbackSum?.length || 0, helpful: helpfulCount, unhelpful: unhelpfulCount },
  });
}