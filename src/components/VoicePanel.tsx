"use client";

import { useEffect, useRef, useState } from "react";
import { VoiceService } from "@/lib/voice";
import { createClient } from "@/lib/supabase/client";

/**
 * Voice inside a room (spec §13): join/leave, mic toggle, speaking
 * indicators. Ephemeral by design — nothing is recorded or stored.
 */
export default function VoicePanel({
  roomId,
  identity,
}: {
  roomId: string;
  identity: { key: string; username: string };
}) {
  const serviceRef = useRef<VoiceService | null>(null);
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<
    Array<{ key: string; username: string; speaking: boolean }>
  >([]);

  useEffect(() => {
    return () => {
      serviceRef.current?.leave();
      serviceRef.current = null;
    };
  }, [roomId]);

  const join = async () => {
    setError(null);
    const supabase = createClient();
    const service = new VoiceService(supabase, roomId, identity, {
      onParticipants: setParticipants,
      onError: (message) => {
        setError(message);
        setJoined(false);
      },
    });
    serviceRef.current = service;
    await service.join();
    setJoined(true);
  };

  const leave = () => {
    serviceRef.current?.leave();
    serviceRef.current = null;
    setJoined(false);
    setMuted(false);
    setParticipants([]);
  };

  return (
    <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-zinc-700/80 bg-zinc-900/90 px-4 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <p className="font-pixel text-[8px] text-zinc-300">VOICE</p>
        {joined ? (
          <>
            <button
              type="button"
              onClick={() => {
                const next = !muted;
                setMuted(next);
                serviceRef.current?.setMuted(next);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                muted
                  ? "bg-red-500/20 text-red-300 border border-red-500/50"
                  : "bg-emerald-500 text-emerald-950"
              }`}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button
              type="button"
              onClick={leave}
              className="rounded-lg border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
            >
              Leave
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void join()}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Join voice
          </button>
        )}
      </div>

      {joined && participants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {participants.map((p) => (
            <span
              key={p.key}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${
                p.speaking ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${p.speaking ? "bg-emerald-400" : "bg-zinc-500"}`}
              />
              {p.username}
            </span>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-[10px] text-red-300">{error}</p>}

      {/* hidden audio sinks for remote streams */}
      <RemoteAudio service={serviceRef} active={joined} />
    </div>
  );
}

function RemoteAudio({
  service,
  active,
}: {
  service: React.RefObject<VoiceService | null>;
  active: boolean;
}) {
  const [, force] = useState(0);
  const refs = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (!active || !service.current) return null;
  const svc = service.current;
  const streams = (svc as unknown as { peers: Map<string, unknown> }).peers;
  return (
    <>
      {[...streams.keys()].map((key) => {
        const stream = svc.getStream(key);
        if (!stream) return null;
        return (
          <audio
            key={key}
            ref={(el) => {
              const audio = refs.current.get(key);
              if (audio === el && el && el.srcObject !== stream) el.srcObject = stream;
              else if (el && !refs.current.has(key)) {
                el.srcObject = stream;
                void el.play().catch(() => {});
                refs.current.set(key, el);
              }
            }}
            autoPlay
            className="hidden"
          />
        );
      })}
    </>
  );
}
