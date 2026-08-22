"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { HUBS, type HubId } from "@/game/constants";
import { emitGame } from "@/game/EventBus";

interface WorldEvent {
  id: string;
  title: string;
  hub: string;
  starts_at: string;
  created_by: string | null;
}

/**
 * The event board (spec §26): lightweight community events — AI Builders
 * Night, Open Source Hour — that happen inside existing world spaces.
 */
export default function EventBoard({
  userId,
  currentHub,
  onClose,
}: {
  userId: string;
  currentHub: string;
  onClose: () => void;
}) {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [title, setTitle] = useState("");
  const [hub, setHub] = useState(currentHub);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    void supabase
      .from("events")
      .select("id, title, hub, starts_at, created_by")
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(8)
      .then(({ data }) => setEvents((data as WorldEvent[]) ?? []));
  }, []);

  const create = async () => {
    const clean = title.trim();
    if (clean.length < 3 || !when || !isSupabaseConfigured) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .insert({ title: clean, hub, starts_at: new Date(when).toISOString(), created_by: userId })
        .select("id, title, hub, starts_at, created_by")
        .single();
      if (!error && data) setEvents((current) => [...current, data as WorldEvent]);
      setTitle("");
      emitGame("toast", "Event posted to the board");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute left-1/2 top-16 z-30 max-h-[70vh] w-80 -translate-x-1/2 overflow-y-auto rounded-xl border border-zinc-700/80 bg-zinc-900/95 p-4 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <p className="font-pixel text-[9px] text-violet-300">EVENT BOARD</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-1.5 text-xs text-zinc-500 hover:text-zinc-200"
          aria-label="Close event board"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 space-y-1.5">
        {events.length === 0 && (
          <p className="text-[11px] text-zinc-500">No upcoming events — host the first one!</p>
        )}
        {events.map((event) => (
          <div key={event.id} className="rounded-lg bg-zinc-800/60 p-2">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs text-zinc-100">{event.title}</p>
              <span className="ml-auto shrink-0 text-[9px] uppercase text-zinc-500">
                {HUBS[event.hub as HubId]?.name.replace(" Hub", "") ?? event.hub}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-400">
              {new Date(event.starts_at).toLocaleString(undefined, {
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <div className="mt-1 flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  window.location.assign(`/world?hub=${event.hub}`);
                }}
                className="rounded bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-100 hover:bg-zinc-600"
              >
                Go to hub
              </button>
              {event.created_by === userId && (
                <button
                  type="button"
                  onClick={() => {
                    void createClient().from("events").delete().eq("id", event.id);
                    setEvents((current) => current.filter((e) => e.id !== event.id));
                  }}
                  className="rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-red-400"
                >
                  remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 border-t border-zinc-800 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-zinc-500">Host an event</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
          placeholder="e.g. AI Builders Night"
          className="mt-1.5 w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-1.5 flex gap-1.5">
          <select
            value={hub}
            onChange={(e) => setHub(e.target.value)}
            className="w-1/2 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          >
            {Object.entries(HUBS).map(([id, h]) => (
              <option key={id} value={id}>
                {h.name.replace(" Hub", "")}
              </option>
            ))}
          </select>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-1/2 rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => void create()}
          disabled={busy}
          className="mt-2 w-full rounded bg-violet-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-400 disabled:opacity-50"
        >
          {busy ? "Posting…" : "Post event"}
        </button>
      </div>
    </div>
  );
}
