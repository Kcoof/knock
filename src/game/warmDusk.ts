import Phaser from "phaser";
import type { BuildingSpec } from "./types";

/**
 * Warm Dusk sprite factory — a faithful TypeScript port of Qwen's
 * "KNOCK — Warm Dusk" HTML prototype. Every sprite is drawn procedurally
 * onto offscreen canvases (seeded, deterministic) and registered as Phaser
 * textures, so the world renders pixel-identical to the reference.
 */

const T = 32;

function mulberry(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded RNG for scenes (deterministic scatter layouts). */
export function mulberry32(seed: number): () => number {
  return mulberry(seed);
}

function makeOffscreen(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

function fillRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function strokeFillRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string | null,
  stroke: string | null,
) {
  if (fill) {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

function fillEllipse(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string) {
  c.beginPath();
  c.ellipse(cx, cy, rx, ry, 0, 0, 6.283);
  c.fillStyle = color;
  c.fill();
}

function drawLine(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w = 1) {
  c.strokeStyle = color;
  c.lineWidth = w;
  c.beginPath();
  c.moveTo(x1 + 0.5, y1 + 0.5);
  c.lineTo(x2 + 0.5, y2 + 0.5);
  c.stroke();
}

const PAL = {
  gA: "#4a6741", gB: "#3d5a36", gL: "#5c7a52",
  di: "#9c7a52", diD: "#7a5c3a", diL: "#b89468",
  wa: "#3a6b8c", fo: "#c8dce8",
  br: "#c4724a", brD: "#944a2e", brL: "#d88a62", mo: "#7a4a30",
  st: "#9a9490", stD: "#6b6560", stL: "#b8b2ad",
  cr: "#e8d8b8", crD: "#c8b898",
  wd: "#a87848", wdD: "#785430",
  tr: "#7a5230", trD: "#5a3820",
  lG: "#3a6838", lGM: "#4a8244", lGL: "#62a058",
  lO: "#d47830", lOM: "#e89240", lOL: "#f0aa50",
  dr: "#8a5830", drD: "#6a4020",
  gl: "#c8e0f0", fr: "#5a3820", ol: "#1a1410",
};

// --- terrain tiles ----------------------------------------------------------

function makeGrassTiles(): HTMLCanvasElement[] {
  const R = mulberry(7);
  const mk = (base: string) => {
    const [c, sc] = makeOffscreen(T, T);
    fillRect(sc, 0, 0, T, T, base);
    for (let i = 0; i < 35; i++) {
      const sx = (R() * T) | 0;
      const sy = (R() * T) | 0;
      fillRect(sc, sx, sy, R() < 0.5 ? 1 : 2, 1, R() < 0.5 ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.05)");
    }
    return c;
  };
  return [mk(PAL.gA), mk(PAL.gB), mk(PAL.gL)];
}

function makeDirtTile(): HTMLCanvasElement {
  const R = mulberry(21);
  const [c, sc] = makeOffscreen(T, T);
  fillRect(sc, 0, 0, T, T, PAL.di);
  for (let i = 0; i < 25; i++) {
    const sx = (R() * T) | 0;
    const sy = (R() * T) | 0;
    fillRect(sc, sx, sy, 1, 1, R() < 0.5 ? PAL.diL : PAL.diD);
  }
  return c;
}

function makePlazaTile(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(T, T);
  fillRect(sc, 0, 0, T, T, PAL.mo);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const off = row % 2 ? 8 : 0;
      strokeFillRect(sc, col * 16 + off, row * 16, 15, 15, PAL.br, PAL.brD);
      fillRect(sc, col * 16 + off, row * 16, 15, 3, PAL.brL);
    }
  }
  return c;
}

function makeWaterTile(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(T, T);
  fillRect(sc, 0, 0, T, T, PAL.wa);
  for (let i = 0; i < 3; i++) fillRect(sc, 0, i * 10 + 2, T, 1, "rgba(255,255,255,.04)");
  return c;
}

function makeFoamTile(mask: number): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(T, T);
  fillRect(sc, 0, 0, T, T, PAL.wa);
  if (mask & 1) fillRect(sc, 0, 0, T, 4, PAL.fo);
  if (mask & 2) fillRect(sc, 0, T - 4, T, 4, PAL.fo);
  if (mask & 4) fillRect(sc, 0, 0, 4, T, PAL.fo);
  if (mask & 8) fillRect(sc, T - 4, 0, 4, T, PAL.fo);
  return c;
}

function makeTransition(kind: "d" | "p"): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(T, T);
  fillRect(sc, 0, 0, T, T, PAL.gA);
  const R = mulberry(kind === "d" ? 55 : 77);
  const colors = kind === "d" ? [PAL.di, PAL.diD, PAL.diL] : [PAL.br, PAL.brD, PAL.brL];
  for (let i = 0; i < 8; i++) {
    const sx = (R() * T) | 0;
    const sy = (R() * T) | 0;
    fillRect(sc, sx, sy, 2 + ((R() * 3) | 0), 2 + ((R() * 3) | 0), colors[R() < 0.6 ? 0 : 1]);
  }
  return c;
}

// --- props ------------------------------------------------------------------

function makeShadow(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(40, 20);
  const grd = sc.createRadialGradient(20, 10, 1, 20, 10, 19);
  grd.addColorStop(0, "rgba(0,0,0,.3)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  sc.fillStyle = grd;
  sc.fillRect(0, 0, 40, 20);
  return c;
}

function makeTreeSprite(type: "g" | "o"): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(64, 80);
  const pal = type === "o" ? { o: PAL.lO, m: PAL.lOM, l: PAL.lOL } : { o: PAL.lG, m: PAL.lGM, l: PAL.lGL };
  fillRect(sc, 28, 54, 8, 22, PAL.tr);
  fillRect(sc, 28, 54, 3, 22, PAL.trD);
  drawLine(sc, 32, 58, 26, 50, PAL.trD, 2);
  drawLine(sc, 32, 60, 38, 52, PAL.trD, 2);
  const blobs = [[32, 30, 20], [20, 36, 14], [44, 36, 14], [32, 44, 15]] as const;
  for (const [bx, by, r] of blobs) {
    fillEllipse(sc, bx, by, r, r * 0.92, PAL.ol);
    fillEllipse(sc, bx, by, r - 1, r - 2, pal.o);
  }
  for (const [bx, by, r] of blobs) fillEllipse(sc, bx - 2, by - 3, r - 5, r - 6, pal.m);
  for (const [bx, by, r] of blobs) fillEllipse(sc, bx - 4, by - 6, r - 9, r - 9, pal.l);
  return c;
}

function makeBushSprite(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(30, 22);
  fillEllipse(sc, 15, 13, 13, 9, PAL.ol);
  fillEllipse(sc, 15, 12, 11, 8, PAL.lG);
  fillEllipse(sc, 12, 10, 7, 5, PAL.lGM);
  return c;
}

const FLOWER_COLORS = ["#f87171", "#fbbf24", "#fdba74", "#fef3c7"] as const;

function makeFlowerSprite(color: string): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(10, 12);
  fillRect(sc, 4, 6, 2, 5, "#3a6838");
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.283;
    fillRect(sc, 5 + Math.cos(a) * 3 - 1, 4 + Math.sin(a) * 3 - 1, 3, 3, color);
  }
  fillRect(sc, 4, 3, 3, 3, "#fbbf24");
  return c;
}

function makeLampSprite(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(20, 44);
  fillRect(sc, 9, 14, 3, 28, PAL.fr);
  fillRect(sc, 6, 4, 9, 10, PAL.ol);
  fillRect(sc, 7, 5, 7, 8, "#fff0c0");
  fillRect(sc, 6, 2, 9, 3, PAL.fr);
  return c;
}

function makeWellSprite(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(40, 46);
  fillRect(sc, 6, 26, 28, 16, PAL.stD);
  for (let i = 0; i < 4; i++) strokeFillRect(sc, 7 + i * 7, 27, 6, 14, i % 2 ? PAL.st : PAL.stL, PAL.stD);
  fillEllipse(sc, 20, 26, 15, 5, PAL.stD);
  fillEllipse(sc, 20, 26, 11, 3, PAL.wa);
  fillRect(sc, 8, 6, 3, 22, PAL.tr);
  fillRect(sc, 29, 6, 3, 22, PAL.tr);
  fillRect(sc, 4, 2, 32, 5, PAL.br);
  return c;
}

function makeDoorSprite(): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(22, 26);
  strokeFillRect(sc, 0, 0, 22, 26, PAL.fr, null);
  strokeFillRect(sc, 2, 2, 18, 24, PAL.dr, PAL.drD);
  return c;
}

// --- buildings ---------------------------------------------------------------

type RoofKind = "red" | "blue" | "teal" | "purple" | "green";
type WallKind = "cream" | "wood" | "stone";

/** Per-building look from the Warm Dusk reference, keyed by building id. */
export const WARM_BUILDING_LOOK: Record<string, { roof: RoofKind; wall: WallKind }> = {
  reehana: { roof: "red", wall: "cream" },
  ahmed: { roof: "blue", wall: "cream" },
  community: { roof: "teal", wall: "wood" },
  library: { roof: "purple", wall: "stone" },
  focus: { roof: "green", wall: "wood" },
  sara: { roof: "red", wall: "cream" },
};

function makeBuildingSprite(bw: number, bh: number, roof: RoofKind, wall: WallKind): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(bw, bh);
  const roofColors = {
    red: [PAL.br, PAL.brD, PAL.brL],
    blue: ["#4a6b9c", "#2a4a7a", "#6a8bbc"],
    teal: ["#3a8a7a", "#1a6a5a", "#5aaa9a"],
    purple: ["#7a5090", "#5a3070", "#9a70b0"],
    green: ["#4a8040", "#2a6020", "#6aa060"],
  }[roof];
  const wallColors =
    wall === "stone" ? [PAL.st, PAL.stD, PAL.stL] : wall === "wood" ? [PAL.wd, PAL.wdD, "#b88858"] : [PAL.cr, PAL.crD, "#f0e0c0"];
  const wallY = 2 * T;
  strokeFillRect(sc, 0, 0, bw, 2 * T, roofColors[0], PAL.ol);
  for (let i = 0; i < bw; i += 12) drawLine(sc, i, 0, i + 6, 2 * T, roofColors[1], 1);
  fillRect(sc, 0, 0, bw, 3, roofColors[2]);
  strokeFillRect(sc, 2, wallY, bw - 4, bh - wallY, wallColors[0], PAL.ol);
  fillRect(sc, 2, wallY, bw - 4, 3, wallColors[2]);
  if (wall === "stone") {
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 6; col++) {
        strokeFillRect(sc, 4 + col * ((bw - 8) / 6), wallY + 6 + row * 10, (bw - 8) / 6 - 2, 8, wallColors[row % 2 ? 0 : 2], wallColors[1]);
      }
    }
  }
  const numWin = wall === "stone" ? 3 : 2;
  for (let i = 0; i < numWin; i++) {
    const wx = wall === "stone" ? (bw - 18 * (i + 1) - 6 * i) / (numWin + 1) : i === 0 ? 12 : bw - 18 - 12;
    strokeFillRect(sc, wx, wallY + 10, 18, 22, PAL.gl, PAL.fr);
    fillRect(sc, wx + 2, wallY + 12, 14, 18, PAL.gl);
    fillRect(sc, wx + 8, wallY + 10, 2, 22, PAL.fr);
    fillRect(sc, wx, wallY + 20, 18, 2, PAL.fr);
  }
  return c;
}

// --- characters ---------------------------------------------------------------

export const WARM_CHAR_LOOK: Record<string, { skin: string; shirt: string; pants: string; hair: string }> = {
  builder: { skin: "#e8c098", shirt: "#3a8a7a", pants: "#4a5a6b", hair: "#3a2818" },
  noble: { skin: "#d4a878", shirt: "#4a6b9c", pants: "#4a5a6b", hair: "#3a2818" },
  mage: { skin: "#f0d0b0", shirt: "#c45040", pants: "#4a5a6b", hair: "#6a4830" },
  traveler: { skin: "#c89068", shirt: "#8a5a9a", pants: "#4a5a6b", hair: "#4a3020" },
};

type PersonDir = "down" | "up" | "left" | "right";

function makePersonSprite(skin: string, shirt: string, pants: string, hair: string, dir: PersonDir, step: boolean): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(20, 24);
  const oy = step ? -1 : 0;
  if (dir === "up") {
    fillRect(sc, 4, 3 + oy, 12, 10, PAL.ol);
    fillRect(sc, 5, 4 + oy, 10, 8, hair);
    fillRect(sc, 5, 3 + oy, 10, 4, hair);
    fillRect(sc, 4, 3 + oy, 12, 4, hair);
    fillRect(sc, 5, 13 + oy, 10, 7, shirt);
    fillRect(sc, 2, 14 + oy, 3, 6, shirt);
    fillRect(sc, 15, 14 + oy, 3, 6, shirt);
    const ly = step ? [5, 12] : [6, 11];
    fillRect(sc, ly[0], 20, 3, 4, pants);
    fillRect(sc, ly[1], 20, 3, 4, pants);
  } else if (dir === "down") {
    fillRect(sc, 4, 3 + oy, 12, 10, PAL.ol);
    fillRect(sc, 5, 4 + oy, 10, 8, skin);
    fillRect(sc, 5, 3 + oy, 10, 3, hair);
    fillRect(sc, 4, 3 + oy, 2, 5, hair);
    fillRect(sc, 14, 3 + oy, 2, 5, hair);
    fillRect(sc, 7, 8 + oy, 2, 2, PAL.ol);
    fillRect(sc, 11, 8 + oy, 2, 2, PAL.ol);
    fillRect(sc, 5, 13 + oy, 10, 7, shirt);
    fillRect(sc, 2, 14 + oy, 3, 7, shirt);
    fillRect(sc, 15, 14 + oy, 3, 7, shirt);
    const ly = step ? [5, 12] : [6, 11];
    fillRect(sc, ly[0], 20, 3, 4, pants);
    fillRect(sc, ly[1], 20, 3, 4, pants);
  } else {
    const flip = dir === "left";
    const ox = flip ? -1 : 1;
    const hx = 10 + ox * 3;
    fillRect(sc, hx - 5, 3 + oy, 10, 10, PAL.ol);
    fillRect(sc, hx - 4, 4 + oy, 8, 8, skin);
    fillRect(sc, hx - 5, 3 + oy, 10, 3, hair);
    fillRect(sc, hx - 5, 3 + oy, 3, 6, hair);
    fillRect(sc, hx + ox * 2, 7 + oy, 2, 2, PAL.ol);
    fillRect(sc, 6, 13 + oy, 8, 7, shirt);
    fillRect(sc, ox > 0 ? 13 : 4, 14 + oy, 3, 6, shirt);
    const lx = step ? (ox > 0 ? [7, 11] : [11, 7]) : [7, 11];
    fillRect(sc, lx[0], 20, 2, 4, pants);
    fillRect(sc, lx[1], 20, 2, 4, pants);
  }
  return c;
}

/**
 * Builds a 2-col × 4-row character sheet (rows: down, left, right, up —
 * matching WorldScene's CHAR_DIRS and the frame numbering used by the
 * registered walk animations).
 */
function makePersonSheet(look: { skin: string; shirt: string; pants: string; hair: string }): HTMLCanvasElement {
  const [c, sc] = makeOffscreen(40, 96);
  const rows: PersonDir[] = ["down", "left", "right", "up"];
  rows.forEach((dir, row) => {
    sc.drawImage(makePersonSprite(look.skin, look.shirt, look.pants, look.hair, dir, false), 0, row * 24);
    sc.drawImage(makePersonSprite(look.skin, look.shirt, look.pants, look.hair, dir, true), 20, row * 24);
  });
  return c;
}

// --- registration --------------------------------------------------------------

/** Roof/wall look for a building id, with a safe default. */
export function warmBuildingLook(id: string): { roof: RoofKind; wall: WallKind } {
  return WARM_BUILDING_LOOK[id] ?? { roof: "red", wall: "cream" };
}

/**
 * Generates and registers every Warm Dusk texture on the scene's texture
 * manager. Safe to call once per game boot; existing keys are skipped.
 */
export function registerWarmDusk(scene: Phaser.Scene, buildings: BuildingSpec[]): void {
  const tex = scene.textures;
  const add = (key: string, canvas: HTMLCanvasElement) => {
    if (!tex.exists(key)) tex.addCanvas(key, canvas);
  };

  const grass = makeGrassTiles();
  grass.forEach((g, i) => add(`wd_grass${i}`, g));
  add("wd_dirt", makeDirtTile());
  add("wd_plaza", makePlazaTile());
  add("wd_water", makeWaterTile());
  for (let m = 0; m < 16; m++) add(`wd_foam_${m}`, makeFoamTile(m));
  add("wd_transDirt", makeTransition("d"));
  add("wd_transPlaza", makeTransition("p"));
  add("wd_shadow", makeShadow());
  add("wd_tree_g", makeTreeSprite("g"));
  add("wd_tree_o", makeTreeSprite("o"));
  add("wd_bush", makeBushSprite());
  FLOWER_COLORS.forEach((col) => add(`wd_flower_${col.slice(1)}`, makeFlowerSprite(col)));
  add("wd_lamp", makeLampSprite());
  add("wd_well", makeWellSprite());
  add("wd_door", makeDoorSprite());

  for (const b of buildings) {
    const look = warmBuildingLook(b.id);
    add(`wd_bldg_${b.id}`, makeBuildingSprite(b.w * T, b.h * T, look.roof, look.wall));
  }

  for (const [charKey, look] of Object.entries(WARM_CHAR_LOOK)) {
    const key = `char-${charKey}`;
    if (tex.exists(key)) continue;
    const sheet = makePersonSheet(look);
    const texture = tex.addCanvas(key, sheet);
    if (texture) {
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 2; col++) {
          texture.add(row * 2 + col, 0, col * 20, row * 24, 20, 24);
        }
      }
    }
  }
}
