// src/app/api/setup-admin/route.ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();

  // Get the current authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check total number of user_profiles rows
  const { count, error: countError } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  // If this is the only user (count = 1), promote to admin
  if (count === 1) {
    const { error: updateError } = await supabase
      .from("user_profiles")
      .update({ role: "admin" })
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ message: "Promoted to admin" });
  }

  return NextResponse.json({ message: "Not first user, no promotion" });
}