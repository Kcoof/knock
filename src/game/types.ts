export type DoorState = "open" | "knock" | "focus";

export type PresenceStatus =
  | "Available"
  | "Working"
  | "Focus"
  | "Away"
  | "Offline";

/** A building in the world grid. Coordinates are in tiles. */
export interface BuildingSpec {
  id: string;
  /** Display name, e.g. "Ahmed's Room" */
  name: string;
  x: number;
  y: number;
  w: number;
  /** Total height in tiles: 2 roof rows + wall row + door row (or more). */
  h: number;
  roof: "red" | "red2" | "orange" | "stone";
  /** Door column offset from building left edge (in tiles). */
  doorOffsetX: number;
  roomType: "personal" | "community";
}

/** Mock door data shown on nameplates and in the knock flow. */
export interface DoorInfo {
  id: string;
  buildingName: string;
  owner: string;
  activity: string;
  status: PresenceStatus;
  state: DoorState;
}

export interface NpcSpec {
  id: string;
  name: string;
  status: PresenceStatus;
  activity: string;
  tile: number;
  /** Spawn position in tiles. */
  x: number;
  y: number;
  facingLeft: boolean;
}
