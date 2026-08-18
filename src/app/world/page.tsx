import WorldClient from "@/components/WorldClient";
import { getProfile } from "@/lib/supabase/server";
import { getWorldRooms } from "@/lib/rooms";
import { getPendingKnocks } from "@/lib/knocks";
import { getDoorNotes } from "@/lib/notes";
import { normalizeHub } from "@/game/constants";
import type { CharacterKey } from "@/game/types";

export const dynamic = "force-dynamic";

const VALID_CHARS = new Set(["builder", "noble", "mage", "traveler"]);

export default async function WorldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hubParam = Array.isArray(params?.hub) ? params?.hub[0] : params?.hub;
  const hub = normalizeHub(hubParam);

  const profile = await getProfile();
  const rooms = await getWorldRooms(3);
  const mine = profile ? rooms.find((r) => r.ownerId === profile.id) ?? null : null;
  const pendingKnocks = await getPendingKnocks(mine?.roomId ?? null);
  const doorNotes = await getDoorNotes(mine?.roomId ?? null);

  const char =
    profile && VALID_CHARS.has(profile.avatar) ? (profile.avatar as CharacterKey) : "builder";

  return (
    <WorldClient
      playerName={profile?.username ?? "Guest Builder"}
      activity={profile?.activity_text || "exploring the prototype"}
      userId={profile?.id ?? null}
      char={char}
      hub={hub}
      worldRooms={rooms}
      myRoom={mine}
      pendingKnocks={pendingKnocks}
      doorNotes={doorNotes}
    />
  );
}
