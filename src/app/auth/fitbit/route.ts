// src/app/api/auth/fitbit/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.FITBIT_CLIENT_ID;
  const redirectUri = process.env.FITBIT_REDIRECT_URI;
  const scope = "activity heartrate sleep";

  const fitbitAuthUrl =
    `https://www.fitbit.com/oauth2/authorize?` +
    new URLSearchParams({
      response_type: "code",
      client_id: clientId!,
      redirect_uri: redirectUri!,
      scope,
    }).toString();

  return NextResponse.redirect(fitbitAuthUrl);
}