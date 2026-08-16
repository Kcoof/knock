export const TILE = 16;

/** Camera zoom: 16px tiles rendered at 48px. */
export const ZOOM = 3;

export const MAP_W = 40;
export const MAP_H = 34;

export const PLAYER_SPEED = 120; // world px per second

/** How close (world px) the player must be to a door to interact. */
export const DOOR_INTERACT_DISTANCE = 26;

export const DOOR_STATE_COLORS: Record<string, number> = {
  open: 0x22c55e,
  knock: 0xeab308,
  focus: 0xef4444,
};

export const DOOR_STATE_LABELS: Record<string, string> = {
  open: "Open — come on in",
  knock: "Knock first",
  focus: "Focus — do not disturb",
};

export const KNOCK_REASONS = [
  "Quick question",
  "Need help",
  "Want to collaborate",
  "Just visiting",
] as const;

/**
 * Verified tile indices from the Kenney packs (see public/sprites/CREDITS.md).
 * Town tiles load with key `t<index>`, dungeon tiles with key `d<index>`.
 */
export const TOWN_TILES = [
  0, 1, 2, // grass
  12, 13, 14, 24, 25, // sand paths
  36, 37, 39, 40, // path variants
  43, // flowers
  19, // bush
  48, 49, 50, 51, // water
  52, 53, 54, 55, // red roof
  64, 65, 66, 67, // red roof (second tone)
  72, 73, 74, 75, // orange roof
  84, 85, 86, 87, // walls
  88, // window wall
  89, 90, 91, // doors
  93, // coin
  96, 97, 100, // stone
  107, // chest
  108, 109, 110, // light stone
  4, 5, 6, 7, 8, 9, 16, 17, 18, 20, 28, 30, 31, 32, // vegetation (candidates)
] as const;

export const DUNGEON_TILES = [
  61, 63, 84, 86, 87, 97, 111, 120,
] as const;

export const PLAYER_TILE = 86;
