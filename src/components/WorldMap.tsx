import { useEffect, useMemo, useState } from "react";
import { HUBS, type HubId } from "@/game/constants";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { emitGame } from "@/game/EventBus";

interface PublicRoom {
  id: string;
  name: string;
  doorState: string;
}

interface Passport {
  visited: string[];
  knocks: number;
  rooms: number;
}

function readPassport(): Passport {
  try {
    return {
      visited: JSON.parse(localStorage.getItem("knock-passport-visited") ?? "[]"),
      knocks: Number(localStorage.getItem("knock-passport-knocks") ?? 0),
      rooms: Number(localStorage.getItem("knock-passport-rooms") ?? 0),
    };
  } catch {
    return { visited: [], knocks: 0, rooms: 0 };
  }
}

/** The V2 world map: hub selection with live builder counts, public rooms, passport. */
export default function WorldMap({ currentHub }: { currentHub: string }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const passport = useMemo(() => readPassport(), []);

  // live builder counts per hub via a lightweight meta channel
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    const channel = supabase.channel("knock:hubs-meta");
    const seen = new Map<string, number>();
    channel.on("broadcast", { event: "here" }, ({ payload }) => {
      seen.set(payload.key as string, Date.now());
      const now = Date.now();
      for (const [k, t] of seen) if (now - t > 16000) seen.delete(k);
      const tally: Record<string, number> = {};
      for (const key of seen.keys()) {
        const hub = key.split(":")[0];
        tally[hub] = (tally[hub] ?? 0) + 1;
      }
      setCounts(tally);
    });
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        const ping = () =>
          void channel.send({
            type: "broadcast",
            event: "here",
            payload: { key: `${currentHub}:${Math.random().toString(36).slice(2, 8)}` },
          });
        ping();
        const interval = setInterval(ping, 8000);
        return () => clearInterval(interval);
      }
    });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentHub]);

  // public room directory
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    void supabase
      .from("rooms")
      .select("id, name, door_state")
      .eq("visibility", "public")
      .limit(10)
      .then(({ data }) => {
        if (data)
          setPublicRooms(
            (data as Array<{ id: string; name: string; door_state: string }>).map((r) => ({
              id: r.id,
              name: r.name,
              doorState: r.door_state,
            })),
          );
      });
  }, []);

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-950/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="World map"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-violet-500/40 bg-zinc-900/95 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-[12px] text-violet-300">KNOCK WORLD</h2>
          <button
            type="button"
            onClick={() => emitGame("worldmap:close")}
            className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
          >
            Stay here
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(Object.keys(HUBS) as HubId[]).map((id) => {
            const hub = HUBS[id];
            const here = id === currentHub;
            return (
              <button
                key={id}
                type="button"
                disabled={here}
                onClick={() => {
                  const visited = new Set(passport.visited);
                  visited.add(id);
                  localStorage.setItem("knock-passport-visited", JSON.stringify([...visited]));
                  // full reload resets the Phaser game cleanly between hubs
                  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                  window.location.href = `/world?hub=${id}`;
                }}
                className={`rounded-xl border p-4 text-left transition-all ${
                  here
                    ? "border-emerald-500/60 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-800/60 hover:-translate-y-0.5 hover:border-violet-400/60"
                }`}
              >
                <p className="text-sm font-semibold" style={{ color: hub.accent }}>
                  {hub.name.replace(" Hub", "")}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  {counts[id] ?? 0} builder{(counts[id] ?? 0) === 1 ? "" : "s"} online
                </p>
                <p className="mt-1 text-[10px] text-zinc-500">
                  {here ? "you are here" : "travel →"}
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="font-pixel text-[8px] text-emerald-300">OPEN ROOMS</p>
            {publicRooms.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">
                No public rooms yet — mark yours public from the Your Room panel.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {publicRooms.map((room) => (
                  <li key={room.id} className="text-xs text-zinc-300">
                    <span className="text-emerald-300">●</span> {room.name}{" "}
                    <span className="text-zinc-500">({room.doorState})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="font-pixel text-[8px] text-amber-300">PASSPORT</p>
            <p className="mt-2 text-xs text-zinc-400">
              Countries visited: {passport.visited.length} / {Object.keys(HUBS).length}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Rooms entered: {passport.rooms}</p>
            <p className="mt-1 text-xs text-zinc-400">Knocks sent: {passport.knocks}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
