"use client";

import { useEffect, useRef, useState } from "react";
import type Phaser from "phaser";
import { createGame } from "@/game/createGame";
import { emitGame, onGame } from "@/game/EventBus";
import { DOOR_STATE_LABELS, KNOCK_REASONS } from "@/game/constants";
import type { DoorInfo } from "@/game/types";

const STATE_BADGE: Record<string, string> = {
  open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  knock: "bg-yellow-500/15 text-yellow-300 border-yellow-500/40",
  focus: "bg-red-500/15 text-red-300 border-red-500/40",
};

export default function GameShell() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [nearDoor, setNearDoor] = useState<DoorInfo | null>(null);
  const [dialog, setDialog] = useState<DoorInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const game = createGame(containerRef.current);
    gameRef.current = game;
    (window as unknown as { __KNOCK_GAME?: Phaser.Game }).__KNOCK_GAME = game;
    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const offs = [
      onGame("door:near", (door) => setNearDoor(door)),
      onGame("knock:open", (door) => setDialog(door)),
      onGame("toast", (text) => setToast(text)),
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

      {/* top-left player badge */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 backdrop-blur-sm">
        <p className="font-pixel text-[9px] leading-relaxed text-emerald-300">GUEST BUILDER</p>
        <p className="mt-1 text-xs text-zinc-400">Available — exploring the prototype</p>
      </div>

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

function KnockDialog({
  door,
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
