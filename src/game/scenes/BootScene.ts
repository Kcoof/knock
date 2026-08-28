import Phaser from "phaser";
import { CHARACTERS } from "../constants";
import { BUILDINGS } from "../worldData";
import { registerWarmDusk } from "../warmDusk";

/** Kenney Tiny Dungeon tiles scaled to 2x, used for room interiors. */
const INTERIOR_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 61, 63, 108, 111, 114, 120];

/**
 * Loads interior tiles, generates the Warm Dusk world art (procedural,
 * ported from Qwen's reference), registers character animations, then
 * hands off to the world.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.setBaseURL("/sprites");
    for (const index of INTERIOR_TILES) {
      this.load.image(`i${index}`, `dungeon2x/tile_${String(index).padStart(4, "0")}.png`);
    }
  }

  create(): void {
    registerWarmDusk(this, BUILDINGS);
    this.createAnimations();
    this.scene.start("world");
  }

  private createAnimations(): void {
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
  }
}
