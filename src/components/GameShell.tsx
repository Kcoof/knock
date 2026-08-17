"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "@/game/createGame";
import { emitGame, onGame } from "@/game/EventBus";
import { createClient } from "@/lib/supabase/client";
import { DOOR_STATE_LABELS, KNOCK_REASONS } from "@/game/constants";
import type { DoorInfo } from "@/game/types";
import type { WorldRoom } from "@/lib/rooms";
import type { PendingKnock } from "@/lib/knocks";

const STATE_BADGE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  knock: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
  focus: "bg-red-500/15 text-red-300 border-red-500/40",
};

export default function GameShell({
  playerName = "Guest Builder",
  activity = "exploring the prototype",
  userId = null,
  char = "builder",
  worldRooms = [],
  myRoom = null,
  pendingKnocks = [],
}: {
  playerName?: string;
  activity?: string;
  userId?: string | null;
  char?: string;
  worldRooms?: WorldRoom[];
  myRoom?: WorldRoom | null;
  pendingKnocks?: PendingKnock[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [nearDoor, setNearDoor] = useState<DoorInfo | null>(null);
  const [dialog, setDialog] = useState<DoorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [knocks, setKnocks] = useState<PendingKnock[]>(pendingKnocks);

  useEffect(() => {
    if (!containerRef.current) return;
    // stable per-tab guest key so a guest keeps their identity across reloads
    let netKey = userId ?? null;
    if (!netKey) {
      netKey = sessionStorage.getItem("knock-guest-key");
      if (!netKey) {
        netKey = "guest_" + Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("knock-guest-key", netKey);
      }
    }
    const game = createGame(containerRef.current, {
      playerName,
      netIdentity: { key: netKey, username: playerName, char, guest: !userId },
      worldRooms,
      myRoomId: myRoom?.roomId ?? null,
    });
    gameRef.current = game;
    (window as unknown as { __KNOCK_GAME?: Phaser.Game }).__KNOCK_GAME = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, [playerName, char, userId, worldRooms, myRoom]);

  useEffect(() => {
    const offs = [
      onGame("door:near", (door) => setNearDoor(door)),
      onGame("knock:open", (door) => setDialog(door)),
      onGame("toast", (text) => setToast(text)),
      onGame("knock:incoming", (event) => {
        setKnocks((current) => [
          {
            id: event.knockId,
            reason: event.reason,
            message: event.message,
            visitorName: event.visitorName,
            visitorId: event.visitorKey,
            createdAt: new Date().toISOString(),
          },
          ...current.filter((k) => k.id !== event.knockId),
        ]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const openDialogFromHud = () => {
    if (!nearDoor || dialog) return;
    setDialog(nearDoor);
    emitGame("dialog:open", nearDoor);
  };

  const closeDialog = () => {
    setDialog(null);
    emitGame("dialog:closed");
  };

  const sendKnock = (reason: string, message: string) => {
    if (!dialog) return;
    emitGame("knock:send", { doorId: dialog.id, reason, message });
    closeDialog();
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950">
      <div ref={containerRef} className="absolute inset-0" data-testid="game-root" />
      {/* ambient grade: warm sunlight tint + soft vignette for painterly cohesion */}
      <div className="pointer-events-none absolute inset-0 z-[5] bg-amber-200 opacity-[0.04]" />
      <div className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_at_center,transparent_58%,rgba(8,12,6,0.38)_100%)]" />

      {/* top-left player badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm">
        <p className="font-pixel text-[9px] leading-relaxed text-emerald-300">
          {playerName.toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-zinc-400">Available — {activity}</p>
      </div>

      {/* signed-in room controls */}
      {userId && myRoom && (
        <PlayerPanel playerName={playerName} initialActivity={activity} myRoom={myRoom} />
      )}

      {/* knocks at my door — live and while-away */}
      {userId && myRoom && knocks.length > 0 && (
        <KnockQueue roomId={myRoom.roomId} knocks={knocks} onResolved={() => setKnocks([])} />
      )}

      {/* toast */}
      {toast && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-md border border-emerald-500/40 bg-zinc-900/90 px-4 py-2 text-sm text-emerald-200 shadow-lg">
          {toast}
        </div>
      )}

      {/* interaction prompt — clickable for keyboard-free access (spec §32) */}
      {nearDoor && !dialog && (
        <button
          type="button"
          onClick={openDialogFromHud}
          className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-center shadow-xl backdrop-blur-sm transition-colors hover:border-emerald-500/60"
        >
          <p className="font-pixel text-[9px] text-zinc-100">
            {nearDoor.state === "focus"
              ? `${nearDoor.buildingName.toUpperCase()} IS IN FOCUS MODE`
              : `KNOCK ON ${nearDoor.owner.toUpperCase()}'S DOOR?`}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {DOOR_STATE_LABELS[nearDoor.state]} · press{" "}
            <kbd className="rounded border border-zinc-600 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-200">
              E
            </kbd>{" "}
            or click here
          </p>
        </button>
      )}

      {/* controls hint */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 text-[11px] text-zinc-500">
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">WASD</kbd>{" "}
        /{" "}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">↑←↓→</kbd>{" "}
        move ·{" "}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono">E</kbd>{" "}
        interact
      </div>

      {dialog && <KnockDialog door={dialog} onCancel={closeDialog} onSend={sendKnock} />}
    </div>
  );
}

const STATUSES = ["available", "working", "focus", "away"] as const;
const DOOR_STATES = ["open", "knock", "focus"] as const;

function PlayerPanel({
  playerName,
  initialActivity,
  myRoom,
}: {
  playerName: string;
  initialActivity: string;
  myRoom: WorldRoom;
}) {
  const [status, setStatus] = useState<string>(myRoom.status);
  const [activityText, setActivityText] = useState(initialActivity);
  const [doorState, setDoorState] = useState<"open" | "knock" | "focus">(
    myRoom.doorState === "private" ? "knock" : myRoom.doorState,
  );
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const supabase = createClient();
      const cleanActivity = activityText.trim().slice(0, 60);
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ status, activity_text: cleanActivity })
        .eq("id", myRoom.ownerId);
      if (profileErr) throw profileErr;
      const { error: roomErr } = await supabase
        .from("rooms")
        .update({ door_state: doorState })
        .eq("id", myRoom.roomId);
      if (roomErr) throw roomErr;

      // update this tab instantly and tell other players
      emitGame("room:update", {
        roomId: myRoom.roomId,
        doorState,
        activity: cleanActivity,
        username: playerName,
      });
      setNote("Saved — your door is live");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
      setTimeout(() => setNote(null), 3000);
    }
  };

  return (
    <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border border-zinc-700/80 bg-zinc-900/85 p-3 backdrop-blur-sm">
      <p className="font-pixel text-[8px] text-emerald-300">YOUR ROOM</p>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Status
      </label>
      <div className="mt-1 flex gap-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`flex-1 rounded px-1.5 py-1 text-[10px] capitalize transition-colors ${
              status === s
                ? "bg-emerald-500 text-emerald-950"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Working on
      </label>
      <input
        value={activityText}
        onChange={(e) => setActivityText(e.target.value)}
        maxLength={60}
        placeholder="e.g. Authentication API"
        className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800/60 px-2 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
      />

      <label className="mt-2 block text-[10px] uppercase tracking-wide text-zinc-500">
        Door
      </label>
      <div className="mt-1 flex gap-1">
        {DOOR_STATES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setDoorState(s)}
            className={`flex-1 rounded px-1.5 py-1 text-[10px] transition-colors ${
              doorState === s
                ? s === "open"
                  ? "bg-emerald-500 text-emerald-950"
                  : s === "knock"
                    ? "bg-yellow-500 text-yellow-950"
                    : "bg-red-500 text-red-950"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {s === "open" ? "Open" : s === "knock" ? "Knock" : "Focus"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 w-full rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Update my door"}
      </button>
      {note && <p className="mt-2 text-center text-[10px] text-zinc-400">{note}</p>}
    </div>
  );
}

function KnockQueue({
  roomId,
  knocks,
  onResolved,
}: {
  roomId: string;
  knocks: PendingKnock[];
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  const respond = async (knock: PendingKnock, accepted: boolean) => {
    setBusy(knock.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("knocks")
        .update({ status: accepted ? "accepted" : "declined" })
        .eq("id", knock.id);
      if (error) throw error;
      emitGame("knock:respond", {
        knockId: knock.id,
        roomId,
        visitorKey: knock.visitorId,
        accepted,
      });
      onResolved();
    } catch {
      setBusy(null);
    }
  };

  return (
    <div className="absolute left-1/2 top-3 z-20 w-80 -translate-x-1/2 space-y-2">
      {knocks.map((knock) => (
        <div
          key={knock.id}
          className="rounded-lg border border-yellow-500/50 bg-zinc-900/95 p-4 shadow-xl backdrop-blur-sm"
          role="alert"
        >
          <p className="font-pixel text-[9px] text-yellow-300">KNOCK KNOCK</p>
          <p className="mt-2 text-sm text-zinc-100">
            <span className="font-medium text-yellow-200">{knock.visitorName}</span> is outside your
            room.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {knock.reason}
            {knock.message ? ` — “${knock.message}”` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={busy === knock.id}
              onClick={() => respond(knock, true)}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              Let In
            </button>
            <button
              type="button"
              disabled={busy === knock.id}
              onClick={() => respond(knock, false)}
              className="flex-1 rounded-lg border border-zinc-600 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-400 disabled:opacity-50"
            >
              Not Now
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function KnockDialog({  door,
  onCancel,
  onSend,
}: {
  door: DoorInfo;
  onCancel: () => void;
  onSend: (reason: string, message: string) => void;
}) {
  const [reason, setReason] = useState<string>(KNOCK_REASONS[0]);
  const [message, setMessage] = useState("");

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={`Knock on ${door.owner}'s door`}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-pixel text-[11px] leading-relaxed text-zinc-100">
              KNOCK KNOCK
            </h2>
            <p className="mt-2 text-sm text-zinc-300">
              {door.owner} — <span className="text-zinc-500">{door.activity}</span>
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide ${STATE_BADGE[door.state]}`}
          >
            {DOOR_STATE_LABELS[door.state]}
          </span>
        </div>

        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Reason
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {KNOCK_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                reason === r
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-zinc-500">
          Message (optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 140))}
          placeholder="Can you help me with this bug?"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => onSend(reason, message)}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Knock
          </button>
        </div>
      </div>
    </div>
  );
}
