import Phaser from "phaser";
import {
  DOOR_INTERACT_DISTANCE,
  DOOR_STATE_COLORS,
  MAP_H,
  MAP_W,
  PLAYER_SPEED,
  PLAYER_TILE,
  TILE,
  ZOOM,
} from "../constants";
import { emitGame, onGame } from "../EventBus";
import {
  BLOCKED_PROPS,
  BUILDINGS,
  DECOR_PROPS,
  DOORS,
  NPCS,
  PATHS,
  POND,
  SPAWN,
  doorStateLabel,
  doorWorldPos,
  grassTileAt,
} from "../worldData";
import type { BuildingSpec } from "../types";

interface DoorRuntime {
  info: (typeof DOORS)[string];
  building: BuildingSpec;
  x: number;
  y: number;
}

const ROOF_TILES: Record<BuildingSpec["roof"], { top: number; body: number; wall: number }> = {
  red: { top: 52, body: 53, wall: 87 },
  red2: { top: 64, body: 65, wall: 87 },
  orange: { top: 72, body: 73, wall: 87 },
  stone: { top: 108, body: 109, wall: 100 },
};

/**
 * The playable pixel world. Phase 1 is entirely local: mock residents, mock
 * door states, no backend. The scene talks to the React HUD through EventBus.
 */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private pressed = new Set<string>();
  private doors: DoorRuntime[] = [];
  private nearDoor: DoorRuntime | null = null;
  private dialogOpen = false;
  private bobTimer = 0;
  private bobUp = false;
  private unsubscribers: Array<() => void> = [];

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

    const solids = this.physics.add.staticGroup();

    this.buildGround();
    this.buildBuildings(solids);
    this.buildProps(solids);
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

  update(_time: number, delta: number): void {
    if (!this.player?.active || this.dialogOpen) return;

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
      if (vx !== 0) this.player.setFlipX(vx < 0);

      // tiny vertical bob while walking — reads as a step without walk frames
      this.bobTimer += delta;
      if (this.bobTimer > 130) {
        this.bobTimer = 0;
        this.bobUp = !this.bobUp;
        this.player.setY(this.player.y + (this.bobUp ? -1 : 1));
      }
    } else {
      this.player.setVelocity(0, 0);
    }

    this.updateNearDoor();
  }

  private tryOpenKnockDialog(): void {
    if (this.dialogOpen || !this.nearDoor) return;
    this.dialogOpen = true;
    emitGame("knock:open", this.nearDoor.info);
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
        rt.draw(`t${grassTileAt(tx, ty)}`, tx * TILE, ty * TILE);
      }
    }

    for (const p of PATHS) {
      for (let ty = p.y; ty < p.y + p.h; ty++) {
        for (let tx = p.x; tx < p.x + p.w; tx++) {
          rt.draw("t13", tx * TILE, ty * TILE);
        }
      }
    }

    for (let ty = POND.y; ty < POND.y + POND.h; ty++) {
      for (let tx = POND.x; tx < POND.x + POND.w; tx++) {
        const edge = ty === POND.y ? "t49" : (tx + ty) % 5 === 0 ? "t51" : "t50";
        rt.draw(edge, tx * TILE, ty * TILE);
      }
    }
  }

  private ground?: Phaser.GameObjects.RenderTexture;

  private buildBuildings(solids: Phaser.Physics.Arcade.StaticGroup): void {
    const rt = this.ground!;

    for (const b of BUILDINGS) {
      const roof = ROOF_TILES[b.roof];

      for (let row = 0; row < b.h; row++) {
        for (let col = 0; col < b.w; col++) {
          let key: string;
          if (row === 0) {
            key = `t${roof.top}`;
          } else if (row === b.h - 1 && col === b.doorOffsetX) {
            key = b.roomType === "personal" ? "t89" : "t91";
          } else if (row === b.h - 2 && (col === 1 || col === b.w - 2)) {
            key = "t88";
          } else if (row >= 2) {
            key = `t${roof.wall}`;
          } else {
            key = `t${roof.body}`;
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
      .circle(pos.x, (b.y + b.h - 2) * TILE + 4, 2.4, DOOR_STATE_COLORS[info.state])
      .setDepth(21);
    this.tweens.add({
      targets: light,
      alpha: { from: 0.45, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });

    this.doors.push({ info, building: b, x: pos.x, y: pos.y });
  }

  private buildProps(solids: Phaser.Physics.Arcade.StaticGroup): void {
    for (const prop of BLOCKED_PROPS) {
      const sprite = this.add
        .sprite(prop.x * TILE, prop.y * TILE, `t${prop.tile}`)
        .setOrigin(0.5, 0.85)
        .setDepth(prop.y * TILE);
      solids.add(sprite);
      const body = sprite.body as Phaser.Physics.Arcade.StaticBody;
      body.setSize(12, 8);
      body.setOffset(2, 8);
    }

    for (const prop of DECOR_PROPS) {
      const sprite = this.add
        .sprite(prop.x * TILE, prop.y * TILE, `t${prop.tile}`)
        .setOrigin(0.5, 1)
        .setDepth(1);
      if (prop.tile === 93) {
        this.tweens.add({
          targets: sprite,
          alpha: { from: 1, to: 0.55 },
          duration: 700,
          yoyo: true,
          repeat: -1,
        });
      }
    }
  }

  private buildNpcs(): void {
    for (const npc of NPCS) {
      const sprite = this.add
        .sprite(npc.x * TILE, npc.y * TILE, `d${npc.tile}`)
        .setOrigin(0.5, 0.85)
        .setDepth(npc.y * TILE)
        .setFlipX(npc.facingLeft);

      this.add
        .text(sprite.x, sprite.y - 20, `${npc.name} — ${npc.status}`, {
          fontFamily: "monospace",
          fontSize: "6px",
          color: "#a7f3d0",
          backgroundColor: "#18181bcc",
          padding: { x: 2, y: 1 },
          resolution: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(sprite.depth + 1);

      this.tweens.add({
        targets: sprite,
        y: sprite.y - 1,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.InOut",
      });
    }
  }

  private buildPlayer(solids: Phaser.Physics.Arcade.StaticGroup): void {
    this.player = this.physics.add
      .sprite(SPAWN.x * TILE, SPAWN.y * TILE, `d${PLAYER_TILE}`)
      .setOrigin(0.5, 0.85)
      .setDepth(50);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(10, 8, true);
    this.physics.add.collider(this.player, solids);
  }

  // --- interaction --------------------------------------------------------

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
