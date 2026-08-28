import Phaser from "phaser";
import { TILE, ZOOM, PLAYER_CHAR, PLAYER_SPEED } from "../constants";
import { emitGame, onGame } from "../EventBus";
import { RealtimeService } from "../net/RealtimeService";
import type { PlayerIdentity, PositionEvent } from "../net/RealtimeService";
import { camFadeIn, camFadeOut } from "../cameraFx";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { CharacterKey } from "../types";

/** Layout: interior grid in 32px tiles (tiles themselves are 64px sprites). */
const ROOM_W = 13;
const ROOM_H = 10;

const CHAR_DIRS = ["down", "left", "right", "up"] as const;

function idleFrame(facing: number): number {
  return facing * 2;
}

interface RemotePlayer {
  key: string;
  username: string;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  targetX: number;
  targetY: number;
  dir: number;
  moving: boolean;
}

export interface RoomSceneData {
  roomId: string;
  ownerName: string;
  exit: { x: number; y: number }; // world position to return to
  identity?: PlayerIdentity;
}

/**
 * A personal room interior. Small, cozy, chat-enabled — the place the knock
 * was always leading to (spec §8, §12).
 */
export class RoomScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShadow!: Phaser.GameObjects.Ellipse;
  private pressed = new Set<string>();
  private touchVec = { x: 0, y: 0 };
  private currentDir = 0;
  private net?: RealtimeService;
  private remotes = new Map<string, RemotePlayer>();
  private unsubscribers: Array<() => void> = [];
  private exitZone!: Phaser.GameObjects.Zone;
  private data_!: RoomSceneData;
  private chatInputOpen = false;

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.chatInputOpen) return;
    const key = event.key.toLowerCase();
    this.pressed.add(key);
    if (key === "e" || key === " ") {
      if (key === " ") event.preventDefault();
      this.tryExit();
    }
    if (key.startsWith("arrow")) event.preventDefault();
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.pressed.delete(event.key.toLowerCase());
  };

  constructor() {
    super("room");
  }

  create(): void {
    this.data_ = this.registry.get("roomSceneData") as RoomSceneData;
    const rt = this.add
      .renderTexture(0, 0, ROOM_W * TILE, ROOM_H * TILE)
      .setOrigin(0, 0)
      .setDepth(-10);

    this.buildInterior(rt);
    rt.render();

    const solids = this.physics.add.staticGroup();
    // wall ring collision (leave the bottom door cell open)
    solids.add(this.add.rectangle((ROOM_W * TILE) / 2, TILE / 2, ROOM_W * TILE, TILE).setVisible(false));
    solids.add(this.add.rectangle(TILE / 2, (ROOM_H * TILE) / 2, TILE, ROOM_H * TILE).setVisible(false));
    solids.add(this.add.rectangle(ROOM_W * TILE - TILE / 2, (ROOM_H * TILE) / 2, TILE, ROOM_H * TILE).setVisible(false));
    solids.add(this.add.rectangle(TILE, ROOM_H * TILE - TILE / 2, TILE * 2, TILE).setVisible(false));
    solids.add(this.add.rectangle(ROOM_W * TILE - TILE, ROOM_H * TILE - TILE / 2, TILE * 2, TILE).setVisible(false));

    const px = (ROOM_W * TILE) / 2;
    const py = (ROOM_H - 2.2) * TILE;
    this.playerShadow = this.add.ellipse(px, py + 4, 30, 10, 0x000000, 0.25).setDepth(48);
    this.player = this.physics.add
      .sprite(px, py, `char-${PLAYER_CHAR as CharacterKey}`)
      .setOrigin(0.5, 0.9)
      .setScale(1.5)
      .setDepth(49);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(16, 12, true);
    this.physics.add.collider(this.player, solids);
    this.physics.world.setBounds(0, 0, ROOM_W * TILE, ROOM_H * TILE);

    this.cameras.main.setZoom(ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setBounds(0, 0, ROOM_W * TILE, ROOM_H * TILE);
    camFadeIn(this, 300);

    this.exitZone = this.add
      .zone((ROOM_W * TILE) / 2, (ROOM_H - 0.5) * TILE, TILE * 2, TILE)
      .setOrigin(0.5);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);

    this.unsubscribers.push(
      onGame("touch:move", (vec) => {
        this.touchVec = vec;
      }),
      onGame("touch:interact", () => this.tryExit()),
      onGame("chat:send", (content: string) => {
        this.net?.sendChat(content);
      }),
      onGame("chat:focus", (focused: boolean) => {
        this.chatInputOpen = focused;
        if (focused) this.pressed.clear();
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      this.net?.destroy();
      this.net = undefined;
    });

    this.connectRoom();
    const rooms = (this.registry.get("worldRooms") ?? []) as Array<{ roomId: string; githubUsername: string | null; githubRepo: string | null }>;
    const roomInfo = rooms.find((r) => r.roomId === this.data_.roomId);
    emitGame("room:entered", {
      ownerName: this.data_.ownerName,
      roomId: this.data_.roomId,
      githubUsername: roomInfo?.githubUsername ?? null,
      githubRepo: roomInfo?.githubRepo ?? null,
    });
  }

  /** Floor tile sets per interior theme (V1.5 customization). */
  private static readonly THEMES: Record<string, [string, string, string]> = {
    warm: ["i0", "i1", "i2"],
    cool: ["i9", "i10", "i11"],
    mossy: ["i108", "i114", "i1"],
  };
  private buildInterior(rt: Phaser.GameObjects.RenderTexture): void {
    const theme = RoomScene.THEMES[(this.registry.get("roomTheme") as string) ?? "warm"] ?? RoomScene.THEMES.warm;

    // floor with subtle variation
    for (let ty = 1; ty < ROOM_H - 1; ty++) {
      for (let tx = 1; tx < ROOM_W - 1; tx++) {
        const variant = Math.abs(((tx * 73856093) ^ (ty * 19349663)) % 100);
        rt.draw(variant < 70 ? theme[0] : variant < 90 ? theme[1] : theme[2], tx * TILE, ty * TILE);
      }
    }
    // rug in the middle
    rt.draw("i13", 5 * TILE, 4 * TILE);
    rt.draw("i14", 6 * TILE, 4 * TILE);
    rt.draw("i12", 5 * TILE, 5 * TILE);
    rt.draw("i13", 6 * TILE, 5 * TILE);

    // walls: top row, sides, bottom with a door gap in the middle
    for (let tx = 0; tx < ROOM_W; tx++) {
      rt.draw(tx === 0 ? "i4" : tx === ROOM_W - 1 ? "i5" : "i3", tx * TILE, 0);
    }
    for (let ty = 1; ty < ROOM_H - 1; ty++) {
      rt.draw("i6", 0, ty * TILE);
      rt.draw("i7", (ROOM_W - 1) * TILE, ty * TILE);
      if (ty === 2) rt.draw("i15", 0, ty * TILE); // window on the left wall
    }
    const doorX = Math.floor(ROOM_W / 2);
    for (let tx = 0; tx < ROOM_W; tx++) {
      if (tx === doorX || tx === doorX - 1) continue;
      rt.draw("i8", tx * TILE, (ROOM_H - 1) * TILE);
    }
    rt.draw("i24", (doorX - 1) * TILE, (ROOM_H - 1) * TILE);
    rt.draw("i25", doorX * TILE, (ROOM_H - 1) * TILE);

    // furniture: a desk to work at, a chest, a cauldron corner
    rt.draw("i111", 2 * TILE, 2 * TILE);
    rt.draw("i63", (ROOM_W - 3) * TILE, 2 * TILE);
    rt.draw("i120", (ROOM_W - 3) * TILE, (ROOM_H - 3) * TILE);
    rt.draw("i61", 2 * TILE, (ROOM_H - 3) * TILE);
  }

  private connectRoom(): void {
    const identity = this.data_.identity;
    if (!identity || !isSupabaseConfigured) return;
    try {
      const supabase = createSupabaseClient();
      this.net = new RealtimeService(supabase, identity, `room:${this.data_.roomId}`, {
        onPlayers: (players) => this.syncRemotes(players),
        onPosition: (event) => this.onRemotePosition(event),
        onChat: (event) =>
          emitGame("chat:message", {
            username: event.username,
            content: event.content,
            at: event.at,
          }),
      });
      void this.net.connect();
    } catch {
      // best-effort networking
    }
  }

  private syncRemotes(players: Array<{ key: string; username: string }>): void {
    const seen = new Set(players.map((p) => p.key));
    for (const p of players) {
      if (this.remotes.has(p.key)) continue;
      const x = (ROOM_W * TILE) / 2 + this.remotes.size * 24;
      const y = (ROOM_H - 2.4) * TILE;
      const sprite = this.add
        .sprite(x, y, "char-mage")
        .setOrigin(0.5, 0.9)
        .setScale(1.5)
        .setDepth(48)
        .setFrame(idleFrame(0))
        .setAlpha(0);
      const shadow = this.add.ellipse(x, y + 4, 30, 10, 0x000000, 0.25).setDepth(47).setAlpha(0);
      const label = this.add
        .text(x, y - 40, p.username, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: "#93c5fd",
          backgroundColor: "#18181bcc",
          padding: { x: 2, y: 1 },
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(49)
        .setAlpha(0);
      this.tweens.add({ targets: [sprite, label, shadow], alpha: 1, duration: 300 });
      this.remotes.set(p.key, {
        key: p.key,
        username: p.username,
        sprite,
        shadow,
        label,
        targetX: x,
        targetY: y,
        dir: 0,
        moving: false,
      });
    }
    for (const [key, remote] of this.remotes) {
      if (!seen.has(key)) {
        this.tweens.add({
          targets: [remote.sprite, remote.label, remote.shadow],
          alpha: 0,
          duration: 400,
          onComplete: () => {
            remote.sprite.destroy();
            remote.label.destroy();
            remote.shadow.destroy();
          },
        });
        this.remotes.delete(key);
      }
    }
  }

  private onRemotePosition(event: PositionEvent): void {
    const remote = this.remotes.get(event.key);
    if (!remote) return;
    remote.targetX = event.x;
    remote.targetY = event.y;
    remote.dir = event.dir;
    remote.moving = event.moving;
  }

  private tryExit(): void {
    // Overlap the physics body with the zone: a feet-point test lets a
    // player pressed against the south wall slide past the zone entirely.
    const zone = this.exitZone.getBounds();
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const playerBox = new Phaser.Geom.Rectangle(body.x, body.y, body.width, body.height);
    if (!Phaser.Geom.Rectangle.Overlaps(zone, playerBox)) return;
    camFadeOut(this, () => {
      this.registry.set("returnPos", this.data_.exit);
      emitGame("room:exited", this.data_.exit);
      this.scene.start("world");
    });
  }

  update(time: number, delta: number): void {
    if (!this.player?.active) return;

    if (!this.chatInputOpen) {
      let vx = this.touchVec.x;
      let vy = this.touchVec.y;
      if (this.pressed.has("a") || this.pressed.has("arrowleft")) vx -= 1;
      if (this.pressed.has("d") || this.pressed.has("arrowright")) vx += 1;
      if (this.pressed.has("w") || this.pressed.has("arrowup")) vy -= 1;
      if (this.pressed.has("s") || this.pressed.has("arrowdown")) vy += 1;

      const moving = vx !== 0 || vy !== 0;
      if (moving) {
        const len = Math.hypot(vx, vy);
        this.player.setVelocity((vx / len) * PLAYER_SPEED, (vy / len) * PLAYER_SPEED);
        const dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 1 : 2) : vy < 0 ? 3 : 0;
        if (dir !== this.currentDir || !this.player.anims.isPlaying) {
          this.currentDir = dir;
          this.player.anims.play(`char-${PLAYER_CHAR}-${CHAR_DIRS[dir]}`, true);
        }
      } else {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
        this.player.setFrame(idleFrame(this.currentDir));
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    // interpolate remotes + follow labels
    const lerp = Math.min(1, (delta / 1000) * 8);
    for (const remote of this.remotes.values()) {
      remote.sprite.x += (remote.targetX - remote.sprite.x) * lerp;
      remote.sprite.y += (remote.targetY - remote.sprite.y) * lerp;
      const animKey = `char-mage-${CHAR_DIRS[remote.dir]}`;
      if (remote.moving && remote.sprite.anims.currentAnim?.key !== animKey) {
        remote.sprite.anims.play(animKey);
      } else if (!remote.moving && remote.sprite.anims.isPlaying) {
        remote.sprite.anims.stop();
        remote.sprite.setFrame(idleFrame(remote.dir));
      }
      remote.shadow.setPosition(remote.sprite.x, remote.sprite.y + 4);
      remote.label.setPosition(remote.sprite.x, remote.sprite.y - 40);
    }

    this.playerShadow.setPosition(this.player.x, this.player.y + 4);

    if (this.net) {
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
}
