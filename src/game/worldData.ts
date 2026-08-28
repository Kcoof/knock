import { MAP_H, MAP_W, TILE } from "./constants";
import type { BuildingSpec, CharacterKey, DoorInfo } from "./types";

/**
 * World layout from Qwen's "Warm Dusk" reference: a warm evening village
 * with a central brick plaza and well, a circular pond, and six buildings
 * connected by dirt paths. Personal slots are filled with real database
 * rooms at runtime (worldRooms); guests keep this mock neighborhood.
 */
export const BUILDINGS: BuildingSpec[] = [
  { id: "reehana", name: "Reehana's Room", x: 5, y: 3, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "personal" },
  { id: "ahmed", name: "Ahmed's Room", x: 29, y: 3, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "personal" },
  { id: "community", name: "Community Room", x: 17, y: 2, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "community" },
  { id: "library", name: "Library", x: 17, y: 27, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "community" },
  { id: "focus", name: "Focus Zone", x: 5, y: 26, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "community" },
  { id: "sara", name: "Sara's Room", x: 29, y: 26, w: 6, h: 5, roof: "red", doorOffsetX: 3, roomType: "personal" },
];

/** Mock door data keyed by building id. */
export const DOORS: Record<string, DoorInfo> = {
  reehana: {
    id: "reehana",
    buildingName: "Reehana's Room",
    owner: "Reehana",
    activity: "Building v2",
    status: "Focus",
    state: "focus",
  },
  ahmed: {
    id: "ahmed",
    buildingName: "Ahmed's Room",
    owner: "Ahmed",
    activity: "Fixing bugs",
    status: "Working",
    state: "knock",
  },
  sara: {
    id: "sara",
    buildingName: "Sara's Room",
    owner: "Sara",
    activity: "Sketching",
    status: "Available",
    state: "open",
  },
  community: {
    id: "community",
    buildingName: "Community Room",
    owner: "Everyone",
    activity: "Town hall",
    status: "Available",
    state: "open",
  },
  library: {
    id: "library",
    buildingName: "Library",
    owner: "Everyone",
    activity: "Docs & refs",
    status: "Available",
    state: "open",
  },
  focus: {
    id: "focus",
    buildingName: "Focus Zone",
    owner: "Everyone",
    activity: "Heads down",
    status: "Focus",
    state: "focus",
  },
};

export interface NpcV2 {
  id: string;
  name: string;
  status: string;
  char: CharacterKey;
  /** Spawn position in tiles. */
  x: number;
  y: number;
  /** Initial facing: 0 down, 1 left, 2 right, 3 up. */
  facing: 0 | 1 | 2 | 3;
  /** Optional patrol waypoints in tiles; walks the loop continuously. */
  waypoints?: Array<{ x: number; y: number }>;
}

/** Residents from the reference: two at their doors, one roaming the plaza. */
export const NPCS: NpcV2[] = [
  { id: "npc-ahmed", name: "Ahmed", status: "Working", char: "noble", x: 32, y: 8.75, facing: 0 },
  { id: "npc-sara", name: "Sara", status: "Available", char: "mage", x: 32, y: 31.75, facing: 0 },
  {
    id: "npc-milo",
    name: "Milo",
    status: "Roaming",
    char: "traveler",
    x: 20.5,
    y: 13,
    facing: 0,
    waypoints: [
      { x: 20.5, y: 13 },
      { x: 20.5, y: 19 },
      { x: 26.5, y: 16 },
      { x: 20.5, y: 19 },
      { x: 20.5, y: 13 },
      { x: 14.5, y: 16 },
    ],
  },
];

/** Player spawn point in tiles (south of the plaza, reference position). */
export const SPAWN = { x: 20.5, y: 21 };

/** Circular pond: center in tiles + radius in tiles (reference shape). */
export const POND = { cx: 33, cy: 18, r: 4.6 };

/** Brick plaza rectangle in tiles. */
export const PLAZA = { x: 14, y: 14, w: 12, h: 6 };

/** Dirt path lines (tile coords); stamped with the reference width. */
export const PATH_LINES: Array<[{ x: number; y: number }, { x: number; y: number }]> = [
  [{ x: 20, y: 6 }, { x: 20, y: 13 }],
  [{ x: 20, y: 19 }, { x: 20, y: 27 }],
  [{ x: 8, y: 5 }, { x: 20, y: 5 }],
  [{ x: 20, y: 5 }, { x: 32, y: 5 }],
  [{ x: 8, y: 28 }, { x: 20, y: 28 }],
  [{ x: 20, y: 28 }, { x: 32, y: 28 }],
  [{ x: 8, y: 5 }, { x: 8, y: 28 }],
  [{ x: 32, y: 5 }, { x: 32, y: 28 }],
  [{ x: 20, y: 16 }, { x: 14, y: 16 }],
  [{ x: 20, y: 16 }, { x: 26, y: 16 }],
];

/** Trees: top-left tile of the trunk slot (reference positions). */
export type TreeVariant = "g" | "o";

export const TREES: Array<{ x: number; y: number; variant: TreeVariant }> = [
  { x: 10, y: 9, variant: "g" },
  { x: 12, y: 11, variant: "o" },
  { x: 9, y: 13, variant: "g" },
  { x: 30, y: 9, variant: "g" },
  { x: 32, y: 11, variant: "o" },
  { x: 30, y: 13, variant: "g" },
  { x: 11, y: 24, variant: "g" },
  { x: 13, y: 26, variant: "o" },
  { x: 10, y: 27, variant: "g" },
  { x: 30, y: 24, variant: "g" },
  { x: 32, y: 26, variant: "o" },
  { x: 30, y: 27, variant: "g" },
  { x: 3, y: 15, variant: "g" },
  { x: 3, y: 18, variant: "g" },
  { x: 36, y: 15, variant: "g" },
  { x: 36, y: 18, variant: "g" },
];

/** Flower clusters: center tile, count, and petal palette (reference groups). */
export const FLOWER_GROUPS: Array<{ x: number; y: number; n: number; palette: string[] }> = [
  { x: 11, y: 10, n: 6, palette: ["#f87171", "#fbbf24", "#fdba74"] },
  { x: 29, y: 10, n: 6, palette: ["#fbbf24", "#f87171", "#fef3c7"] },
  { x: 11, y: 27, n: 6, palette: ["#fdba74", "#fbbf24", "#fef3c7"] },
  { x: 29, y: 27, n: 6, palette: ["#f87171", "#fef3c7", "#fbbf24"] },
];

/** Bushes in tiles. */
export const BUSHES: Array<{ x: number; y: number }> = [
  { x: 14, y: 10 },
  { x: 26, y: 10 },
  { x: 14, y: 24 },
  { x: 26, y: 24 },
  { x: 6, y: 20 },
  { x: 34, y: 20 },
];

/** Street lamps (reference positions: two on the plaza, two on the main path). */
export const LAMPS: Array<{ x: number; y: number }> = [
  { x: 17.5, y: 16 },
  { x: 23.5, y: 16 },
  { x: 20.5, y: 11 },
  { x: 20.5, y: 21 },
];

/** The plaza well (drawn at the reference position). */
export const WELL = { x: 20, y: 16 };

export function doorWorldPos(b: BuildingSpec): { x: number; y: number } {
  return {
    x: (b.x + b.w / 2) * TILE,
    y: (b.y + b.h) * TILE + 8,
  };
}

export function inBounds(tx: number, ty: number) {
  return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
}

export function doorStateLabel(state: DoorInfo["state"]): string {
  switch (state) {
    case "open":
      return "OPEN";
    case "knock":
      return "KNOCK FIRST";
    case "focus":
      return "FOCUS";
  }
}
