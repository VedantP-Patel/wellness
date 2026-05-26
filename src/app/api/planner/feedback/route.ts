// src/app/api/planner/feedback/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { task_id, user_rating, benefit_rating } = await request.json();

  if (!task_id) {
    return NextResponse.json({ error: "task_id required" }, { status: 400 });
  }

  // Check that task belongs to user and is completed
  const { data: task, error: taskError } = await supabase
    .from("planner_tasks")
    .select("id, completed, task_type, user_id")
    .eq("id", task_id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!task.completed) {
    return NextResponse.json({ error: "Task must be completed before leaving feedback" }, { status: 400 });
  }

  // Prevent duplicate feedback for the same task
  const { data: existing } = await supabase
    .from("planner_feedback")
    .select("id")
    .eq("task_id", task_id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Feedback already submitted" }, { status: 409 });
  }

  const { error } = await supabase.from("planner_feedback").insert({
    user_id: user.id,
    task_id,
    completed: true,
    user_rating,
    benefit_rating,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}