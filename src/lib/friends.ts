import { isSupabaseConfigured } from "@/lib/supabase/env";

/** A friend as shown in the compact panel (spec §9). */
export interface Friend {
  userId: string;
  username: string;
  status: string;
  activity: string;
  roomId: string | null;
}

/** An incoming friend request. */
export interface FriendRequest {
  friendshipId: string;
  requesterId: string;
  username: string;
}

function first<T>(value: unknown): T | undefined {
  return (Array.isArray(value) ? value[0] : value) as T | undefined;
}

interface FriendProfile {
  id: string;
  username: string;
  status: string;
  activity_text: string;
}

/** Accepted friends with their room ids (server-side, signed-in only). */
export async function getFriends(userId: string | null): Promise<Friend[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("friendships")
      .select(
        "id, requester_id, addressee_id, " +
          "profiles!friendships_requester_id_fkey(id, username, status, activity_text), " +
          "profiles!friendships_addressee_id_fkey(id, username, status, activity_text), " +
          "rooms!rooms_owner_id_fkey(id)",
      )
      .eq("status", "accepted")
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error || !data) return [];

    const friends: Friend[] = [];
    for (const row of data as unknown as Array<Record<string, unknown>>) {
      const requester = first<FriendProfile>(row.profiles_friendships_requester_id_fkey);
      const addressee = first<FriendProfile>(row.profiles_friendships_addressee_id_fkey);
      const other = requester?.id === userId ? addressee : requester;
      if (!other) continue;
      const room = first<{ id: string }>(row.rooms);
      friends.push({
        userId: other.id,
        username: other.username,
        status: other.status,
        activity: other.activity_text,
        roomId: room?.id ?? null,
      });
    }
    return friends;
  } catch {
    return [];
  }
}

/** Pending requests addressed to me. */
export async function getFriendRequests(userId: string | null): Promise<FriendRequest[]> {
  if (!isSupabaseConfigured || !userId) return [];
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("friendships")
      .select("id, profiles!friendships_requester_id_fkey(id, username)")
      .eq("addressee_id", userId)
      .eq("status", "pending");
    if (error || !data) return [];

    const requests: FriendRequest[] = [];
    for (const row of data as unknown as Array<Record<string, unknown>>) {
      const requester = first<{ id: string; username: string }>(
        row.profiles_friendships_requester_id_fkey,
      );
      if (!requester) continue;
      requests.push({
        friendshipId: row.id as string,
        requesterId: requester.id,
        username: requester.username,
      });
    }
    return requests;
  } catch {
    return [];
  }
}
