import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A knock waiting at one of my doors. */
export interface PendingKnock {
  id: string;
  reason: string;
  message: string;
  visitorName: string;
  visitorId: string;
  createdAt: string;
}

/**
 * Pending knocks at my room (server-side, signed-in only) — knocks that
 * arrived while I was away are waiting here.
 */
export async function getPendingKnocks(roomId: string | null): Promise<PendingKnock[]> {
  if (!isSupabaseConfigured || !roomId) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("knocks")
      .select("id, reason, message, created_at, visitor_id, profiles!knocks_visitor_id_fkey(username)")
      .eq("room_id", roomId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !data) return [];

    return data.flatMap((k) => {
      const profile = k.profiles as { username: string } | null | { username: string }[];
      if (!profile || Array.isArray(profile)) return [];
      return [
        {
          id: k.id,
          reason: k.reason,
          message: k.message,
          visitorName: profile.username,
          visitorId: k.visitor_id,
          createdAt: k.created_at,
        },
      ];
    });
  } catch {
    return [];
  }
}
