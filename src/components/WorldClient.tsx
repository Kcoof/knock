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

export default function WorldClient({
  playerName,
  activity,
}: {
  playerName: string;
  activity: string;
}) {
  return <GameShell playerName={playerName} activity={activity} />;
}
