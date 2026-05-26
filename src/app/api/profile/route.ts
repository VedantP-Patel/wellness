// src/app/api/profile/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 🛠️ CHANGED: .single() → .maybeSingle()
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Profile fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If no profile exists, create one
  if (!data) {
    const { data: newProfile, error: insertError } = await supabase
      .from("user_profiles")
      .insert({ user_id: user.id })
      .select()
      .single();

    if (insertError) {
      console.error("Profile insert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ profile: newProfile });
  }

  return NextResponse.json({ profile: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const allowedFields = [
    "weight",
    "gender",
    "age_range",
    "occupation_type",
    "gym_mode",
    "animation_style",
    "tone_preference",
    "gender_based_ui",
    "wake_time",
    "sleep_time",
    "nap_minutes",
    "daily_goal_ml",
    "weather_adjust_enabled",
  ];

  const updates: Record<string, any> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  // 🛠️ CHANGED: upsert so it creates the row if missing
  const { data, error } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    console.error("Profile update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}