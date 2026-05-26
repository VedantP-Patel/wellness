// src/app/api/planner/[taskId]/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse, NextRequest } from "next/server";

export async function PATCH(request: NextRequest, context: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = context?.params?.taskId ?? context.params?.taskId;

  // Fetch the task
  const { data: task, error: fetchError } = await supabase
    .from("planner_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (task.completed) {
    return NextResponse.json({ error: "Already completed" }, { status: 400 });
  }

  // Mark task completed, award points (hydration = 10)
  const points = task.task_type === "hydration" ? 10 : 20; // later: exercise = 20
  const { error: updateError } = await supabase
    .from("planner_tasks")
    .update({
      completed: true,
      completed_at: new Date().toISOString(),
      points_earned: points,
    })
    .eq("id", taskId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If it's a hydration task, also create a water entry
  if (task.task_type === "hydration" && task.amount_ml) {
    const today = new Date().toISOString().split("T")[0];
    await supabase.from("water_entries").insert({
      user_id: user.id,
      amount_ml: task.amount_ml,
      source: "planner",
      date: today,
    });
  }

  return NextResponse.json({ success: true, points_earned: points });
}