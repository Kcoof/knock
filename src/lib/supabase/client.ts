import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Browser-side Supabase client. Only call when `isSupabaseConfigured`. */
export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured — check your environment variables");
  }
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
