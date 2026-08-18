"use client";

import dynamic from "next/dynamic";

const GameShell = dynamic(() => import("@/components/GameShell"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      <p className="font-pixel animate-pulse text-[10px] text-emerald-300">
        ENTERING THE WORLD...
      </p>
    </div>
  ),
});

import type { WorldRoom } from "@/lib/rooms";
import type { PendingKnock } from "@/lib/knocks";
import type { DoorNote } from "@/lib/notes";

export default function WorldClient({
  playerName,
  activity,
  userId,
  char,
  worldRooms,
  myRoom,
  pendingKnocks,
  doorNotes,
}: {
  playerName: string;
  activity: string;
  userId: string | null;
  char: string;
  worldRooms: WorldRoom[];
  myRoom: WorldRoom | null;
  pendingKnocks: PendingKnock[];
  doorNotes: DoorNote[];
}) {
  return (
    <GameShell
      playerName={playerName}
      activity={activity}
      userId={userId}
      char={char}
      worldRooms={worldRooms}
      myRoom={myRoom}
      pendingKnocks={pendingKnocks}
      doorNotes={doorNotes}
    />
  );
}
