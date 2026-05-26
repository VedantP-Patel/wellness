// src/app/api/infer-sleep/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only set sleep_time if not already set
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("sleep_time")
    .eq("user_id", user.id)
    .single();

  if (profile?.sleep_time !== null) {
    return NextResponse.json({ message: "Sleep time already set" });
  }

  // Get yesterday's water entries
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: entries } = await supabase
    .from("water_entries")
    .select("logged_at")
    .eq("user_id", user.id)
    .eq("date", yesterdayStr)
    .order("logged_at", { ascending: false });

  if (!entries || entries.length === 0) {
    return NextResponse.json({ message: "No water entries yesterday" });
  }

  // The latest water entry after 9pm (21:00)
  const latestEntry = entries[0];
  const latestTime = new Date(latestEntry.logged_at);
  if (latestTime.getHours() < 21) {
    return NextResponse.json({ message: "Last entry was before 9pm" });
  }

  // Check if there is at least a 3‑hour gap until now (next log)
  const now = new Date();
  const gapHours = (now.getTime() - latestTime.getTime()) / 3600000;
  if (gapHours >= 3) {
    // Set sleep_time to the hour of that last entry
    await supabase
      .from("user_profiles")
      .update({ sleep_time: latestTime.getHours() })
      .eq("user_id", user.id);
    return NextResponse.json({ sleep_time: latestTime.getHours() });
  }

  return NextResponse.json({ message: "Not enough inactivity yet" });
}