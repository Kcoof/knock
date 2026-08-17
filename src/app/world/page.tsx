import WorldClient from "@/components/WorldClient";
import { getProfile } from "@/lib/supabase/server";
import type { CharacterKey } from "@/game/types";

export const dynamic = "force-dynamic";

const VALID_CHARS = new Set(["builder", "noble", "mage", "traveler"]);

export default async function WorldPage() {
  const profile = await getProfile();

  const char =
    profile && VALID_CHARS.has(profile.avatar) ? (profile.avatar as CharacterKey) : "builder";

  return (
    <WorldClient
      playerName={profile?.username ?? "Guest Builder"}
      activity={profile?.activity_text || "exploring the prototype"}
      userId={profile?.id ?? null}
      char={char}
    />
  );
}
