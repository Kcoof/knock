import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A note someone left at my door while I was away. */
export interface DoorNote {
  id: string;
  authorName: string;
  message: string;
  createdAt: string;
}

/** Unread door notes for my room (server-side, signed-in only). */
export async function getDoorNotes(roomId: string | null): Promise<DoorNote[]> {
  if (!isSupabaseConfigured || !roomId) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("door_notes")
      .select("id, message, created_at, profiles!door_notes_author_id_fkey(username)")
      .eq("room_id", roomId)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !data) return [];

    return data.flatMap((n) => {
      const profile = n.profiles as { username: string } | null | { username: string }[];
      if (!profile || Array.isArray(profile)) return [];
      return [
        {
          id: n.id,
          authorName: profile.username,
          message: n.message,
          createdAt: n.created_at,
        },
      ];
    });
  } catch {
    return [];
  }
}
