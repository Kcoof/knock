import Phaser from "phaser";

/**
 * Camera fades/flashes drawn as plain world-covering rectangle tweens.
 * Phaser 4's built-in camera effects never complete on the Canvas renderer
 * (the camera stays permanently veiled), so every transition uses tweens,
 * which behave identically on every renderer. The cover is sized from the
 * physics bounds, which both scenes set to the full map before any fade.
 */
function cover(scene: Phaser.Scene, color: number, alpha: number): Phaser.GameObjects.Rectangle {
  const bounds = scene.physics.world.bounds;
  const width = Math.max(bounds.width, scene.scale.width);
  const height = Math.max(bounds.height, scene.scale.height);
  return scene.add
    .rectangle(bounds.centerX, bounds.centerY, width, height, color, alpha)
    .setDepth(9000);
}

/** Fade in from black over `duration` ms. */
export function camFadeIn(scene: Phaser.Scene, duration = 300): void {
  const veil = cover(scene, 0x000000, 1);
  scene.tweens.add({
    targets: veil,
    alpha: 0,
    duration,
    onComplete: () => veil.destroy(),
  });
}

/** Fade out to black, then run `onDone` (scene switches, cleanup, …). */
export function camFadeOut(scene: Phaser.Scene, onDone: () => void, duration = 250): void {
  const veil = cover(scene, 0x000000, 0);
  scene.tweens.add({
    targets: veil,
    alpha: 1,
    duration,
    onComplete: () => {
      veil.destroy();
      onDone();
    },
  });
}

/** Short green-tinted flash, e.g. after a friend teleport. */
export function camFlash(scene: Phaser.Scene, duration = 200): void {
  const veil = cover(scene, 0x143c28, 0.35);
  scene.tweens.add({
    targets: veil,
    alpha: 0,
    duration,
    onComplete: () => veil.destroy(),
  });
}
