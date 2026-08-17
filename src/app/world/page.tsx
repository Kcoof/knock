import WorldClient from "@/components/WorldClient";
import { getProfile } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const profile = await getProfile();

  return (
    <WorldClient
      playerName={profile?.username ?? "Guest Builder"}
      activity={profile?.activity_text || "exploring the prototype"}
    />
  );
}
