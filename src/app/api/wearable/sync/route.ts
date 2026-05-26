// src/app/api/wearable/sync/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://api.fitbit.com/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.FITBIT_CLIENT_ID}:${process.env.FITBIT_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  return res.json();
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get stored tokens
  const { data: tokenRow, error: tokenError } = await supabase
    .from("wearable_tokens")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (tokenError || !tokenRow) {
    return NextResponse.json({ error: "No Fitbit token found. Connect your device first." }, { status: 400 });
  }

  let accessToken = tokenRow.access_token;
  let refreshToken = tokenRow.refresh_token;

  // Check if token expired
  if (new Date(tokenRow.expires_at) <= new Date()) {
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed.error) {
      return NextResponse.json({ error: "Failed to refresh token" }, { status: 400 });
    }
    accessToken = refreshed.access_token;
    refreshToken = refreshed.refresh_token;

    // Update DB
    await supabase
      .from("wearable_tokens")
      .upsert({
        user_id: user.id,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }, { onConflict: "user_id" });
  }

  // Fetch data: steps, heart rate, sleep, active minutes
  const today = new Date().toISOString().split("T")[0];
  const headers = { Authorization: `Bearer ${accessToken}` };

  const fetchJson = async (url: string) => {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return res.json();
  };

  const [stepsData, heartData, sleepData, activityData] = await Promise.all([
    fetchJson(`https://api.fitbit.com/1/user/-/activities/steps/date/${today}/1d.json`),
    fetchJson(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`),
    fetchJson(`https://api.fitbit.com/1.2/user/-/sleep/date/${today}.json`),
    fetchJson(`https://api.fitbit.com/1/user/-/activities/minutesFairlyActive/date/${today}/1d.json`),
  ]);

  const steps = stepsData?.["activities-steps"]?.[0]?.value || 0;
  const restingHeartRate = heartData?.["activities-heart"]?.[0]?.value?.restingHeartRate || null;
  const activeMinutes = activityData?.["activities-minutesFairlyActive"]?.[0]?.value || 0;

  // Sleep: sum minutes of all sleep logs
  // Sleep: sum minutes of all sleep logs
  let sleepMinutes = 0;
  // Tell TypeScript exactly what keys this object can hold
  let sleepStages: { deep?: number; light?: number; rem?: number } = {};
  if (sleepData?.sleep) {
    for (const log of sleepData.sleep) {
      sleepMinutes += log.minutesAsleep || 0;
      // Combine stages if multiple logs
      if (log.levels?.summary) {
        sleepStages = {
          deep: (sleepStages.deep || 0) + (log.levels.summary.deep?.minutes || 0),
          light: (sleepStages.light || 0) + (log.levels.summary.light?.minutes || 0),
          rem: (sleepStages.rem || 0) + (log.levels.summary.rem?.minutes || 0),
        };
      }
    }
  }

  // Upsert metrics
  const { error: upsertError } = await supabase
    .from("wearable_metrics")
    .upsert(
      {
        user_id: user.id,
        date: today,
        steps,
        active_minutes: activeMinutes,
        resting_heart_rate: restingHeartRate,
        sleep_minutes: sleepMinutes,
        sleep_stages: sleepStages,
      },
      { onConflict: "user_id, date" }
    );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({
    steps,
    activeMinutes,
    restingHeartRate,
    sleepMinutes,
    sleepStages,
  });
}