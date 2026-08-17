import type { SupabaseClient } from "@supabase/supabase-js";

/** Who we are in the world — signed-in builders and guests alike. */
export interface PlayerIdentity {
  key: string;
  username: string;
  char: string;
  guest: boolean;
}

/** A movement broadcast from another player. */
export interface PositionEvent {
  key: string;
  x: number;
  y: number;
  dir: number;
  moving: boolean;
}

/** A door/status update for a real room, local or from another player. */
export interface RoomStateEvent {
  roomId: string;
  doorState: "open" | "knock" | "focus";
  activity: string;
  username: string;
}

interface PresenceState {
  key: string;
  username: string;
  char: string;
  guest: boolean;
  x?: number;
  y?: number;
  dir?: number;
}

/**
 * Phase 3 networking: one realtime channel for the whole world.
 * Presence carries slow-changing identity (who is online); Broadcast carries
 * fast ephemeral movement. Nothing here is ever written to the database —
 * movement is throwaway state by design (spec §16).
 */
export class RealtimeService {
  private channel: ReturnType<SupabaseClient["channel"]> | null = null;
  private lastSend = 0;
  private lastSentPos = { x: -9999, y: -9999 };

  constructor(
    private supabase: SupabaseClient,
    private identity: PlayerIdentity,
    private handlers: {
      onPlayers: (players: PresenceState[]) => void;
      onPosition: (event: PositionEvent) => void;
      onRoomState?: (event: RoomStateEvent) => void;
    },
  ) {}

  async connect(): Promise<void> {
    this.channel = this.supabase.channel("knock:world", {
      config: {
        presence: { key: this.identity.key },
        broadcast: { self: false },
      },
    });

    this.channel
      .on("presence", { event: "sync" }, () => {
        const state = this.channel!.presenceState<PresenceState>();
        const players = Object.values(state)
          .flat()
          .filter((p) => p.key !== this.identity.key);
        this.handlers.onPlayers(players);
      })
      .on("broadcast", { event: "pos" }, ({ payload }) => {
        const event = payload as PositionEvent;
        if (event.key !== this.identity.key) this.handlers.onPosition(event);
      })
      .on("broadcast", { event: "room" }, ({ payload }) => {
        const event = payload as RoomStateEvent;
        if (event.roomId) this.handlers.onRoomState?.(event);
      });

    await this.channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await this.channel!.track({
          key: this.identity.key,
          username: this.identity.username,
          char: this.identity.char,
          guest: this.identity.guest,
        });
      }
    });
  }

  /** Movement broadcast, throttled: ~10 msgs/sec and only when moved. */
  sendPosition(x: number, y: number, dir: number, moving: boolean, now: number): void {
    if (!this.channel) return;
    const moved = Math.hypot(x - this.lastSentPos.x, y - this.lastSentPos.y);
    const idleResend = !moving ? 1000 : Infinity; // one final "stopped" update
    if (now - this.lastSend < 100 && moved < 2 && now - this.lastSend < idleResend) return;
    this.lastSend = now;
    this.lastSentPos = { x, y };
    void this.channel.send({
      type: "broadcast",
      event: "pos",
      payload: { key: this.identity.key, x, y, dir, moving },
    });
  }

  /** Broadcast a door/status change for a real room to everyone online. */
  sendRoomState(event: RoomStateEvent): void {
    void this.channel?.send({
      type: "broadcast",
      event: "room",
      payload: event,
    });
  }

  destroy(): void {
    if (this.channel) {
      void this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }
}
