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

/** Character spritesheets: 2 columns (walk frames) x 4 rows (down/left/right/up). */
export const CHARACTERS = ["builder", "noble", "mage", "traveler"] as const;

export const PLAYER_CHAR = "builder" as const;

/**
 * Verified tile indices from the Kenney packs (see public/sprites/CREDITS.md).
 * Town tiles load with key `t<index>`, dungeon tiles with key `d<index>`.
 */
export const TOWN_TILES = [
  // ground
  0, 1, 2, // grass
  12, 13, 14, 24, 25, 36, 37, 39, 40, // sand paths + variants
  15, // grass/dirt corner
  43, // flowers
  19, // bush
  126, // brick path
  // water
  48, 49, 50, 51,
  // roofs
  52, 53, 54, 55, // red
  64, 65, 66, 67, // red (second tone)
  72, 73, 74, 75, // orange
  // walls
  84, 85, 86, 87,
  44, 45, 46, 47, // wall corners
  56, 57, 58, 59, // wall tops
  60, 61, 62, 63, // stone walls + arch
  76, 77, 78, 79, // light stone + arches
  111, 112, 113, 114, // dark stone
  120, 121, 122, 123, 124, 125, // stone trims
  108, // light block
  // windows & doors
  88, 96, 98,
  89, 90, 91,
  // props
  92, // rock
  93, // sign
  94, // lamp
  95, // ring/target
  103, // crate
  104, // chest
  106, // barrel
  119, // torch
  130, // small barrel
  131, // well
] as const;

export const DUNGEON_TILES = [] as const;
