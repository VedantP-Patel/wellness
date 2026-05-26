// src/lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

declare global {
  // allow attaching to globalThis
  // eslint-disable-next-line no-var
  var __supabase_browser_client: ReturnType<typeof createBrowserClient> | undefined;
}

export function createClient(persist = true) {
  if (typeof window === "undefined") {
    throw new Error("createClient() must be called in a browser environment. Use the server createClient helper on the server.");
  }

  const globalObj = globalThis as any;

  // Determine storage option on first initialization and keep a singleton client
  if (!globalObj.__supabase_browser_client) {
    const storageOpt = !persist && typeof window !== "undefined"
      ? { auth: { storage: window.sessionStorage } }
      : {};

    globalObj.__supabase_browser_client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      storageOpt
    );
  }

  return globalObj.__supabase_browser_client as ReturnType<typeof createBrowserClient>;
}