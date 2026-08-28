import Phaser from "phaser";
import {
  DOOR_INTERACT_DISTANCE,
  HUBS,
  normalizeHub,
  MAP_H,
  MAP_W,
  PLAYER_CHAR,
  PLAYER_SPEED,
  TILE,
  ZOOM,
} from "../constants";
import { emitGame, onGame } from "../EventBus";
import {
  BUILDINGS,
  BUSHES,
  DOORS,
  FLOWER_GROUPS,
  LAMPS,
  NPCS,
  PATH_LINES,
  PLAZA,
  POND,
  SPAWN,
  TREES,
  WELL,
  doorStateLabel,
  doorWorldPos,
} from "../worldData";
import type { BuildingSpec, CharacterKey } from "../types";
import { RealtimeService } from "../net/RealtimeService";
import type { PlayerIdentity, PositionEvent } from "../net/RealtimeService";
import { camFadeIn, camFadeOut, camFlash } from "../cameraFx";
import { mulberry32 } from "../warmDusk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RemotePlayer {
  key: string;
  username: string;
  char: string;
  guest: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  dir: number;
  moving: boolean;
  lastSeen: number;
}

interface DoorRuntime {
  info: (typeof DOORS)[string];
  building: BuildingSpec;
  x: number;
  y: number;
  nameplate: Phaser.GameObjects.Text;
  light: Phaser.GameObjects.Arc;
  halo?: Phaser.GameObjects.Arc;
  roomId?: string;
  ownerId?: string;
}

interface RoomUpdateEvent {
  roomId: string;
  doorState: "open" | "knock" | "focus";
  activity: string;
  username: string;
}

/** Door-light colors from the Warm Dusk reference (amber family). */
const DOOR_LIGHT: Record<string, number> = {
  open: 0xfbbf24,
  knock: 0xfb923c,
  focus: 0xf87171,
};

const CHAR_DIRS = ["down", "left", "right", "up"] as const;

/** Personal building slots filled by real database rooms, in order. */
const PERSONAL_SLOTS = ["reehana", "ahmed", "sara"];

/** Idle frame (row start) per direction for a 2x4 character sheet. */
function idleFrame(facing: number): number {
  return facing * 2;
}

/**
 * The playable pixel world, drawn with Qwen's Warm Dusk art: procedural
 * terrain (grass / dirt paths / brick plaza / pond), generated buildings,
 * layered trees, lamps, a plaza well and warm characters. Talks to the
 * React HUD through the EventBus.
 */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Image;
  private pressed = new Set<string>();
  private touchVec = { x: 0, y: 0 };
  private doors: DoorRuntime[] = [];
  private nearDoor: DoorRuntime | null = null;
  private dialogOpen = false;
  private currentDir = 0; // 0 down, 1 left, 2 right, 3 up
  private unsubscribers: Array<() => void> = [];
  private net?: RealtimeService;
  private supabase?: ReturnType<typeof createSupabaseClient>;
  private metaTimer?: Phaser.Time.TimerEvent;
  private metaChannel?: (SupabaseClient["channel"] extends (...args: never[]) => infer R ? R : never);
  private activeInvite: { ownerName: string; ownerKey: string; roomId: string | null } | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private wanderers: Array<{
    sprite: Phaser.GameObjects.Sprite;
    points: Array<{ x: number; y: number }>;
    target: number;
    speed: number;
    pauseUntil: number;
  }> = [];

  /** Terrain grid: 0 grass, 1 dirt, 2 plaza, 3 water (reference encoding). */
  private grid = new Uint8Array(MAP_W * MAP_H);
  private foamMask = new Uint8Array(MAP_W * MAP_H);

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.dialogOpen) return;
    const key = event.key.toLowerCase();
    this.pressed.add(key);
    if (key === "e" || key === " ") {
      if (key === " ") event.preventDefault();
      this.tryOpenKnockDialog();
    }
    if (key.startsWith("arrow")) event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.key.toLowerCase());
  };

  constructor() {
    super("world");
  }

  create(): void {
    try {
      this.createWorld();
    } catch (err) {
      (window as unknown as { __knockCreateError?: string }).__knockCreateError =
        err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      throw err;
    }
  }

  private createWorld(): void {
    // V2 hub: per-hub channel, hub banner, travel portal
    const hub = normalizeHub(this.registry.get("hub") as string | undefined);

    this.doors = [];
    this.nearDoor = null;
    this.dialogOpen = false;
    this.wanderers = [];

    const solids = this.physics.add.staticGroup();

    this.buildGround();
    this.buildBuildings(solids);
    this.buildTrees(solids);
    this.buildProps(solids);
    this.buildLamps(solids);

    // hub banner (top center, small)
    this.add
      .text(MAP_W * TILE / 2, 6, HUBS[hub].name.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "10px",
        color: HUBS[hub].accent,
        backgroundColor: "#18181bcc",
        padding: { x: 6, y: 3 },
        resolution: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(70)
      .setScrollFactor(0);

    this.buildPortal();

    this.buildNpcs();
    this.buildPlayer(solids);

    this.physics.world.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE);
    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    camFadeIn(this, 300);

    // DOM-level keyboard input: works for real players and automated tests
    // alike, and keeps working regardless of canvas focus quirks.
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.unsubscribers.push(
      onGame("knock:send", (payload) => this.onKnockSent(payload.doorId, payload.reason, payload.message)),
      onGame("dialog:open", () => {
        // opened from the React HUD (click/tap path) — freeze movement
        this.dialogOpen = true;
      }),
      onGame("touch:move", (vec) => {
        this.touchVec = vec;
      }),
      onGame("touch:interact", () => this.tryOpenKnockDialog()),
      onGame("friend:goknock", ({ roomId }) => {
        const door = roomId ? this.doors.find((d) => d.roomId === roomId) : null;
        if (door) {
          this.player.setPosition(door.x, door.y + 40);
          camFlash(this);
        } else {
          emitGame("toast", "Their room is not on display in this hub right now.");
        }
      }),
      onGame("come:send", () => {
        const identity = this.registry.get("netIdentity") as { key: string; username: string } | undefined;
        if (identity) {
          this.net?.sendComeHere({
            ownerKey: identity.key,
            ownerName: identity.username,
            roomId: (this.registry.get("myRoomId") as string | null) ?? null,
          });
        }
      }),
      onGame("come:accept", () => {
        const invite = this.activeInvite;
        this.activeInvite = null;
        if (!invite) return;
        const door = invite.roomId ? this.doors.find((d) => d.roomId === invite.roomId) : null;
        if (!door) {
          emitGame("toast", invite.ownerName + String.fromCharCode(8217) + "s room is not in view right now.");
          return;
        }
        // The invitation is permission: record an accepted knock so the
        // knock-first door check passes, then walk in.
        this.player.setPosition(door.x, door.y + 30);
        camFlash(this);
        void this.admitByInvite(invite.roomId!, door);
      }),
      onGame("dialog:closed", () => {
        this.dialogOpen = false;
      }),
      onGame("room:update", (event) => {
        this.applyRoomUpdate(event);
        this.net?.sendRoomState(event);
      }),
      onGame("knock:respond", (response) => {
        const identity = this.registry.get("netIdentity") as { username: string } | undefined;
        this.net?.sendKnockResult({
          knockId: response.knockId,
          roomId: response.roomId,
          visitorKey: response.visitorKey,
          accepted: response.accepted,
          ownerName: identity?.username ?? "The owner",
        });
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      this.unsubscribers = [];
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      this.pressed.clear();
      this.net?.destroy();
      this.net = undefined;
      this.metaTimer?.destroy();
      if (this.metaChannel && this.supabase) void this.supabase.removeChannel(this.metaChannel);
      this.remotes.forEach((r) => this.destroyRemote(r));
      this.remotes.clear();
      emitGame("door:near", null);
    });

    this.connectRealtime();
  }

  // --- realtime multiplayer (Phase 3) --------------------------------------

  private connectRealtime(): void {
    const identity = this.registry.get("netIdentity") as PlayerIdentity | undefined;
    if (!identity || !isSupabaseConfigured) return;

    try {
      const supabase = createSupabaseClient();
      const hub = normalizeHub(this.registry.get("hub") as string | undefined);
      const channelName = "knock:hub:" + hub;
      this.net = new RealtimeService(supabase, identity, channelName, {
        onPlayers: (players) => this.syncRemotePlayers(players),
        onPosition: (event) => this.onRemotePosition(event),
        onRoomState: (event) => this.applyRoomUpdate(event),
        onKnock: (event) => this.onIncomingKnock(event),
        onComeHere: (event) => {
          const identity = this.registry.get("netIdentity") as { key: string } | undefined;
          if (!identity || event.ownerKey === identity.key) return;
          const door = event.roomId ? this.doors.find((d) => d.roomId === event.roomId) : null;
          if (door) {
            const beacon = this.add.text(door.x, door.building.y * TILE - 40, "▼", {
              fontFamily: "monospace", fontSize: "16px", color: "#fbbf24",
              backgroundColor: "#18181be6", padding: { x: 3, y: 1 }, resolution: 3,
            }).setOrigin(0.5, 1).setDepth(60);
            this.tweens.add({ targets: beacon, y: beacon.y + 6, duration: 600, yoyo: true, repeat: 29 });
            this.time.delayedCall(30000, () => beacon.destroy());
          }
          this.activeInvite = event;
          emitGame("come:invite", { ownerName: event.ownerName, ownerKey: event.ownerKey });
        },
        onKnockResult: (event) => {
          const identity = this.registry.get("netIdentity") as { key: string } | undefined;
          if (!identity || event.visitorKey !== identity.key) return;
          if (!event.accepted) {
            emitGame("toast", `${event.ownerName} said "not now" — maybe later.`);
            return;
          }
          // Admitted: walk the visitor to the door and straight inside.
          const door = event.roomId ? this.doors.find((d) => d.roomId === event.roomId) : null;
          if (!door) {
            emitGame("toast", `${event.ownerName} let you in — but their room is not on display in this hub.`);
            return;
          }
          emitGame("toast", `🟢 ${event.ownerName} let you in!`);
          this.dialogOpen = false;
          emitGame("dialog:closed");
          this.player.setPosition(door.x, door.y + 30);
          camFlash(this);
          void this.enterRoom(door);
        },
      });
      void this.net.connect();
      // meta pings: which hub every signed-in builder is in right now
      const meta = supabase.channel("knock:hubs-meta");
      meta.on("broadcast", { event: "here" }, () => {});
      void meta.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          const ping = () =>
            void meta.send({
              type: "broadcast",
              event: "here",
              payload: { hub, userKey: identity.key, username: identity.username },
            });
          ping();
          this.metaTimer = this.time.addEvent({ delay: 8000, loop: true, callback: ping });
        }
      });
      this.metaChannel = meta;
    } catch {
      // networking is best-effort — the world works without it
    }
  }

  private onlineKeys = new Set<string>();

  private syncRemotePlayers(players: Array<{ key: string; username: string; char: string; guest: boolean }>): void {
    this.onlineKeys = new Set(players.map((p) => p.key));
    const seen = new Set(players.map((p) => p.key));
    for (const p of players) {
      const existing = this.remotes.get(p.key);
      if (existing) continue;
      this.spawnRemote(p.key, p.username, p.char, p.guest);
    }
    for (const [key, remote] of this.remotes) {
      if (!seen.has(key)) {
        this.tweens.add({
          targets: [remote.sprite, remote.label, remote.shadow],
          alpha: 0,
          duration: 400,
          onComplete: () => this.destroyRemote(remote),
        });
        this.remotes.delete(key);
      }
    }
  }

  private spawnRemote(key: string, username: string, char: string, guest: boolean): void {
    const x = SPAWN.x * TILE + (this.remotes.size - 1) * 20;
    const y = SPAWN.y * TILE;
    const sprite = this.add
      .sprite(x, y, `char-${char}`)
      .setOrigin(0.5, 0.9)
      .setDepth(y)
      .setFrame(idleFrame(0))
      .setAlpha(0);
    const shadow = this.makeShadow(x, y + 4, y - 1).setAlpha(0);
    const label = this.add
      .text(x, y - 34, username + (guest ? " (guest)" : ""), {
        fontFamily: "monospace",
        fontSize: "8px",
        color: guest ? "#a8a29e" : "#93c5fd",
        backgroundColor: "#0c0a09e0",
        padding: { x: 2, y: 1 },
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 1)
      .setAlpha(0);
    this.tweens.add({ targets: [sprite, label, shadow], alpha: 1, duration: 300 });

    this.remotes.set(key, {
      key, username, char, guest,
      sprite, shadow, label,
      targetX: x, targetY: y, dir: 0, moving: false,
      lastSeen: this.time.now,
    });
  }

  private onRemotePosition(event: PositionEvent): void {
    const remote = this.remotes.get(event.key);
    if (!remote) return; // position for someone presence hasn't introduced yet
    remote.targetX = event.x;
    remote.targetY = event.y;
    remote.dir = event.dir;
    remote.moving = event.moving;
    remote.lastSeen = this.time.now;
  }

  private destroyRemote(remote: RemotePlayer): void {
    remote.sprite.destroy();
    remote.shadow.destroy();
    remote.label.destroy();
  }

  /** Interpolate remote characters toward their latest broadcast position. */
  private updateRemotes(delta: number): void {
    const lerp = Math.min(1, (delta / 1000) * 8);
    for (const remote of this.remotes.values()) {
      const dx = remote.targetX - remote.sprite.x;
      const dy = remote.targetY - remote.sprite.y;
      remote.sprite.x += dx * lerp;
      remote.sprite.y += dy * lerp;

      const animKey = `char-${remote.char}-${CHAR_DIRS[remote.dir]}`;
      if (remote.moving && remote.sprite.anims.currentAnim?.key !== animKey) {
        remote.sprite.anims.play(animKey);
      } else if (!remote.moving && remote.sprite.anims.isPlaying) {
        remote.sprite.anims.stop();
        remote.sprite.setFrame(idleFrame(remote.dir));
      }

      remote.sprite.setDepth(remote.sprite.y);
      remote.shadow.setPosition(remote.sprite.x, remote.sprite.y + 4).setDepth(remote.sprite.y - 1);
      remote.label.setPosition(remote.sprite.x, remote.sprite.y - 34).setDepth(remote.sprite.y + 1);
    }
  }

  update(time: number, delta: number): void {
    if (!this.player?.active) return;

    if (!this.dialogOpen) {
      let vx = this.touchVec.x;
      let vy = this.touchVec.y;
      if (this.pressed.has("a") || this.pressed.has("arrowleft")) vx -= 1;
      if (this.pressed.has("d") || this.pressed.has("arrowright")) vx += 1;
      if (this.pressed.has("w") || this.pressed.has("arrowup")) vy -= 1;
      if (this.pressed.has("s") || this.pressed.has("arrowdown")) vy += 1;
      if (vx === 0 && vy === 0) { /* nothing */ }

      const moving = vx !== 0 || vy !== 0;
      if (moving) {
        const len = Math.hypot(vx, vy);
        this.player.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);

        // pick the dominant axis so diagonals keep a sensible facing
        const dir =
          Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
        if (dir !== this.currentDir || !this.player.anims.isPlaying) {
          this.currentDir = dir;
          this.player.anims.play(`char-${PLAYER_CHAR}-${CHAR_DIRS[dir]}`, true);
        }
      } else {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setFrame(idleFrame(this.currentDir));
      }

      this.updateNearDoor();
      if (this.portalPos) {
        const nearPortal =
          Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portalPos.x, this.portalPos.y) < 70;
        if (nearPortal !== this.wasNearPortal) {
          this.wasNearPortal = nearPortal;
          emitGame("portal:near", nearPortal);
        }
      }
    }

    this.updateWanderers(time, delta);
    this.updateRemotes(delta);

    // broadcast our own movement (throttled inside the service)
    if (this.net && this.player?.active) {
      const moving = (this.player.body?.velocity.lengthSq() ?? 0) > 1;
      this.net.sendPosition(
        Math.round(this.player.x),
        Math.round(this.player.y),
        this.currentDir,
        moving,
        time,
      );
    }
  }

  // --- world construction (Warm Dusk) ----------------------------------------

  /**
   * Terrain per the reference: circular pond first, then the brick plaza,
   * then dirt paths stamped along lines (paths skip pond and plaza cells).
   */
  private buildGroundGrid(): void {
    const pondCx = POND.cx * TILE;
    const pondCy = POND.cy * TILE;
    const pondR = POND.r * TILE;
    for (let gy = 0; gy < MAP_H; gy++) {
      for (let gx = 0; gx < MAP_W; gx++) {
        // deterministic ±6px jitter on the pond rim, like the reference
        const jitter = (((gx * 73856093) ^ (gy * 19349663)) % 13) - 6;
        if (Math.hypot(gx * TILE + 16 - pondCx, gy * TILE + 16 - pondCy) < pondR + jitter) {
          this.grid[gy * MAP_W + gx] = 3;
        }
      }
    }
    for (let gy = PLAZA.y; gy < PLAZA.y + PLAZA.h; gy++) {
      for (let gx = PLAZA.x; gx < PLAZA.x + PLAZA.w; gx++) {
        this.grid[gy * MAP_W + gx] = 2;
      }
    }
    const width = TILE * 0.9;
    for (const [a, b] of PATH_LINES) {
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.round(len / 0.5));
      for (let i = 0; i <= steps; i++) {
        const px = (a.x + ((b.x - a.x) * i) / steps) * TILE + 16;
        const py = (a.y + ((b.y - a.y) * i) / steps) * TILE + 16;
        for (let gy = Math.floor((py - width) / TILE); gy <= Math.floor((py + width) / TILE); gy++) {
          for (let gx = Math.floor((px - width) / TILE); gx <= Math.floor((px + width) / TILE); gx++) {
            if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) continue;
            if (this.grid[gy * MAP_W + gx] === 0) this.grid[gy * MAP_W + gx] = 1;
          }
        }
      }
    }
    // water foam edges: bit per non-water neighbour (1 up, 2 down, 4 left, 8 right)
    for (let gy = 0; gy < MAP_H; gy++) {
      for (let gx = 0; gx < MAP_W; gx++) {
        const idx = gy * MAP_W + gx;
        if (this.grid[idx] !== 3) continue;
        let m = 0;
        if (gy > 0 && this.grid[idx - MAP_W] !== 3) m |= 1;
        if (gy < MAP_H - 1 && this.grid[idx + MAP_W] !== 3) m |= 2;
        if (gx > 0 && this.grid[idx - 1] !== 3) m |= 4;
        if (gx < MAP_W - 1 && this.grid[idx + 1] !== 3) m |= 8;
        this.foamMask[idx] = m;
      }
    }
  }

  private cell(gx: number, gy: number): number {
    if (gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H) return 0;
    return this.grid[gy * MAP_W + gx];
  }

  private buildGround(): void {
    this.buildGroundGrid();
    const rt = this.add
      .renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE)
      .setOrigin(0, 0)
      .setDepth(-10);

    for (let gy = 0; gy < MAP_H; gy++) {
      for (let gx = 0; gx < MAP_W; gx++) {
        const idx = gy * MAP_W + gx;
        const tile = this.grid[idx];
        const tx = gx * TILE;
        const ty = gy * TILE;
        if (tile === 0) {
          const hash = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
          rt.draw(`wd_grass${hash % 3}`, tx, ty);
        } else if (tile === 1) {
          rt.draw("wd_dirt", tx, ty);
        } else if (tile === 2) {
          rt.draw("wd_plaza", tx, ty);
        } else {
          rt.draw("wd_water", tx, ty);
          if (this.foamMask[idx]) rt.draw(`wd_foam_${this.foamMask[idx]}`, tx, ty);
        }
      }
    }
    // soft blends where dirt/plaza meet grass (reference pass)
    for (let gy = 0; gy < MAP_H; gy++) {
      for (let gx = 0; gx < MAP_W; gx++) {
        const tile = this.grid[gy * MAP_W + gx];
        if (tile !== 1 && tile !== 2) continue;
        const nearGrass =
          this.cell(gx, gy - 1) === 0 || this.cell(gx, gy + 1) === 0 ||
          this.cell(gx - 1, gy) === 0 || this.cell(gx + 1, gy) === 0;
        if (nearGrass) rt.draw(tile === 1 ? "wd_transDirt" : "wd_transPlaza", gx * TILE, gy * TILE);
      }
    }

    // Phaser 4 buffers RenderTexture draw commands — flush them
    rt.render();
  }

  private buildBuildings(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const b of BUILDINGS) {
      const bx = b.x * TILE;
      const by = b.y * TILE;
      const bw = b.w * TILE;
      const bh = b.h * TILE;
      const baseY = by + bh;
      const doorX = (b.x + b.w / 2) * TILE;

      // soft shadow at the base (reference)
      this.add.rectangle(bx + bw / 2 + 3, baseY - 2, bw, 10, 0x000000, 0.25).setDepth(baseY - 2);

      const sprite = this.add
        .image(bx, by, `wd_bldg_${b.id}`)
        .setOrigin(0, 0)
        .setDepth(baseY);
      void sprite;

      this.add
        .image(doorX, baseY, "wd_door")
        .setOrigin(0.5, 1)
        .setDepth(baseY + 1);

      // walls block; the two roof rows are walk-behind (depth sorted)
      const body = this.add
        .rectangle(bx + bw / 2, by + 2 * TILE + (bh - 2 * TILE) / 2, bw, bh - 2 * TILE)
        .setVisible(false);
      solids.add(body);

      this.lastNameplate = this.addNameplate(b);
      this.addDoor(b);
    }
  }

  private addNameplate(b: BuildingSpec): Phaser.GameObjects.Text {
    const info = this.roomDoorInfo(b);
    const line2 = b.roomType === "personal" ? info.activity : doorStateLabel(info.state);
    const cx = (b.x + b.w / 2) * TILE;
    return this.add
      .text(cx, b.y * TILE - 6, `${info.buildingName}\n${line2}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#fef3c7",
        backgroundColor: "#0c0a09e0",
        padding: { x: 4, y: 2 },
        align: "center",
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth((b.y + b.h) * TILE + 2);
  }

  /**
   * Real rooms from the database replace the mock residents: the three
   * personal slots are filled with the freshest actual rooms (guests and
   * empty databases keep the mock neighborhood so the world always works).
   */
  private roomDoorInfo(b: BuildingSpec): (typeof DOORS)[string] {
    if (b.roomType !== "personal") return DOORS[b.id];
    const rooms = (this.registry.get("worldRooms") ?? []) as Array<{
      roomId: string;
      ownerId: string;
      username: string;
      activity: string;
      doorState: "open" | "knock" | "focus" | "private";
    }>;
    const slot = PERSONAL_SLOTS.indexOf(b.id);
    if (slot === -1) return DOORS[b.id];
    const mock = DOORS[b.id];
    const room = rooms[slot];
    if (!room) return mock;
    return {
      ...mock,
      id: b.id,
      buildingName: `${room.username}'s Room`,
      owner: room.username,
      activity: room.activity || "Building something",
      state: room.doorState === "private" ? "focus" : room.doorState,
    };
  }

  private addDoor(b: BuildingSpec): void {
    const info = this.roomDoorInfo(b);
    const pos = doorWorldPos(b);
    const lightY = (b.y + b.h) * TILE - 30;
    const color = DOOR_LIGHT[info.state];

    const halo = this.add.circle(pos.x, lightY, 7, color, 0.6).setDepth((b.y + b.h) * TILE + 2);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.4, to: 0.8 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    const light = this.add.circle(pos.x, lightY, 3, color).setDepth((b.y + b.h) * TILE + 3);

    const rooms = (this.registry.get("worldRooms") ?? []) as Array<{ roomId: string; ownerId: string }>;
    const slot = PERSONAL_SLOTS.indexOf(b.id);
    const room = slot !== -1 ? rooms[slot] : undefined;

    this.doors.push({
      info,
      building: b,
      x: pos.x,
      y: pos.y,
      nameplate: this.lastNameplate!,
      light,
      halo,
      roomId: room?.roomId,
      ownerId: room?.ownerId,
    });
  }

  private lastNameplate?: Phaser.GameObjects.Text;

  /** Live door updates from this tab's HUD or from other players. */
  private applyRoomUpdate(event: RoomUpdateEvent): void {
    const door = this.doors.find((d) => d.roomId === event.roomId);
    if (!door) return;
    door.info = {
      ...door.info,
      owner: event.username,
      buildingName: `${event.username}'s Room`,
      activity: event.activity || "Building something",
      state: event.doorState,
    };
    const line2 =
      door.building.roomType === "personal"
        ? door.info.activity
        : doorStateLabel(door.info.state);
    door.nameplate.setText(`${door.info.buildingName}\n${line2}`);
    door.light.setFillStyle(DOOR_LIGHT[event.doorState]);
    door.halo?.setFillStyle(DOOR_LIGHT[event.doorState]);
  }

  private buildTrees(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const t of TREES) {
      const px = t.x * TILE + 16;
      const py = (t.y + 1) * TILE;
      // soft shadow under the canopy (reference: 28x8 bar at the trunk base)
      this.add.rectangle(px, py + 2, 28, 8, 0x000000, 0.25).setDepth(-7);
      this.add
        .image(px, py + 2, `wd_tree_${t.variant}`)
        .setOrigin(0.5, 1)
        .setDepth(py);
      // collision covers the trunk base only, so the canopy hangs overhead
      const body = this.add.rectangle(px, py + 6, 16, 12).setVisible(false);
      solids.add(body);
    }
  }

  private buildProps(solids: Phaser.Physics.Arcade.StaticGroup): void {
    // the plaza well (reference position)
    const wellX = WELL.x * TILE;
    const wellY = WELL.y * TILE;
    this.add
      .image(wellX + 16, wellY + 18, "wd_shadow")
      .setOrigin(0.5, 0.5)
      .setDepth(wellY + 3);
    this.add
      .image(wellX, wellY + 4, "wd_well")
      .setOrigin(0.5, 1)
      .setDepth(wellY + 4);
    const wellBody = this.add.rectangle(wellX, wellY - 4, 28, 14).setVisible(false);
    solids.add(wellBody);

    for (const bush of BUSHES) {
      this.add
        .image(bush.x * TILE + 16, bush.y * TILE + 22, "wd_bush")
        .setOrigin(0.5, 1)
        .setDepth(bush.y * TILE + 22);
    }

    for (const [gi, group] of FLOWER_GROUPS.entries()) {
      const R = mulberry32(101 + gi * 17);
      for (let i = 0; i < group.n; i++) {
        const fx = (group.x + (R() * 2.4 - 1.2)) * TILE + 16;
        const fy = (group.y + (R() * 2.4 - 1.2)) * TILE + 16;
        const color = group.palette[(R() * group.palette.length) | 0];
        this.add
          .image(fx - 5, fy - 11, `wd_flower_${color.slice(1)}`)
          .setOrigin(0, 0)
          .setDepth(fy);
      }
    }
  }

  private buildLamps(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const lamp of LAMPS) {
      const px = lamp.x * TILE;
      const py = lamp.y * TILE;
      this.add
        .image(px, py + 2, "wd_lamp")
        .setOrigin(0.5, 1)
        .setDepth(py + 2);

      const glow = this.add.ellipse(px, py - 30, 52, 52, 0xfbbf24, 0.18).setDepth(py + 1);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.24 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });

      const body = this.add.rectangle(px, py - 4, 14, 12).setVisible(false);
      solids.add(body);
    }
  }

  /** World portal: walk up and press E to open the world map (V2 travel). */
  private buildPortal(): void {
    const px = 36.5 * TILE;
    const py = 24.5 * TILE;
    const ring1 = this.add.ellipse(px, py, 44, 60, 0x7c3aed, 0.35).setDepth(49);
    const ring2 = this.add.ellipse(px, py, 26, 38, 0xa78bfa, 0.5).setDepth(49);
    this.add
      .text(px, py - 52, "WORLD PORTAL", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: "#ddd6fe",
        backgroundColor: "#18181bcc",
        padding: { x: 4, y: 2 },
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(50);
    this.tweens.add({
      targets: [ring1, ring2],
      scaleX: { from: 0.85, to: 1.1 },
      scaleY: { from: 1.1, to: 0.9 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });
    this.portalPos = { x: px, y: py };
  }

  private wasNearPortal = false;
  private portalPos: { x: number; y: number } | null = null;

  /** Invited over: persist an accepted knock, then enter the room. */
  private async admitByInvite(roomId: string, door: DoorRuntime): Promise<void> {
    const identity = this.registry.get("netIdentity") as
      | { key: string; guest: boolean }
      | undefined;
    if (identity && !identity.guest) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        await supabase.from("knocks").insert({
          id: crypto.randomUUID(),
          room_id: roomId,
          visitor_id: identity.key,
          reason: "Invited over",
          message: "",
          status: "accepted",
        });
      } catch {
        // best effort — an open door still admits us below
      }
    }
    this.dialogOpen = false;
    emitGame("dialog:closed");
    void this.enterRoom(door);
  }

  private makeShadow(x: number, y: number, depth: number) {
    return this.add.image(x, y, "wd_shadow").setOrigin(0.5, 0.5).setDepth(depth);
  }

  private addCharLabel(sprite: Phaser.GameObjects.Sprite, text: string, color: string) {
    this.add
      .text(sprite.x, sprite.y - 34, text, {
        fontFamily: "monospace",
        fontSize: "8px",
        color,
        backgroundColor: "#0c0a09e0",
        padding: { x: 2, y: 1 },
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(sprite.depth + 1);
  }

  private buildNpcs(): void {
    for (const npc of NPCS) {
      const px = npc.x * TILE;
      const py = npc.y * TILE;
      const sprite = this.add
        .sprite(px, py, `char-${npc.char}`)
        .setOrigin(0.5, 0.9)
        .setDepth(py)
        .setFrame(idleFrame(npc.facing));
      this.makeShadow(px, py + 4, py - 1);
      this.addCharLabel(sprite, `${npc.name} — ${npc.status}`, "#a8a29e");

      // gentle idle sway so standing characters still feel alive
      this.tweens.add({
        targets: sprite,
        y: py - 2,
        duration: 1300 + (npc.x * 137) % 400,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });

      if (npc.waypoints && npc.waypoints.length > 1) {
        this.wanderers.push({
          sprite,
          points: npc.waypoints.map((w) => ({ x: w.x * TILE, y: w.y * TILE })),
          target: 1,
          speed: 64,
          pauseUntil: 0,
        });
      }
    }
  }

  private updateWanderers(time: number, delta: number): void {
    const dt = delta / 1000;
    for (const w of this.wanderers) {
      if (time < w.pauseUntil) {
        w.sprite.anims.stop();
        continue;
      }
      const dest = w.points[w.target];
      const dx = dest.x - w.sprite.x;
      const dy = dest.y - w.sprite.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) {
        w.target = (w.target + 1) % w.points.length;
        w.pauseUntil = time + 900; // look around at each stop
        continue;
      }
      const step = Math.min(w.speed * dt, dist);
      w.sprite.x += (dx / dist) * step;
      w.sprite.y += (dy / dist) * step;
      w.sprite.setDepth(w.sprite.y);

      const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
      const animKey = `char-${w.sprite.texture.key.replace("char-", "")}-${CHAR_DIRS[dir]}`;
      if (w.sprite.anims.currentAnim?.key !== animKey) {
        w.sprite.anims.play(animKey);
      }
    }
  }

  private buildPlayer(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const returnPos = this.registry.get("returnPos") as { x: number; y: number } | undefined;
    this.registry.remove("returnPos");
    const px = returnPos?.x ?? SPAWN.x * TILE;
    const py = returnPos?.y ?? SPAWN.y * TILE;
    this.playerShadow = this.makeShadow(px, py + 4, 48);
    this.player = this.physics.add
      .sprite(px, py, `char-${PLAYER_CHAR as CharacterKey}`)
      .setOrigin(0.5, 0.9)
      .setDepth(py);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(16, 12, true);
    this.player.setFrame(idleFrame(this.currentDir));
    this.physics.add.collider(this.player, solids);

    const playerName = this.registry.get("playerName") as string | undefined;
    if (playerName) {
      this.playerLabel = this.add
        .text(px, py - 36, playerName, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#fef3c7",
          backgroundColor: "#0c0a09e0",
          padding: { x: 2, y: 1 },
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(51);
    }

    // keep the shadow and label glued to the player's feet/head, and the
    // player depth-sorted against buildings and trees
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.player?.active) {
        this.player.setDepth(this.player.y);
        this.playerShadow.setPosition(this.player.x, this.player.y + 4).setDepth(this.player.y - 1);
        this.playerLabel?.setPosition(this.player.x, this.player.y - 36).setDepth(this.player.y + 1);
      }
    });
  }

  private playerLabel?: Phaser.GameObjects.Text;

  // --- interaction --------------------------------------------------------

  private tryOpenKnockDialog(): void {
    if (this.dialogOpen) return;
    if (this.portalPos && this.player) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.portalPos.x, this.portalPos.y);
      if (d < 70) {
        emitGame("worldmap:open");
        return;
      }
    }
    if (!this.nearDoor) return;
    const door = this.nearDoor;

    // Real doors: open doors and owner's own door go straight inside
    if (door.roomId) {
      const myRoomId = this.registry.get("myRoomId");
      if (door.roomId === myRoomId || door.info.state === "open") {
        void this.enterRoom(door);
        return;
      }
    }

    this.dialogOpen = true;
    emitGame("knock:open", door.info);
  }

  /** Rooms with knock-first doors check for an accepted knock before entry. */
  private async enterRoom(door: DoorRuntime): Promise<void> {
    if (this.dialogOpen) return;
    const identity = this.registry.get("netIdentity") as
      | { key: string; guest: boolean; username: string; char: string }
      | undefined;

    if (!identity || identity.guest) {
      emitGame("toast", "Sign in to enter real rooms.");
      return;
    }
    if (door.info.state === "focus" && door.roomId !== this.registry.get("myRoomId")) {
      emitGame("toast", `${door.info.owner} is in focus mode — try again later.`);
      return;
    }
    if (door.info.state === "knock" && door.roomId !== this.registry.get("myRoomId")) {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data } = await supabase
          .from("knocks")
          .select("id")
          .eq("room_id", door.roomId)
          .eq("visitor_id", identity.key)
          .eq("status", "accepted")
          .limit(1);
        if (!data || data.length === 0) {
          this.dialogOpen = true;
          emitGame("knock:open", door.info);
          return;
        }
      } catch {
        this.dialogOpen = true;
        emitGame("knock:open", door.info);
        return;
      }
    }

    this.dialogOpen = true;
    camFadeOut(this, () => {
      this.registry.set("roomSceneData", {
        roomId: door.roomId,
        ownerName: door.info.owner,
        exit: { x: Math.round(this.player.x), y: Math.round(this.player.y + TILE) },
        identity,
      });
      this.scene.start("room");
    });
  }

  private updateNearDoor(): void {
    let best: DoorRuntime | null = null;
    let bestDist = DOOR_INTERACT_DISTANCE;
    for (const door of this.doors) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        door.x,
        door.y + 20,
      );
      if (d < bestDist) {
        best = door;
        bestDist = d;
      }
    }
    if (best?.info.id !== this.nearDoor?.info.id) {
      this.nearDoor = best;
      const payload = best
        ? {
            ...best.info,
            roomId: best.roomId,
            ownerOnline: best.ownerId ? this.onlineKeys.has(best.ownerId) : undefined,
          }
        : null;
      emitGame("door:near", payload);
    }
  }

  private onKnockSent(doorId: string, reason: string, message: string): void {
    const door = this.doors.find((d) => d.info.id === doorId);
    if (!door) return;

    this.showKnockBubble(door);
    const identity = this.registry.get("netIdentity") as
      | { key: string; username: string; guest: boolean }
      | undefined;

    if (!door.roomId) {
      // mock door (guest world) — keep the local mock flow
      emitGame("toast", `Knock sent to ${door.info.owner} — realtime delivery arrives in Phase 3.`);
      return;
    }
    if (!identity || identity.guest) {
      emitGame("toast", `${door.info.owner} has a real room — sign in to knock for real.`);
      return;
    }
    if (door.roomId === (this.registry.get("myRoomId") ?? null)) {
      emitGame("toast", "That's your own room — no need to knock 🙂");
      return;
    }

    // real knock: persist it, then deliver live if the owner is online
    this.persistKnock(door, identity, reason, message);
  }

  private async persistKnock(
    door: DoorRuntime,
    identity: { key: string; username: string; guest: boolean },
    reason: string,
    message: string,
  ): Promise<void> {
    const knockId = crypto.randomUUID();
    emitGame("toast", `Knocking on ${door.info.owner}'s door…`);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { error } = await supabase.from("knocks").insert({
        id: knockId,
        room_id: door.roomId,
        visitor_id: identity.key,
        reason,
        message,
      });
      if (error) throw error;
    } catch {
      emitGame("toast", "Could not send the knock — try again.");
      return;
    }

    this.net?.sendKnock({
      knockId,
      roomId: door.roomId!,
      visitorKey: identity.key,
      visitorName: identity.username,
      reason,
      message,
    });
    emitGame("toast", `Knock sent to ${door.info.owner} — waiting by the door…`);
  }

  /** The owner side: someone knocked at MY door in real time. */
  private onIncomingKnock(event: {
    knockId: string;
    roomId: string;
    visitorKey: string;
    visitorName: string;
    reason: string;
    message: string;
  }): void {
    const myRoomId = this.registry.get("myRoomId");
    if (event.roomId !== myRoomId) return;
    const door = this.doors.find((d) => d.roomId === event.roomId);
    if (door) this.showKnockBubble(door);
    emitGame("knock:incoming", {
      knockId: event.knockId,
      roomId: event.roomId,
      visitorName: event.visitorName,
      reason: event.reason,
      message: event.message,
      visitorKey: event.visitorKey,
    });
  }

  private showKnockBubble(door: DoorRuntime): void {
    const bubble = this.add
      .text(door.x, door.building.y * TILE - 30, "!", {
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
        color: "#fde047",
        backgroundColor: "#18181be6",
        padding: { x: 4, y: 2 },
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(60)
      .setScale(0);

    this.tweens.add({
      targets: bubble,
      scale: { from: 0, to: 1 },
      duration: 220,
      ease: "Back.Out",
      onComplete: () => {
        this.time.delayedCall(2400, () => bubble.destroy());
      },
    });
  }
}
