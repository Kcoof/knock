import Phaser from "phaser";
import type { DoorInfo } from "./types";

/**
 * Tiny typed bridge between Phaser and React. Phaser imports are client-only,
 * so this module must only be imported from inside the dynamically loaded
 * game shell (never from server components).
 */
export const EventBus = new Phaser.Events.EventEmitter();

export interface KnockPayload {
  doorId: string;
  reason: string;
  message: string;
}

export interface RoomUpdatePayload {
  roomId: string;
  doorState: "open" | "knock" | "focus";
  activity: string;
  username: string;
}

export interface IncomingKnockPayload {
  knockId: string;
  roomId: string;
  visitorName: string;
  reason: string;
  message: string;
  visitorKey: string;
}

export interface KnockResultPayload {
  knockId: string;
  accepted: boolean;
  ownerName: string;
}

export interface KnockRespondPayload {
  knockId: string;
  roomId: string;
  visitorKey: string;
  accepted: boolean;
}

export interface GameEvents {
  "door:near": (door: DoorInfo | null) => void;
  "knock:open": (door: DoorInfo) => void;
  "dialog:open": (door: DoorInfo) => void;
  "knock:send": (payload: KnockPayload) => void;
  "room:update": (payload: RoomUpdatePayload) => void;
  "knock:incoming": (payload: IncomingKnockPayload) => void;
  "knock:respond": (payload: KnockRespondPayload) => void;
  "dialog:closed": () => void;
  toast: (text: string) => void;
}

export function emitGame<K extends keyof GameEvents>(
  event: K,
  ...args: Parameters<GameEvents[K]>
) {
  EventBus.emit(event, ...args);
}

export function onGame<K extends keyof GameEvents>(
  event: K,
  handler: GameEvents[K],
): () => void {
  EventBus.on(event, handler);
  return () => EventBus.off(event, handler);
}
