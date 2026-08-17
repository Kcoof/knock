import Phaser from "phaser";
import { CHARACTERS, DUNGEON_TILES, TOWN_TILES } from "../constants";

/** Loads art, registers character animations, then hands off to the world. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.setBaseURL("/sprites");
    for (const index of TOWN_TILES) {
      this.load.image(`t${index}`, `town/tile_${String(index).padStart(4, "0")}.png`);
    }
    for (const index of DUNGEON_TILES) {
      this.load.image(`d${index}`, `dungeon/tile_${String(index).padStart(4, "0")}.png`);
    }
    for (const char of CHARACTERS) {
      // 2 columns (walk frames) x 4 rows (down/left/right/up)
      this.load.spritesheet(`char-${char}`, `chars/${char}.png`, {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    this.load.image("treeA", "props/treeA.png");
    this.load.image("treeB", "props/treeB.png");
    this.load.image("bench", "props/bench.png");
  }

  create(): void {
    for (const char of CHARACTERS) {
      const frames: Record<string, number[]> = {
        down: [0, 1],
        left: [2, 3],
        right: [4, 5],
        up: [6, 7],
      };
      for (const [dir, f] of Object.entries(frames)) {
        const key = `char-${char}-${dir}`;
        if (!this.anims.exists(key)) {
          this.anims.create({
            key,
            frames: f.map((n) => ({ key: `char-${char}`, frame: n })),
            frameRate: 6,
            repeat: -1,
          });
        }
      }
    }
    this.scene.start("world");
  }
}
