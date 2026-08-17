import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import type { PlayerIdentity } from "./net/RealtimeService";

export interface CreateGameOptions {
  playerName?: string;
  netIdentity?: PlayerIdentity;
}

/** Creates the Phaser game bound to a parent element. Client-side only. */
export function createGame(parent: HTMLElement, options: CreateGameOptions = {}): Phaser.Game {
  const game = new Phaser.Game({
    // Canvas 2D renderer: a prototype-sized world blits fine, and the 2D
    // canvas stays readable for screenshots, tests, and screen sharing.
    type: Phaser.CANVAS,
    parent,
    backgroundColor: "#0b0f0a",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: "100%",
      height: "100%",
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, WorldScene],
  });
  if (options.playerName) {
    game.registry.set("playerName", options.playerName);
  }
  if (options.netIdentity) {
    game.registry.set("netIdentity", options.netIdentity);
  }
  return game;
}
