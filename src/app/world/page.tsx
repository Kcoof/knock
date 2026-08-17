import WorldClient from "@/components/WorldClient";
import { getProfile } from "@/lib/supabase/server";
import { getWorldRooms } from "@/lib/rooms";
import { getPendingKnocks } from "@/lib/knocks";
import type { CharacterKey } from "@/game/types";

export const dynamic = "force-dynamic";

const VALID_CHARS = new Set(["builder", "noble", "mage", "traveler"]);

export default async function WorldPage() {
  const profile = await getProfile();
  const rooms = await getWorldRooms(3);

  const char =
    profile && VALID_CHARS.has(profile.avatar) ? (profile.avatar as CharacterKey) : "builder";

  // my room (may not be in the top-3 freshest slots shown in the world)
  const mine = profile ? rooms.find((r) => r.ownerId === profile.id) ?? null : null;
  const pendingKnocks = await getPendingKnocks(mine?.roomId ?? null);

  return (
    <WorldClient
      playerName={profile?.username ?? "Guest Builder"}
      activity={profile?.activity_text || "exploring the prototype"}
      userId={profile?.id ?? null}
      char={char}
      worldRooms={rooms}
      myRoom={mine}
      pendingKnocks={pendingKnocks}
    />
  );
}
