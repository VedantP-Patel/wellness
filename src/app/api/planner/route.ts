// src/app/api/planner/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Default values if profile lacks wake/sleep/goal
const DEFAULT_WAKE = 7;
const DEFAULT_SLEEP = 22;
const DEFAULT_GOAL = 2000;

function generateTaskTimes(wakeHour: number, sleepHour: number): number[] {
  const times: number[] = [];
  let current = wakeHour;
  while (current < sleepHour) {
    times.push(current);
    current += 1.5; // 90 minutes
  }
  return times;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const { data: tasks, error: tasksError } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("user_id", user.id)
    .gte("scheduled_time", todayStart.toISOString())
    .lt("scheduled_time", todayEnd.toISOString())
    .order("scheduled_time", { ascending: true });

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  // If there are exercise tasks, fetch exercise details
  const exerciseIds = tasks
    ?.filter((t) => t.task_type === "exercise" && t.exercise_id)
    .map((t) => t.exercise_id);

  const exerciseMap: Record<string, any> = {};
  if (exerciseIds && exerciseIds.length > 0) {
    const { data: exercises } = await supabase
      .from("exercise_library")
      .select("id, name, benefits")
      .in("id", exerciseIds);
    (exercises || []).forEach((ex) => {
      exerciseMap[ex.id] = ex;
    });
  }

  // Attach exercise details to tasks
  const enrichedTasks = (tasks || []).map((task) => {
    if (task.task_type === "exercise" && task.exercise_id && exerciseMap[task.exercise_id]) {
      return {
        ...task,
        exercise_id: exerciseMap[task.exercise_id], // replace UUID with object
      };
    }
    return task;
  });

  return NextResponse.json({ tasks: enrichedTasks });
}