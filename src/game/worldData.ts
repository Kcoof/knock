import { MAP_H, MAP_W } from "./constants";
import type { BuildingSpec, CharacterKey, DoorInfo } from "./types";

/**
 * The Phase 1 mock world: a small builder neighborhood with three personal
 * rooms, two community buildings and a focus zone, gardens, trees and a
 * pond. Everything here is mock data — Phase 2+ replaces it with
 * Supabase-backed rooms and presence.
 */
export const BUILDINGS: BuildingSpec[] = [
  {
    id: "reehana",
    name: "Reehana's Room",
    x: 3,
    y: 3,
    w: 7,
    h: 4,
    roof: "red",
    doorOffsetX: 3,
    roomType: "personal",
  },
  {
    id: "ahmed",
    name: "Ahmed's Room",
    x: 24,
    y: 3,
    w: 7,
    h: 4,
    roof: "orange",
    doorOffsetX: 3,
    roomType: "personal",
  },
  {
    id: "sara",
    name: "Sara's Room",
    x: 32,
    y: 10,
    w: 7,
    h: 4,
    roof: "red2",
    doorOffsetX: 3,
    roomType: "personal",
  },
  {
    id: "community",
    name: "Community Room",
    x: 3,
    y: 20,
    w: 10,
    h: 5,
    roof: "stone",
    doorOffsetX: 4,
    roomType: "community",
  },
  {
    id: "library",
    name: "Library",
    x: 27,
    y: 20,
    w: 8,
    h: 5,
    roof: "stone",
    doorOffsetX: 3,
    roomType: "community",
  },
  {
    id: "focus",
    name: "Focus Zone",
    x: 15,
    y: 27,
    w: 7,
    h: 4,
    roof: "orange",
    doorOffsetX: 3,
    roomType: "community",
  },
];

/** Mock door data keyed by building id. */
export const DOORS: Record<string, DoorInfo> = {
  reehana: {
    id: "reehana",
    buildingName: "Reehana's Room",
    owner: "Reehana",
    activity: "Training a vision model",
    status: "Focus",
    state: "focus",
  },
  ahmed: {
    id: "ahmed",
    buildingName: "Ahmed's Room",
    owner: "Ahmed",
    activity: "Working on Authentication API",
    status: "Working",
    state: "knock",
  },
  sara: {
    id: "sara",
    buildingName: "Sara's Room",
    owner: "Sara",
    activity: "Sketching UI ideas",
    status: "Available",
    state: "open",
  },
  community: {
    id: "community",
    buildingName: "Community Room",
    owner: "Everyone",
    activity: "Open hangout space",
    status: "Available",
    state: "open",
  },
  library: {
    id: "library",
    buildingName: "Library",
    owner: "Everyone",
    activity: "Quiet reading & research",
    status: "Available",
    state: "open",
  },
  focus: {
    id: "focus",
    buildingName: "Focus Zone",
    owner: "Everyone",
    activity: "Deep work only",
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

/** Mock residents standing in the world (no backend yet). */
export const NPCS: NpcV2[] = [
  {
    id: "npc-ahmed",
    name: "Ahmed",
    status: "Working",
    char: "noble",
    x: 29.6,
    y: 8.5,
    facing: 3,
  },
  {
    id: "npc-sara",
    name: "Sara",
    status: "Available",
    char: "mage",
    x: 33.6,
    y: 16.4,
    facing: 2,
  },
  {
    id: "npc-traveler",
    name: "Yuki",
    status: "Just visiting",
    char: "traveler",
    x: 8.5,
    y: 17.5,
    facing: 2,
    waypoints: [
      { x: 8.5, y: 17.5 },
      { x: 19.5, y: 17.5 },
      { x: 19.5, y: 25.4 },
      { x: 26.2, y: 25.4 },
      { x: 26.2, y: 17.5 },
      { x: 31.2, y: 17.5 },
    ],
  },
];

/** Player spawn point in tiles. */
export const SPAWN = { x: 19.5, y: 17.5 };

/** Water pond rectangle in tiles. */
export const POND = { x: 32, y: 26, w: 7, h: 7 };

/** Brick plaza in tiles (center meeting point). */
export const PLAZA = { x: 17, y: 15.5, w: 6, h: 4 };

/** Sand path rectangles in tiles, drawn onto the ground layer. */
export const PATHS: Array<{ x: number; y: number; w: number; h: number }> = [
  // Main east-west corridor
  { x: 2, y: 16, w: 36, h: 2 },
  // North-south spokes to each door
  { x: 6, y: 7, w: 2, h: 9 }, // Reehana
  { x: 26, y: 7, w: 2, h: 9 }, // Ahmed
  { x: 34, y: 14, w: 2, h: 2 }, // Sara (short link to corridor)
  { x: 6, y: 18, w: 2, h: 2 }, // Community
  { x: 29, y: 18, w: 2, h: 2 }, // Library
  { x: 17, y: 25, w: 2, h: 2 }, // Focus Zone
  // Community <-> Library south walkway
  { x: 7, y: 25, w: 24, h: 1 },
  // Library <-> pond boardwalk approach
  { x: 35, y: 25, w: 2, h: 1 },
];

/** Trees: top-left tile of a 2x3 stamp (canopy 2x2 + trunk row). */
export const TREES: Array<{ x: number; y: number; variant: "A" | "B" }> = [
  { x: 1, y: 3, variant: "A" },
  { x: 1, y: 7, variant: "B" },
  { x: 11, y: 3, variant: "B" },
  { x: 13, y: 6, variant: "A" },
  { x: 17, y: 5, variant: "A" },
  { x: 20, y: 3, variant: "B" },
  { x: 22, y: 8, variant: "A" },
  { x: 32, y: 4, variant: "A" },
  { x: 37, y: 6, variant: "B" },
  { x: 31, y: 6, variant: "A" },
  { x: 30, y: 3, variant: "B" },
  { x: 12, y: 19, variant: "A" },
  { x: 12, y: 23, variant: "B" },
  { x: 20, y: 21, variant: "A" },
  { x: 24, y: 15, variant: "B" },
  { x: 9, y: 27, variant: "A" },
  { x: 13, y: 30, variant: "B" },
  { x: 23, y: 26, variant: "A" },
  { x: 25, y: 31, variant: "B" },
  { x: 37, y: 14, variant: "A" },
  { x: 1, y: 17, variant: "B" },
  { x: 1, y: 29, variant: "A" },
];

/** Flower gardens: rect is fenced with a gap; flowers scattered inside. */
export const GARDENS: Array<{ x: number; y: number; w: number; h: number }> = [
  { x: 12, y: 10, w: 4, h: 3 },
  { x: 19, y: 9, w: 4, h: 3 },
  { x: 36, y: 18, w: 3, h: 3 },
  { x: 4, y: 27, w: 4, h: 3 },
];

/** Street lamps along the main corridor. */
export const LAMPS: Array<{ x: number; y: number }> = [
  { x: 15.5, y: 18.9 },
  { x: 23.5, y: 18.9 },
  { x: 7.5, y: 15.1 },
  { x: 31.5, y: 15.1 },
  { x: 19.5, y: 25.1 },
  { x: 34.5, y: 25.1 },
];

/** Benches: original KNOCK prop, drawn in props/bench.png. */
export const BENCHES: Array<{ x: number; y: number }> = [
  { x: 20.5, y: 20.9 },
  { x: 32.9, y: 24.5 },
  { x: 28.4, y: 18.7 },
  { x: 8.6, y: 19.3 },
];

/**
 * Ground props: tile index, tile position, and whether the player collides.
 * The well, barrels, crates and rocks make the world feel lived-in.
 */
export const PROPS: Array<{ tile: number; x: number; y: number; blocked: boolean }> = [
  { tile: 131, x: 22.5, y: 19.4, blocked: true }, // well on the plaza edge
  { tile: 103, x: 13.6, y: 26.4, blocked: true }, // crate by Community Room
  { tile: 106, x: 14.7, y: 26.5, blocked: true }, // barrel
  { tile: 130, x: 25.4, y: 26.5, blocked: true }, // small barrel near Focus Zone
  { tile: 92, x: 38.5, y: 24.5, blocked: true }, // rock near pond
  { tile: 92, x: 30.6, y: 27.4, blocked: true },
  { tile: 92, x: 2.5, y: 22.5, blocked: true },
  { tile: 93, x: 25.6, y: 25.6, blocked: false }, // sign by Focus Zone path
  { tile: 93, x: 32.4, y: 18.6, blocked: false }, // sign near Library
  { tile: 104, x: 9.5, y: 22.5, blocked: true }, // chest by Community Room wall
  { tile: 92, x: 11.5, y: 16.5, blocked: true }, // rock on corridor
];

/** Non-blocking ground decorations (bushes, flowers) in tiles. */
export const DECOR: Array<{ tile: number; x: number; y: number }> = [
  { tile: 19, x: 11.5, y: 8.5 },
  { tile: 19, x: 22.5, y: 12.0 },
  { tile: 19, x: 30.5, y: 16.9 },
  { tile: 19, x: 3.5, y: 14.5 },
  { tile: 19, x: 37.5, y: 20.5 },
  { tile: 19, x: 11.5, y: 28.5 },
  { tile: 19, x: 27.5, y: 28.6 },
  { tile: 43, x: 10.5, y: 12.6 },
  { tile: 43, x: 15.5, y: 8.0 },
  { tile: 43, x: 28.5, y: 14.5 },
  { tile: 43, x: 8.5, y: 24.4 },
  { tile: 43, x: 26.5, y: 22.5 },
  { tile: 43, x: 35.5, y: 23.4 },
  { tile: 43, x: 3.5, y: 33.5 },
  { tile: 43, x: 15.5, y: 33.5 },
];

/** Deterministic ground texture variation. */
export function groundTileAt(tx: number, ty: number): number {
  const h = (tx * 73856093) ^ (ty * 19349663);
  const v = Math.abs(h % 100);
  if (v < 70) return 0;
  if (v < 90) return 1;
  return 2;
}

/**
 * Mottled-grass overlay: returns an extra "detail" tile for some grass cells
 * (light dirt patches, dry spots) so the ground reads textured like a
 * hand-drawn map instead of a flat fill. 0 = no overlay.
 */
export function grassDetailAt(tx: number, ty: number): number {
  const h = (tx * 19349663) ^ (ty * 83492791);
  const v = Math.abs(h % 100);
  if (v < 6) return 24; // light sand patch
  if (v < 11) return 36; // dirt patch
  if (v < 14) return 39; // dry spot
  if (v < 18) return 15; // grass/dirt blend corner
  return 0;
}

/** Deterministic sand-path texture variation. */
export function pathTileAt(tx: number, ty: number): number {
  const h = (tx * 83492791) ^ (ty * 2971215073);
  const v = Math.abs(h % 100);
  if (v < 60) return 13;
  if (v < 75) return 24;
  if (v < 85) return 25;
  if (v < 93) return 36;
  if (v < 97) return 37;
  if (v < 99) return 39;
  return 40;
}

export function doorWorldPos(b: BuildingSpec): { x: number; y: number } {
  return {
    x: (b.x + b.doorOffsetX + 0.5) * 16,
    y: (b.y + b.h - 0.5) * 16,
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
