import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Server-side Supabase client bound to the request cookies. */
export async function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured — check your environment variables");
  }
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // called from a Server Component — middleware refreshes sessions
        }
      },
    },
  });
}

/** Returns the signed-in user's profile, or null (guest / not configured). */
export async function getProfile() {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, status, activity_text, avatar")
    .eq("id", user.id)
    .single();

  return profile;
}
