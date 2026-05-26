// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient(_persist = true) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}