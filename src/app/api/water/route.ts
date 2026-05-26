// src/app/api/water/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const { data, error } = await supabase
    .from("water_entries")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("logged_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ entries: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount_ml, source = "manual" } = await request.json();
  if (!amount_ml || amount_ml <= 0) {
    return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
  }

  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const currentHour = now.getHours();

  // Insert the water entry
  const { data: entry, error: insertError } = await supabase
    .from("water_entries")
    .insert({
      user_id: user.id,
      amount_ml,
      source,
      date: today,
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // ----- Wake time inference -----
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("wake_time")
    .eq("user_id", user.id)
    .single();

  if (profile && profile.wake_time === null && currentHour >= 5 && currentHour <= 11) {
    // First morning water log → set wake_time to current hour
    await supabase
      .from("user_profiles")
      .update({ wake_time: currentHour })
      .eq("user_id", user.id);
  }

  // ----- Nap gap detection (60‑120 min) -----
  let napSuggestion = false;
  // Fetch the previous water entry today (excluding the one just inserted)
  const { data: prevEntries } = await supabase
    .from("water_entries")
    .select("logged_at")
    .eq("user_id", user.id)
    .eq("date", today)
    .order("logged_at", { ascending: false })
    .limit(2); // we want the one just before the latest

  if (prevEntries && prevEntries.length === 2) {
    const latestLog = new Date(prevEntries[0].logged_at);
    const previousLog = new Date(prevEntries[1].logged_at);
    const gapMinutes = (latestLog.getTime() - previousLog.getTime()) / 60000;

    if (gapMinutes >= 60 && gapMinutes <= 120) {
      napSuggestion = true;
    }
  }

  return NextResponse.json({ entry, nap_suggestion: napSuggestion });
}