// src/app/api/suggest-exercises/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_group: string;
  difficulty: number;
  benefits: string[];
  target_audience: string[];
  impact_level: number;
  equipment_needed: string;
  family: string;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // 2. Fetch all approved exercises
  const { data: allExercises, error: exError } = await supabase
    .from("exercise_library")
    .select("*")
    .eq("approved", true);

  if (exError || !allExercises) {
    return NextResponse.json({ error: exError?.message || "No exercises" }, { status: 500 });
  }

  // 3. Apply optional equipment filter based on gym_mode
  let candidateExercises: Exercise[] = allExercises;
  if (!profile.gym_mode) {
    // Exclude gym-specific equipment if gym_mode is off
    candidateExercises = allExercises.filter(
      (ex) => ex.equipment_needed === "none" || ex.equipment_needed === "bodyweight"
    );
  }

  // 4. Fetch past exercise completions (last 30 days) for completion rate
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const { data: pastTasks } = await supabase
    .from("planner_tasks")
    .select("exercise_id, completed, created_at")
    .eq("user_id", user.id)
    .eq("task_type", "exercise")
    .gte("created_at", thirtyDaysAgo.toISOString());

  const familyCompletion: Record<string, { completed: number; total: number }> = {};
  pastTasks?.forEach((t) => {
    if (!t.exercise_id) return;
    const ex = candidateExercises.find((e) => e.id === t.exercise_id);
    if (!ex) return;
    const family = ex.family;
    if (!familyCompletion[family]) familyCompletion[family] = { completed: 0, total: 0 };
    familyCompletion[family].total++;
    if (t.completed) familyCompletion[family].completed++;
  });

  const getCompletionRate = (family: string): number => {
    const data = familyCompletion[family];
    if (!data || data.total === 0) return 0.5; // default neutral
    return data.completed / data.total;
  };

  // 5. Scoring function
  const computeScore = (exercise: Exercise, selectedMuscles: Set<string>): number => {
    let score = 0;

    // Profile match bonuses
    if (profile.occupation_type === "office_worker" && exercise.target_audience.includes("office workers")) {
      score += 3;
    }
    if (profile.age_range === "50+" && exercise.target_audience.includes("elderly")) {
      score += 3;
      if (exercise.difficulty > 1) score -= 2; // prefer lower difficulty
    }
    if (profile.age_range === "18-25" || profile.age_range === "26-35") {
      if (exercise.target_audience.includes("athletes")) score += 2;
    }

    // Impact level (higher impact → higher score)
    score += exercise.impact_level * 0.5;

    // Past completion rate (encourage variety)
    const rate = getCompletionRate(exercise.family);
    score += rate * 3;

    // Penalty for same muscle group already selected
    if (selectedMuscles.has(exercise.muscle_group)) {
      score -= 5;
    }

    // Diversity bonus: if not in selectedMuscles, small bonus
    if (!selectedMuscles.has(exercise.muscle_group)) {
      score += 1;
    }

    return Math.round(score * 100) / 100;
  };

  // 6. Select 2–4 exercises
  const selectedExercises: Exercise[] = [];
  const selectedMuscles = new Set<string>();

  // Sort exercises by initial score (without muscle penalty) to pick top candidates
  const scoredCandidates = candidateExercises.map((ex) => ({
    ...ex,
    initialScore: computeScore(ex, new Set<string>()) // no muscles yet
  })).sort((a, b) => b.initialScore - a.initialScore);

  const maxExercises = Math.min(4, scoredCandidates.length);
  const minExercises = Math.min(2, maxExercises);

  // Greedy selection while enforcing muscle diversity
  const picked: typeof scoredCandidates = [];
  const usedMuscles = new Set<string>();

  for (let i = 0; i < scoredCandidates.length && picked.length < maxExercises; i++) {
    const candidate = scoredCandidates[i];
    if (!usedMuscles.has(candidate.muscle_group)) {
      picked.push(candidate);
      usedMuscles.add(candidate.muscle_group);
    }
  }

  // If still not enough, fill with next best (allowing muscle repeats)
  if (picked.length < minExercises) {
    for (let i = 0; i < scoredCandidates.length && picked.length < minExercises; i++) {
      if (!picked.some((p) => p.id === scoredCandidates[i].id)) {
        picked.push(scoredCandidates[i]);
      }
    }
  }

  // 7. Generate suggestion reasons
  const reasons: Record<string, string> = {};
  picked.forEach((ex) => {
    const benefitsStr = ex.benefits.slice(0, 2).join(", ");
    let audienceReason = "";
    if (ex.target_audience.includes("office workers") && profile.occupation_type === "office_worker") {
      audienceReason = " – great for desk workers";
    } else if (ex.target_audience.includes("elderly") && profile.age_range === "50+") {
      audienceReason = " – suitable for older adults";
    } else if (ex.target_audience.includes("athletes") && profile.age_range !== "50+") {
      audienceReason = " – builds athletic performance";
    }
    reasons[ex.id] = `${benefitsStr}${audienceReason}`;
  });

  // 8. Delete old auto‑suggested exercise tasks for today (not completed)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  await supabase
    .from("planner_tasks")
    .delete()
    .eq("user_id", user.id)
    .eq("task_type", "exercise")
    .eq("suggested_by", "auto")
    .gte("scheduled_time", todayStart.toISOString())
    .lt("scheduled_time", todayEnd.toISOString())
    .eq("completed", false);

  // 9. Insert new tasks (spread them across the day, e.g., at 10am, 12pm, 3pm, 5pm)
  const possibleTimes = [10, 12, 15, 17]; // hours
  const tasksToInsert = picked.slice(0, maxExercises).map((ex, idx) => {
    const scheduled = new Date();
    scheduled.setHours(possibleTimes[idx] || 15, 0, 0, 0);
    return {
      user_id: user.id,
      task_type: "exercise",
      scheduled_time: scheduled.toISOString(),
      exercise_id: ex.id,
      suggested_by: "auto",
      suggestion_reason: { reason: reasons[ex.id], benefits: ex.benefits },
      completed: false,
      points_earned: 0,
    };
  });

  const { error: insertError } = await supabase
    .from("planner_tasks")
    .insert(tasksToInsert);

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Suggested ${picked.length} exercises`,
    exercises: picked.map((ex) => ({
      name: ex.name,
      reason: reasons[ex.id],
      benefits: ex.benefits,
    })),
  });
}