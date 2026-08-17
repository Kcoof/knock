import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A real room as shown in the world, joined with its owner's profile. */
export interface WorldRoom {
  roomId: string;
  ownerId: string;
  username: string;
  activity: string;
  status: string;
  doorState: "open" | "knock" | "focus" | "private";
}

/**
 * Personal rooms for the world's neighborhood slots, freshest first.
 * Returns an empty list in guest mode or on any error — the world falls
 * back to mock residents so it always renders.
 */
export async function getWorldRooms(limit = 3): Promise<WorldRoom[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rooms")
      .select(
        "id, owner_id, door_state, profiles!rooms_owner_id_fkey(username, activity_text, status)",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];

    return data.flatMap((room) => {
      const profile = room.profiles as
        | { username: string; activity_text: string; status: string }
        | null
        | { username: string; activity_text: string; status: string }[];
      if (!profile || Array.isArray(profile)) return [];
      return [
        {
          roomId: room.id,
          ownerId: room.owner_id,
          username: profile.username,
          activity: profile.activity_text,
          status: profile.status,
          doorState: room.door_state,
        },
      ];
    });
  } catch {
    return [];
  }
}
