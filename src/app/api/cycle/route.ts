// src/app/api/cycle/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function predictNextPhase(cycles: any[], avgCycleLength = 28) {
  if (cycles.length === 0) return null;

  const lastCycle = cycles[0]; // most recent (we order by start_date desc)
  if (!lastCycle.start_date) return null;

  const startDate = new Date(lastCycle.start_date);
  const today = new Date();
  const dayOfCycle = ((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) % avgCycleLength;

  let phase = "follicular";
  if (dayOfCycle >= 1 && dayOfCycle <= 5) phase = "menstrual";
  else if (dayOfCycle >= 6 && dayOfCycle <= 14) phase = "follicular";
  else if (dayOfCycle >= 15 && dayOfCycle <= 17) phase = "ovulatory";
  else if (dayOfCycle >= 18 && dayOfCycle <= 28) phase = "luteal";

  return {
    phase,
    day: Math.floor(dayOfCycle),
    nextPeriodPrediction: new Date(startDate.getTime() + avgCycleLength * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch all cycles for prediction
  const { data: cycles, error } = await supabase
    .from("menstrual_cycle")
    .select("*")
    .eq("user_id", user.id)
    .order("start_date", { ascending: false })
    .limit(12);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const prediction = predictNextPhase(cycles || []);

  return NextResponse.json({
    cycles: cycles || [],
    prediction,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { start_date, end_date, flow, symptoms } = await request.json();

  if (!start_date) return NextResponse.json({ error: "start_date required" }, { status: 400 });

  const { data, error } = await supabase
    .from("menstrual_cycle")
    .insert({
      user_id: user.id,
      start_date,
      end_date,
      flow,
      symptoms,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ cycle: data });
}