import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A real room as shown in the world, joined with its owner's profile. */
export interface WorldRoom {
  roomId: string;
  ownerId: string;
  username: string;
  activity: string;
  status: string;
  doorState: "open" | "knock" | "focus" | "private";
  theme: string;
  githubUsername: string | null;
  githubRepo: string | null;
}

/**
 * Personal rooms for the world's neighborhood slots, freshest first.
 * Returns an empty list in guest mode or on any error — the world falls
 * back to mock residents so it always renders.
 */
export async function getWorldRooms(limit = 3, friendIds: string[] = []): Promise<WorldRoom[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("rooms")
      .select(
        "id, owner_id, door_state, theme, profiles!rooms_owner_id_fkey(username, activity_text, status, github_username, github_repo)",
      )
      .order("updated_at", { ascending: false })
      .limit(friendIds.length > 0 ? 12 : limit);
    if (error || !data) return [];

    // friends' rooms get the neighborhood slots first (spec: friends appear naturally)
    const ranked = [...data].sort((a, b) => {
      const fa = friendIds.includes(a.owner_id) ? 0 : 1;
      const fb = friendIds.includes(b.owner_id) ? 0 : 1;
      return fa - fb;
    }).slice(0, limit);

    return ranked.flatMap((room) => {
      const profile = room.profiles as
        | {
            username: string;
            activity_text: string;
            status: string;
            github_username: string | null;
            github_repo: string | null;
          }
        | null
        | {
            username: string;
            activity_text: string;
            status: string;
            github_username: string | null;
            github_repo: string | null;
          }[];
      if (!profile || Array.isArray(profile)) return [];
      return [
        {
          roomId: room.id,
          ownerId: room.owner_id,
          username: profile.username,
          activity: profile.activity_text,
          status: profile.status,
          doorState: room.door_state,
          theme: room.theme ?? "warm",
          githubUsername: profile.github_username,
          githubRepo: profile.github_repo,
        },
      ];
    });
  } catch {
    return [];
  }
}

/** My own room, regardless of freshness ranking. */
export async function getMyRoom(userId: string | null): Promise<WorldRoom | null> {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase
      .from("rooms")
      .select("id, owner_id, door_state, theme, profiles!rooms_owner_id_fkey(username, activity_text, status, github_username, github_repo)")
      .eq("owner_id", userId)
      .limit(1);
    const room = data?.[0];
    if (!room) return null;
    const profile = (Array.isArray(room.profiles) ? room.profiles[0] : room.profiles) as
      | { username: string; activity_text: string; status: string; github_username: string | null; github_repo: string | null }
      | undefined;
    if (!profile) return null;
    return {
      roomId: room.id,
      ownerId: room.owner_id,
      username: profile.username,
      activity: profile.activity_text,
      status: profile.status,
      doorState: room.door_state,
      theme: room.theme ?? "warm",
      githubUsername: profile.github_username,
      githubRepo: profile.github_repo,
    };
  } catch {
    return null;
  }
}
