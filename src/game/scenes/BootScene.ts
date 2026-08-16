import Phaser from "phaser";
import { DUNGEON_TILES, TOWN_TILES } from "../constants";

/** Loads the tile PNGs then hands off to the world. */
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
  }

  create(): void {
    this.scene.start("world");
  }
}
