import Phaser from "phaser";
import { CHARACTERS, TOWN_TILES } from "../constants";

/** Kenney Tiny Dungeon tiles scaled to 2x, used for room interiors. */
const INTERIOR_TILES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 61, 63, 108, 111, 114, 120];

/**
 * Loads art, registers character animations, then hands off to the world.
 * LPC transition tiles are loaded from a generated manifest in two phases.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    this.load.setBaseURL("/sprites");
    this.load.json("lpcManifest", "lpc/manifest.json");
    for (const index of TOWN_TILES) {
      this.load.image(`t${index}`, `town2x/tile_${String(index).padStart(4, "0")}.png`);
    }
    for (const index of INTERIOR_TILES) {
      this.load.image(`i${index}`, `dungeon2x/tile_${String(index).padStart(4, "0")}.png`);
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
    this.load.image("treeLpcA", "props/treeLpcA.png");
    this.load.image("treeLpcB", "props/treeLpcB.png");
    this.load.image("treeLpcC", "props/treeLpcC.png");
    this.load.image("treeLpcD", "props/treeLpcD.png");
    this.load.image("treeLpcPale", "props/treeLpcPale.png");
    this.load.image("treeLpcAutumn", "props/treeLpcAutumn.png");
    this.load.image("bushA", "props/bushA.png");
    this.load.image("bushC", "props/bushC.png");
    this.load.image("flowersA", "props/flowersA.png");
    this.load.image("flowersB", "props/flowersB.png");
    this.load.image("plantA", "props/plantA.png");
    this.load.image("plantB", "props/plantB.png");
    this.load.image("bench", "props/bench.png");
  }

  create(): void {
    const manifest = (this.cache.json.get("lpcManifest") ?? []) as string[];
    const startWorld = () => {
      this.createAnimations();
      this.scene.start("world");
    };

    if (manifest.length > 0) {
      for (const key of manifest) {
        this.load.image(`lpc_${key}`, `lpc/${key}.png`);
      }
      this.load.once(Phaser.Loader.Events.COMPLETE, startWorld);
      this.load.start();
    } else {
      startWorld();
    }
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
