import { MAP_H, MAP_W } from "./constants";
import type { BuildingSpec, DoorInfo, DoorState, NpcSpec } from "./types";

/**
 * The Phase 1 mock world: one small neighborhood with three personal rooms,
 * two community buildings and a focus zone. Everything here is mock data —
 * Phase 2+ replaces it with Supabase-backed rooms and presence.
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

/** Mock residents standing in the world (no backend yet). */
export const NPCS: NpcSpec[] = [
  {
    id: "npc-ahmed",
    name: "Ahmed",
    status: "Working",
    activity: "Authentication API",
    tile: 84,
    x: 29.5,
    y: 8.4,
    facingLeft: true,
  },
  {
    id: "npc-sara",
    name: "Sara",
    status: "Available",
    activity: "Sketching UI ideas",
    tile: 87,
    x: 33.6,
    y: 16.4,
    facingLeft: false,
  },
];

/** Player spawn point in tiles. */
export const SPAWN = { x: 19.5, y: 17.5 };

/** Water pond rectangle in tiles. */
export const POND = { x: 32, y: 26, w: 7, h: 7 };

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
];

/** Blocked decoration sprites (bushes, chest) in tiles. */
export const BLOCKED_PROPS: Array<{ tile: number; x: number; y: number }> = [
  { tile: 107, x: 14, y: 25.9 }, // chest by the Community Room
  { tile: 19, x: 1.5, y: 12 },
  { tile: 19, x: 12, y: 13.5 },
  { tile: 19, x: 21, y: 12 },
  { tile: 19, x: 30, y: 17.2 },
  { tile: 19, x: 15, y: 22 },
  { tile: 19, x: 26, y: 26 },
  { tile: 19, x: 38.4, y: 18 },
  { tile: 19, x: 1.5, y: 26 },
  { tile: 19, x: 38.4, y: 3 },
];

/** Non-blocking ground decorations (flowers, coins) in tiles. */
export const DECOR_PROPS: Array<{ tile: number; x: number; y: number }> = [
  { tile: 43, x: 10.5, y: 10 },
  { tile: 43, x: 20, y: 8 },
  { tile: 43, x: 29, y: 14.5 },
  { tile: 43, x: 12, y: 24 },
  { tile: 43, x: 24, y: 21 },
  { tile: 43, x: 8, y: 18.5 },
  { tile: 43, x: 36.5, y: 22 },
  { tile: 43, x: 2.5, y: 6 },
  { tile: 93, x: 19.5, y: 16.4 },
  { tile: 93, x: 12.5, y: 16.4 },
  { tile: 93, x: 28.5, y: 16.4 },
];

/** Deterministic grass variation: returns tile indices for the ground fill. */
export function grassTileAt(tx: number, ty: number): number {
  // cheap deterministic hash so the client always renders the same map
  const h = (tx * 73856093) ^ (ty * 19349663);
  const v = Math.abs(h % 100);
  if (v < 70) return 0;
  if (v < 90) return 1;
  return 2;
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

export function doorStateLabel(state: DoorState): string {
  switch (state) {
    case "open":
      return "OPEN";
    case "knock":
      return "KNOCK FIRST";
    case "focus":
      return "FOCUS";
  }
}
