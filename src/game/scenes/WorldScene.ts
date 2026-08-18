import Phaser from "phaser";
import {
  DOOR_INTERACT_DISTANCE,
  HUBS,
  normalizeHub,
  DOOR_STATE_COLORS,
  MAP_H,
  MAP_W,
  PLAYER_CHAR,
  PLAYER_SPEED,
  TILE,
  ZOOM,
} from "../constants";
import { emitGame, onGame } from "../EventBus";
import {
  BENCHES,
  BUILDINGS,
  DECOR,
  DOORS,
  GARDENS,
  LAMPS,
  NPCS,
  PATHS,
  PLAZA,
  POND,
  PROPS,
  SPAWN,
  TREES,
  doorStateLabel,
  doorWorldPos,
} from "../worldData";
import type { BuildingSpec, CharacterKey } from "../types";
import { RealtimeService } from "../net/RealtimeService";
import type { PlayerIdentity, PositionEvent } from "../net/RealtimeService";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

interface RemotePlayer {
  key: string;
  username: string;
  char: string;
  guest: boolean;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
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
  roomId?: string;
  ownerId?: string;
}

interface RoomUpdateEvent {
  roomId: string;
  doorState: "open" | "knock" | "focus";
  activity: string;
  username: string;
}

const ROOF_TILES: Record<BuildingSpec["roof"], { top: number; body: number }> = {
  red: { top: 52, body: 53 },
  red2: { top: 64, body: 65 },
  orange: { top: 72, body: 73 },
  stone: { top: 108, body: 109 },
};

const CHAR_DIRS = ["down", "left", "right", "up"] as const;

/** Personal building slots filled by real database rooms, in order. */
const PERSONAL_SLOTS = ["reehana", "ahmed", "sara"];

/** Idle frame (row start) per direction for a 2x4 character sheet. */
function idleFrame(facing: number): number {
  return facing * 2;
}

/**
 * The playable pixel world. Phase 1 is entirely local: mock residents, mock
 * door states, no backend. The scene talks to the React HUD through EventBus.
 */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private pressed = new Set<string>();
  private doors: DoorRuntime[] = [];
  private nearDoor: DoorRuntime | null = null;
  private dialogOpen = false;
  private currentDir = 0; // 0 down, 1 left, 2 right, 3 up
  private unsubscribers: Array<() => void> = [];
  private net?: RealtimeService;
  private activeInvite: { ownerName: string; ownerKey: string; roomId: string | null } | null = null;
  private remotes = new Map<string, RemotePlayer>();
  private wanderers: Array<{
    sprite: Phaser.GameObjects.Sprite;
    points: Array<{ x: number; y: number }>;
    target: number;
    speed: number;
    pauseUntil: number;
  }> = [];

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
    // V2 hub: biome ground, per-hub channel, hub banner, travel portal
    const hub = normalizeHub(this.registry.get("hub") as string | undefined);
    this.biome = WorldScene.BIOME[HUBS[hub].ground] ?? WorldScene.BIOME.grass;

    this.doors = [];
    this.nearDoor = null;
    this.dialogOpen = false;
    this.wanderers = [];

    const solids = this.physics.add.staticGroup();

    this.buildGround();
    this.buildBuildings(solids);
    this.buildTrees(solids);
    this.buildGardens(solids);
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
    this.cameras.main.fadeIn(300, 0, 0, 0);

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
        if (door) {
          this.player.setPosition(door.x, door.y + 40);
          this.cameras.main.flash(200, 20, 60, 40);
        } else {
          emitGame("toast", invite.ownerName + String.fromCharCode(8217) + "s room is not in view right now.");
        }
      }),
      onGame("dialog:closed", () => {
        this.dialogOpen = false;
      }),
      onGame("room:update", (event: RoomUpdateEvent) => {
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
          if (identity && event.visitorKey === identity.key) {
            emitGame(
              "toast",
              event.accepted
                ? `🟢 ${event.ownerName} let you in! (Room interiors arrive in Phase 6)`
                : `${event.ownerName} said "not now" — maybe later.`,
            );
          }
        },
      });
      void this.net.connect();
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
      .setScale(2)
      .setDepth(49)
      .setFrame(idleFrame(0))
      .setAlpha(0);
    const shadow = this.makeShadow(x, y + 4, 48).setAlpha(0);
    const label = this.add
      .text(x, y - 40, username + (guest ? " (guest)" : ""), {
        fontFamily: "monospace",
        fontSize: "8px",
        color: guest ? "#a1a1aa" : "#93c5fd",
        backgroundColor: "#18181bcc",
        padding: { x: 2, y: 1 },
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(50)
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

      remote.shadow.setPosition(remote.sprite.x, remote.sprite.y + 4);
      remote.label.setPosition(remote.sprite.x, remote.sprite.y - 40);
    }
  }

  update(time: number, delta: number): void {
    if (!this.player?.active) return;

    if (!this.dialogOpen) {
      let vx = 0;
      let vy = 0;
      if (this.pressed.has("a") || this.pressed.has("arrowleft")) vx -= 1;
      if (this.pressed.has("d") || this.pressed.has("arrowright")) vx += 1;
      if (this.pressed.has("w") || this.pressed.has("arrowup")) vy -= 1;
      if (this.pressed.has("s") || this.pressed.has("arrowdown")) vy += 1;

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

  // --- world construction -------------------------------------------------

  /**
   * LPC auto-terrain ground: every cell is grass, dirt (paths/plaza) or
   * water, and each tile's four corners pick the correct transition piece
   * from the LPC atlas (Tiled's corner rule), giving soft blended edges
   * everywhere like a hand-painted map.
   */
  private terrainAt(tx: number, ty: number): "g" | "d" | "w" {
    if (tx >= POND.x && tx < POND.x + POND.w && ty >= POND.y && ty < POND.y + POND.h) {
      return "w";
    }
    if (tx >= PLAZA.x && tx < PLAZA.x + PLAZA.w && ty >= PLAZA.y && ty < PLAZA.y + PLAZA.h) {
      return "d";
    }
    for (const p of PATHS) {
      if (tx >= p.x && tx < p.x + p.w && ty >= p.y && ty < p.y + p.h) return "d";
    }
    return "g";
  }

  private cellTerrain(tx: number, ty: number): "g" | "d" | "w" | null {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return "g";
    return this.terrainAt(tx, ty);
  }

  /** Tiled terrain corner rule: equal orthogonal neighbors win, else diagonal. */
  private cornerTerrain(
    self: "g" | "d" | "w",
    a: "g" | "d" | "w",
    b: "g" | "d" | "w",
    diag: "g" | "d" | "w",
  ): "g" | "d" | "w" {
    return a === b ? a : diag;
  }

  /** Ground texture key sets per hub biome (V2 world). */
  private static readonly BIOME: Record<string, { pure: string; path: string; water: string }> = {
    grass: { pure: "lpc_g", path: "gd", water: "gw" },
    sand: { pure: "lpc_sand", path: "sd", water: "sw" },
    light: { pure: "lpc_light", path: "ld", water: "lw" },
    snow: { pure: "lpc_snow", path: "nd", water: "nw" },
  };

  private biome = WorldScene.BIOME.grass;
  private terrainTexture(tx: number, ty: number): string {
    const base = this.terrainAt(tx, ty);
    const up = this.cellTerrain(tx, ty - 1);
    const down = this.cellTerrain(tx, ty + 1);
    const left = this.cellTerrain(tx - 1, ty);
    const right = this.cellTerrain(tx + 1, ty);
    const corners: Array<"g" | "d" | "w"> = [
      this.cornerTerrain(base, up!, left!, this.cellTerrain(tx - 1, ty - 1)!),
      this.cornerTerrain(base, up!, right!, this.cellTerrain(tx + 1, ty - 1)!),
      this.cornerTerrain(base, down!, left!, this.cellTerrain(tx - 1, ty + 1)!),
      this.cornerTerrain(base, down!, right!, this.cellTerrain(tx + 1, ty + 1)!),
    ];
    const foreign = corners.find((c) => c !== base);
    if (!foreign) {
      if (base !== "d" && base !== "w") {
        // biome ground (grass / sand / light / snow) with variants
        const h = Math.abs(((tx * 73856093) ^ (ty * 19349663)) % 100);
        const variant = h < 55 ? "" : h < 80 ? "_v1" : "_v2";
        const key = `lpc_${this.biome.pure.replace("lpc_", "")}${variant}`;
        return this.textures.exists(`lpc_${key}`) ? `lpc_${key}` : this.biome.pure;
      }
      const h = Math.abs(((tx * 73856093) ^ (ty * 19349663)) % 100);
      const variant = h < 55 ? "" : h < 80 ? "_v1" : "_v2";
      const key = `lpc_${base}${variant}`;
      return this.textures.exists(key) ? key : `lpc_${base}`;
    }
    const prefix = foreign === "d" ? this.biome.path : this.biome.water;
    const bits = corners.map((c) => (c === foreign ? "1" : "0")).join("");
    const h = Math.abs(((tx * 83492791) ^ (ty * 2971215073)) % 100);
    const variant = h < 45 ? "" : h < 75 ? "_v1" : "_v2";
    const key = `lpc_${prefix}_${bits}${variant}`;
    return this.textures.exists(key) ? `lpc_${prefix}_${bits}` : this.biome.pure;
  }

  private buildGround(): void {
    const rt = this.add
      .renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE)
      .setOrigin(0, 0)
      .setDepth(-10);
    this.ground = rt;

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        rt.draw(this.terrainTexture(tx, ty), tx * TILE, ty * TILE);
      }
    }

    // bake bushes and flowers into the ground
    for (const d of DECOR) {
      rt.draw(d.key, Math.floor(d.x * TILE), Math.floor(d.y * TILE));
    }
  }

  private ground?: Phaser.GameObjects.RenderTexture;

  private buildBuildings(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const rt = this.ground!;

    for (const b of BUILDINGS) {
      const roof = ROOF_TILES[b.roof];
      const stone = b.roof === "stone";
      const wall = stone ? "t77" : "t87";
      const base = stone ? "t111" : "t85";
      const windowTile = stone ? "t96" : "t88";
      const doorTile = stone ? "t91" : "t89";

      for (let row = 0; row < b.h; row++) {
        for (let col = 0; col < b.w; col++) {
          let key: string;
          if (row === 0) {
            key = `t${roof.top}`;
          } else if (row === 1) {
            key = `t${roof.body}`;
          } else if (row === b.h - 1) {
            // bottom row: base wall with the door in the middle, corner trims
            if (col === b.doorOffsetX) key = doorTile;
            else if (col === 0 || col === b.w - 1) key = stone ? "t120" : "t44";
            else key = base;
          } else if (row === b.h - 2) {
            // wall row with windows and an arch above public doors
            if (stone && col === b.doorOffsetX) key = "t63";
            else if (col === 1 || col === b.w - 2) key = windowTile;
            else key = wall;
          } else {
            key = wall;
          }
          rt.draw(key, (b.x + col) * TILE, (b.y + row) * TILE);
        }
      }

      solids.add(
        this.add
          .rectangle(
            b.x * TILE + (b.w * TILE) / 2,
            b.y * TILE + (b.h * TILE) / 2,
            b.w * TILE,
            b.h * TILE,
          )
          .setVisible(false),
      );

      this.lastNameplate = this.addNameplate(b);
      this.addDoor(b);
    }

    // soft drop shadows behind buildings for depth (reference look)
    for (const b of BUILDINGS) {
      this.add
        .rectangle(
          b.x * TILE + (b.w * TILE) / 2 + 12,
          b.y * TILE + ((b.h - 1) * TILE) / 2 + 12,
          b.w * TILE,
          (b.h - 1) * TILE,
          0x000000,
          0.14,
        )
        .setOrigin(0.5)
        .setDepth(-9);
    }

    // animated water shimmer highlights on the pond
    for (let i = 0; i < 9; i++) {
      const hx = (POND.x + 1 + ((i * 73856093) % (POND.w - 2))) * TILE + 16;
      const hy = (POND.y + 1 + ((i * 19349663) % (POND.h - 3))) * TILE + 16;
      const shimmer = this.add
        .ellipse(hx, hy, 14, 5, 0xe8f4ff, 0.22)
        .setDepth(-8);
      this.tweens.add({
        targets: shimmer,
        alpha: { from: 0.05, to: 0.3 },
        scaleX: { from: 0.7, to: 1.15 },
        duration: 1300 + ((i * 613) % 900),
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }

    // Phaser 4 buffers RenderTexture draw commands — flush them
    rt.render();
  }

  private addNameplate(b: BuildingSpec): Phaser.GameObjects.Text {
    const info = this.roomDoorInfo(b);
    const line2 = b.roomType === "personal" ? info.activity : doorStateLabel(info.state);
    const cx = b.x * TILE + (b.w * TILE) / 2;
    return this.add
      .text(cx, b.y * TILE - 5, `${info.buildingName}\n${line2}`, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#e4e4e7",
        backgroundColor: "#18181bcc",
        padding: { x: 3, y: 2 },
        align: "center",
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
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

    const light = this.add
      .circle(pos.x, (b.y + b.h - 2) * TILE + 8, 5, DOOR_STATE_COLORS[info.state])
      .setDepth(21);
    this.tweens.add({
      targets: light,
      alpha: { from: 0.55, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

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
    door.light.setFillStyle(DOOR_STATE_COLORS[event.doorState]);
    const line2 =
      door.building.roomType === "personal"
        ? door.info.activity
        : doorStateLabel(door.info.state);
    door.nameplate.setText(`${door.info.buildingName}\n${line2}`);
  }

  private buildTrees(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const TREE_TEXTURES: Record<string, string> = {
      A: "treeLpcA",
      B: "treeLpcB",
      C: "treeLpcC",
      D: "treeLpcD",
      pale: "treeLpcPale",
      autumn: "treeLpcAutumn",
    };
    for (const t of TREES) {
      const px = t.x * TILE;
      const py = t.y * TILE;
      // soft ground shadow under the canopy, drawn before the tree
      this.add
        .ellipse(px + 32, py + 96, 80, 22, 0x000000, 0.18)
        .setDepth(-7);
      // LPC trees are 256px art rendered at 0.5 (128px ≈ 4 tiles) — lush,
      // like the reference; anchored so the trunk base sits on the tile slot
      const sprite = this.add
        .image(px + TILE, py + 3 * TILE, TREE_TEXTURES[t.variant] ?? "treeLpcA")
        .setOrigin(0.5, 1)
        .setScale(0.5)
        .setDepth(py + 3 * TILE);
      void sprite;

      // collision covers the trunk row only, so the canopy hangs overhead
      const body = this.add.rectangle(px + TILE, py + 2 * TILE + 14, 44, 14).setVisible(false);
      solids.add(body);
    }
  }

  private buildGardens(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const rt = this.ground!;
    for (const g of GARDENS) {
      for (let ty = g.y; ty < g.y + g.h; ty++) {
        for (let tx = g.x; tx < g.x + g.w; tx++) {
          if (ty === g.y || ty === g.y + g.h - 1 || tx === g.x || tx === g.x + g.w - 1) {
            rt.draw("t99", tx * TILE, ty * TILE);
          } else {
            rt.draw("t43", tx * TILE, ty * TILE);
          }
        }
      }
      // gap in the bottom fence as a little gate
      const gx = g.x + Math.floor(g.w / 2);
      rt.draw("t43", gx * TILE, (g.y + g.h - 1) * TILE);

      // block the fence line so gardens read as enclosed
      const ring = this.add
        .rectangle(
          g.x * TILE + (g.w * TILE) / 2,
          g.y * TILE + (g.h * TILE) / 2,
          g.w * TILE,
          g.h * TILE,
        )
        .setVisible(false);
      solids.add(ring);
      void gx;
    }
    rt.render();
  }

  private buildProps(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const prop of PROPS) {
      const sprite = this.add
        .sprite(prop.x * TILE, prop.y * TILE, typeof prop.tile === "number" ? `t${prop.tile}` : prop.tile)
        .setOrigin(0.5, 0.85)
        .setDepth(prop.y * TILE);
      if (prop.blocked) {
        solids.add(sprite);
        const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(24, 16);
        body.setOffset(4, 16);
      }
    }
  }

  private buildLamps(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const lamp of LAMPS) {
      const px = lamp.x * TILE;
      const py = lamp.y * TILE;
      this.add
        .sprite(px, py, "t94")
        .setOrigin(0.5, 0.85)
        .setDepth(py);

      const glow = this.add.ellipse(px, py - 16, 52, 52, 0xfbbf24, 0.18).setDepth(py - 1);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.24 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });

      const body = this.add.rectangle(px, py - 4, 16, 16).setVisible(false);
      solids.add(body);
    }

    for (const bench of BENCHES) {
      const px = bench.x * TILE;
      const py = bench.y * TILE;
      const sprite = this.add
        .image(px, py, "bench")
        .setOrigin(0.5, 0.85)
        .setScale(2)
        .setDepth(py);
      void sprite;
      const body = this.add.rectangle(px, py - 8, 44, 16).setVisible(false);
      solids.add(body);
    }
  }

  /** World portal: walk up and press E to open the world map (V2 travel). */
  private buildPortal(): void {
    const px = 36.5 * TILE;
    const py = 19.5 * TILE;
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

  private makeShadow(x: number, y: number, depth: number) {
    return this.add.ellipse(x, y, 24, 10, 0x000000, 0.25).setDepth(depth);
  }

  private addCharLabel(sprite: Phaser.GameObjects.Sprite, text: string, color: string) {
    this.add
      .text(sprite.x, sprite.y - 40, text, {
        fontFamily: "monospace",
        fontSize: "8px",
        color,
        backgroundColor: "#18181bcc",
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
        .setScale(2)
        .setDepth(py)
        .setFrame(idleFrame(npc.facing));
      this.makeShadow(px, py + 4, py - 1);
      this.addCharLabel(sprite, `${npc.name} — ${npc.status}`, "#a7f3d0");

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
          speed: 72,
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
      .setScale(2)
      .setDepth(50);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(18, 14, true);
    this.player.setFrame(idleFrame(this.currentDir));
    this.physics.add.collider(this.player, solids);

    const playerName = this.registry.get("playerName") as string | undefined;
    if (playerName) {
      this.playerLabel = this.add
        .text(px, py - 42, playerName, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#fbbf24",
          backgroundColor: "#18181bcc",
          padding: { x: 2, y: 1 },
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(51);
    }

    // keep the shadow and label glued to the player's feet/head
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.player?.active) {
        this.playerShadow.setPosition(this.player.x, this.player.y + 4);
        this.playerLabel?.setPosition(this.player.x, this.player.y - 42);
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
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
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
