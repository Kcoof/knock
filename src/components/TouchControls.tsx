"use client";

import { useRef, useState } from "react";
import { emitGame } from "@/game/EventBus";

/**
 * Mobile controls (spec §31): a virtual joystick (bottom-left) and an
 * interact button (bottom-right), shown only on coarse-pointer devices.
 * Movement is a normalized vector sent to the scenes via the EventBus.
 */
export default function TouchControls({ visible }: { visible: boolean }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const move = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const max = rect.width / 2;
    let dx = (clientX - cx) / max;
    let dy = (clientY - cy) / max;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    setKnob({ x: dx * max * 0.6, y: dy * max * 0.6 });
    emitGame("touch:move", { x: dx, y: dy });
  };

  const end = () => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    emitGame("touch:move", { x: 0, y: 0 });
  };

  if (!visible) return null;

  return (
    <>
      {/* joystick */}
      <div
        ref={baseRef}
        onPointerDown={(e) => {
          setActive(true);
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (active) move(e.clientX, e.clientY);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        className="fixed bottom-8 left-6 z-30 h-32 w-32 touch-none rounded-full border-2 border-zinc-600/70 bg-zinc-900/50"
        role="application"
        aria-label="Movement joystick"
      >
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-emerald-400/70 bg-emerald-500/30"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>

      {/* interact button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          emitGame("touch:interact");
        }}
        className="fixed bottom-12 right-8 z-30 h-20 w-20 touch-none rounded-full border-2 border-emerald-400/80 bg-emerald-500/25 font-pixel text-[10px] text-emerald-200 active:bg-emerald-500/50"
        aria-label="Interact"
      >
        E
      </button>
    </>
  );
}
