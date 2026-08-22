export const TILE = 32;

/** Camera zoom: 32px tiles rendered at 48px on screen. */
export const ZOOM = 1.5;

export const MAP_W = 40;
export const MAP_H = 34;

export const PLAYER_SPEED = 200; // world px per second

/** How close (world px) the player must be to a door to interact. */
export const DOOR_INTERACT_DISTANCE = 52;

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
 * Kenney tiles pre-scaled to 2x (64px) to match the 32px LPC ground,
 * loaded from town2x/ under the usual `t<index>` keys.
 */
export const TOWN_TILES = [
  19, 43, 44, 52, 53, 63, 64, 65, 72, 73, 77, 85, 87, 88, 89, 91,
  92, 93, 94, 96, 99, 103, 104, 106, 108, 109, 111, 120, 121, 126, 130, 131,
] as const;

/** V2 country hubs (spec §40) — start with a small test set. */
export const HUBS = {
  india: { name: "India Hub", ground: "grass", accent: "#22c55e" },
  sa: { name: "Saudi Arabia Hub", ground: "sand", accent: "#eab308" },
  japan: { name: "Japan Hub", ground: "light", accent: "#f472b6" },
  us: { name: "United States Hub", ground: "snow", accent: "#60a5fa" },
  uk: { name: "United Kingdom Hub", ground: "grass", accent: "#a78bfa" },
  germany: { name: "Germany Hub", ground: "snow", accent: "#f87171" },
  egypt: { name: "Egypt Hub", ground: "sand", accent: "#fbbf24" },
} as const;

export type HubId = keyof typeof HUBS;

export function normalizeHub(value: string | null | undefined): HubId {
  return value && value in HUBS ? (value as HubId) : "india";
}

