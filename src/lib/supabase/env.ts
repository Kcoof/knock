/**
 * True when both public Supabase values are present. The app runs in guest
 * mode (no auth, mock data) until the project is connected, so builds and CI
 * work without any secrets.
 */
export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
