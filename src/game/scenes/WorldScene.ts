import Phaser from "phaser";
import {
  DOOR_INTERACT_DISTANCE,
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
  groundTileAt,
  pathTileAt,
} from "../worldData";
import type { BuildingSpec, CharacterKey } from "../types";

interface DoorRuntime {
  info: (typeof DOORS)[string];
  building: BuildingSpec;
  x: number;
  y: number;
}

const ROOF_TILES: Record<BuildingSpec["roof"], { top: number; body: number }> = {
  red: { top: 52, body: 53 },
  red2: { top: 64, body: 65 },
  orange: { top: 72, body: 73 },
  stone: { top: 108, body: 109 },
};

const CHAR_DIRS = ["down", "left", "right", "up"] as const;

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
      onGame("knock:send", (payload) => this.onKnockSent(payload.doorId)),
      onGame("dialog:open", () => {
        // opened from the React HUD (click/tap path) — freeze movement
        this.dialogOpen = true;
      }),
      onGame("dialog:closed", () => {
        this.dialogOpen = false;
      }),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      this.unsubscribers = [];
      window.removeEventListener("keydown", this.onKeyDown);
      window.removeEventListener("keyup", this.onKeyUp);
      this.pressed.clear();
      emitGame("door:near", null);
    });
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
    }

    this.updateWanderers(time, delta);
  }

  // --- world construction -------------------------------------------------

  private buildGround(): void {
    const rt = this.add
      .renderTexture(0, 0, MAP_W * TILE, MAP_H * TILE)
      .setOrigin(0, 0)
      .setDepth(-10);
    this.ground = rt;

    for (let ty = 0; ty < MAP_H; ty++) {
      for (let tx = 0; tx < MAP_W; tx++) {
        rt.draw(`t${groundTileAt(tx, ty)}`, tx * TILE, ty * TILE);
      }
    }

    // sand paths with subtle texture variation
    for (const p of PATHS) {
      for (let ty = p.y; ty < p.y + p.h; ty++) {
        for (let tx = p.x; tx < p.x + p.w; tx++) {
          rt.draw(`t${pathTileAt(tx, ty)}`, tx * TILE, ty * TILE);
        }
      }
    }

    // central brick plaza
    for (let ty = Math.floor(PLAZA.y); ty < PLAZA.y + PLAZA.h; ty++) {
      for (let tx = PLAZA.x; tx < PLAZA.x + PLAZA.w; tx++) {
        const border =
          ty === Math.floor(PLAZA.y) ||
          ty === PLAZA.y + PLAZA.h - 1 ||
          tx === PLAZA.x ||
          tx === PLAZA.x + PLAZA.w - 1;
        rt.draw(border ? "t121" : "t126", tx * TILE, ty * TILE);
      }
    }

    // pond: grass-edge top row, wave accents, darker rim
    for (let ty = POND.y; ty < POND.y + POND.h; ty++) {
      for (let tx = POND.x; tx < POND.x + POND.w; tx++) {
        let key = "t50";
        if (ty === POND.y) key = "t48";
        else if ((tx + ty) % 5 === 0) key = "t51";
        else if (ty === POND.y + POND.h - 1 || tx === POND.x || tx === POND.x + POND.w - 1) key = "t49";
        rt.draw(key, tx * TILE, ty * TILE);
      }
    }

    // bake bushes and flowers into the ground
    for (const d of DECOR) {
      rt.draw(`t${d.tile}`, Math.floor(d.x * TILE), Math.floor(d.y * TILE));
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

      this.addNameplate(b);
      this.addDoor(b);
    }

    // Phaser 4 buffers RenderTexture draw commands — flush them
    rt.render();
  }

  private addNameplate(b: BuildingSpec): void {
    const info = DOORS[b.id];
    const line2 = b.roomType === "personal" ? info.activity : doorStateLabel(info.state);
    const cx = b.x * TILE + (b.w * TILE) / 2;
    this.add
      .text(cx, b.y * TILE - 3, `${b.name}\n${line2}`, {
        fontFamily: "monospace",
        fontSize: "7px",
        color: "#e4e4e7",
        backgroundColor: "#18181bcc",
        padding: { x: 3, y: 2 },
        align: "center",
        resolution: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  private addDoor(b: BuildingSpec): void {
    const info = DOORS[b.id];
    const pos = doorWorldPos(b);

    const light = this.add
      .circle(pos.x, (b.y + b.h - 2) * TILE + 4, 3, DOOR_STATE_COLORS[info.state])
      .setDepth(21);
    this.tweens.add({
      targets: light,
      alpha: { from: 0.55, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    this.doors.push({ info, building: b, x: pos.x, y: pos.y });
  }

  private buildTrees(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const t of TREES) {
      const px = t.x * TILE;
      const py = t.y * TILE;
      const sprite = this.add
        .image(px, py, t.variant === "A" ? "treeA" : "treeB")
        .setOrigin(0, 0)
        .setDepth(py + 40); // trunk base sorts against the player
      void sprite;

      // collision covers the trunk row only, so the canopy hangs overhead
      const body = this.add.rectangle(px + TILE, py + 2 * TILE + 6, 24, 8).setVisible(false);
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
        .sprite(prop.x * TILE, prop.y * TILE, `t${prop.tile}`)
        .setOrigin(0.5, 0.85)
        .setDepth(prop.y * TILE);
      if (prop.blocked) {
        solids.add(sprite);
        const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(12, 8);
        body.setOffset(2, 8);
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

      const glow = this.add.ellipse(px, py - 8, 26, 26, 0xfbbf24, 0.18).setDepth(py - 1);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.24 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });

      const body = this.add.rectangle(px, py - 2, 8, 8).setVisible(false);
      solids.add(body);
    }

    for (const bench of BENCHES) {
      const px = bench.x * TILE;
      const py = bench.y * TILE;
      const sprite = this.add
        .image(px, py, "bench")
        .setOrigin(0.5, 0.85)
        .setDepth(py);
      void sprite;
      const body = this.add.rectangle(px, py - 4, 22, 8).setVisible(false);
      solids.add(body);
    }
  }

  private makeShadow(x: number, y: number, depth: number) {
    return this.add.ellipse(x, y, 12, 5, 0x000000, 0.25).setDepth(depth);
  }

  private addCharLabel(sprite: Phaser.GameObjects.Sprite, text: string, color: string) {
    this.add
      .text(sprite.x, sprite.y - 20, text, {
        fontFamily: "monospace",
        fontSize: "6px",
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
        .setDepth(py)
        .setFrame(idleFrame(npc.facing));
      this.makeShadow(px, py + 2, py - 1);
      this.addCharLabel(sprite, `${npc.name} — ${npc.status}`, "#a7f3d0");

      // gentle idle sway so standing characters still feel alive
      this.tweens.add({
        targets: sprite,
        y: py - 1,
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
          speed: 42,
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
    const px = SPAWN.x * TILE;
    const py = SPAWN.y * TILE;
    this.playerShadow = this.makeShadow(px, py + 2, 48);
    this.player = this.physics.add
      .sprite(px, py, `char-${PLAYER_CHAR as CharacterKey}`)
      .setOrigin(0.5, 0.9)
      .setDepth(50);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(10, 8, true);
    this.player.setFrame(idleFrame(this.currentDir));
    this.physics.add.collider(this.player, solids);

    // keep the shadow glued to the player's feet
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      if (this.player?.active) {
        this.playerShadow.setPosition(this.player.x, this.player.y + 2);
      }
    });
  }

  // --- interaction --------------------------------------------------------

  private tryOpenKnockDialog(): void {
    if (this.dialogOpen || !this.nearDoor) return;
    this.dialogOpen = true;
    emitGame("knock:open", this.nearDoor.info);
  }

  private updateNearDoor(): void {
    let best: DoorRuntime | null = null;
    let bestDist = DOOR_INTERACT_DISTANCE;
    for (const door of this.doors) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        door.x,
        door.y + 10,
      );
      if (d < bestDist) {
        best = door;
        bestDist = d;
      }
    }
    if (best?.info.id !== this.nearDoor?.info.id) {
      this.nearDoor = best;
      emitGame("door:near", best?.info ?? null);
    }
  }

  private onKnockSent(doorId: string): void {
    const door = this.doors.find((d) => d.info.id === doorId);
    if (!door) return;

    const bubble = this.add
      .text(door.x, door.building.y * TILE - 18, "!", {
        fontFamily: "monospace",
        fontSize: "10px",
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

    emitGame(
      "toast",
      `Knock sent to ${door.info.owner} — realtime delivery arrives in Phase 3.`,
    );
  }
}
