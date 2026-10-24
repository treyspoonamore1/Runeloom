import type { GraphicsContext } from 'pixi.js';
import type { BuildingId } from '../../../data/hearth';
import { INK } from '../combatPalette';
import type { Pen } from '../pen';
import { HUB } from './hubPalette';
import { block, ctx, groundShadow, O, pad, plot, post } from './hubShapes';

/**
 * The four Hearth buildings in four stages each (stage 0 is the empty plot). Units are cells
 * around the center of the 3×2 tile footprint (x −6..6, y −4..4); art rises north over the wall.
 * `BUILDING_SPOTS` says where the view puts the animated parts of each stage.
 */
export type Stage = 0 | 1 | 2 | 3 | 4;

export interface BuildingSpots {
  /** Top of the art (cells), for the station prompt. */
  top: number;
  /** Kindling Pit: the fire. */
  flame?: { x: number; y: number };
  /** Expedition Board: where the expedition markers pin. */
  pins?: ReadonlyArray<{ x: number; y: number }>;
  /** Salvage Loom: the shuttle's track. */
  shuttle?: { x0: number; x1: number; y: number };
}

// ---- Kindling Pit: a fire ring that grows into a brick kiln -----------------------------------

function logs(p: Pen, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) {
    const lx = x + (i % 3) * 0.95 - 0.95 + (i >= 3 ? 0.5 : 0);
    const ly = y - (i >= 3 ? 0.75 : 0);
    p.roundRect(lx - 0.45, ly - 0.38, 0.9, 0.76, 0.35).fill(HUB.wood).stroke(0.16, INK);
    p.circle(lx, ly, 0.2).fill(HUB.woodLight);
  }
}

function spoolRack(p: Pen, x: number): void {
  post(p, x - 0.9, -2.2, 2.4, 0.35, HUB.woodDark);
  post(p, x + 0.9, -2.2, 2.4, 0.35, HUB.woodDark);
  for (const [y, col] of [
    [-1.4, 0xc9b9a6],
    [-0.2, 0xe8dcc8],
    [1.0, 0xc9b9a6],
  ] as const)
    p.roundRect(x - 0.75, y - 0.4, 1.5, 0.8, 0.15).fill(col).stroke(0.12, INK);
}

function kindling(p: Pen, stage: Stage): void {
  groundShadow(p, 5);
  if (stage >= 2) pad(p);
  if (stage <= 2) {
    const r = stage === 1 ? 2.4 : 2.9;
    p.ellipse(0, 1.0, r, r * 0.6).fill(HUB.coal).stroke(O, INK);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      p.circle(Math.cos(a) * r, 1.0 + Math.sin(a) * r * 0.6, 0.5).fill(HUB.stone).stroke(0.18, INK);
    }
    logs(p, -4.0, 2.2, stage === 1 ? 3 : 5);
    if (stage === 2) spoolRack(p, 4.1);
    return;
  }
  const w = stage === 3 ? 3.6 : 4.8;
  // Chimneys first (behind), then the kiln body with its arched mouth.
  for (const cx of stage === 3 ? [2.0] : [-3.0, 3.0]) {
    block(p, cx - 0.9, -10.5, 1.8, 7.5, 0.6, HUB.brick, HUB.brickDark);
    p.rect(cx - 1.1, -10.9, 2.2, 0.7).fill(HUB.stoneDark).stroke(0.2, INK);
  }
  block(p, -w, -5.2, w * 2, 8.6, 3.2, HUB.brick, HUB.brickDark);
  for (let y = -4.4; y < 0; y += 1.2)
    for (let x = -w + 0.6 + ((y * 10) % 2 ? 0.6 : 0); x < w - 0.6; x += 1.6)
      p.rect(x, y, 1.1, 0.5).fill({ color: HUB.brickDark, alpha: 0.35 });
  p.moveTo(-1.6, 3.4).lineTo(-1.6, 1.6).quad(0, -0.4, 1.6, 1.6).lineTo(1.6, 3.4).close().fill(HUB.coal).stroke(O, INK);
  if (stage === 4) {
    p.rect(-w, -1.3, w * 2, 0.45).fill(HUB.gold).stroke(0.12, INK);
    p.poly([w - 0.3, -5.2, w + 0.9, -4.6, w - 0.3, -3.9]).fill(0xff7a2f).stroke(0.12, INK);
  }
  logs(p, -w - 0.6, 3.2, 3);
  spoolRack(p, w + 0.6);
}

// ---- Rune Garden: a tilled bed that becomes a walled garden -----------------------------------

/** Sockets for planted runes, two rows of three (data/hearth.ts runeGarden.maxPlots is 6). */
export const GARDEN_SOCKETS: ReadonlyArray<{ x: number; y: number }> = [
  { x: -3.0, y: -1.0 },
  { x: 0, y: -1.0 },
  { x: 3.0, y: -1.0 },
  { x: -3.0, y: 1.7 },
  { x: 0, y: 1.7 },
  { x: 3.0, y: 1.7 },
];

function garden(p: Pen, stage: Stage): void {
  if (stage === 4) {
    // A stone arch over the back of the bed, a gold rune keystone.
    for (const x of [-4.6, 3.4]) block(p, x, -9.5, 1.2, 7.4, 0.5, HUB.stone, HUB.stoneDark);
    p.moveTo(-4.6, -8.6).quad(0, -12.4, 4.6, -8.6).stroke(1.3, INK).moveTo(-4.6, -8.6).quad(0, -12.4, 4.6, -8.6).stroke(0.85, HUB.stone);
    p.circle(0, -10.6, 0.7).fill(HUB.gold).stroke(0.16, INK);
  }
  if (stage >= 3) {
    // A low fence on the back and sides, and a lantern post.
    for (let x = -5.2; x <= 5.21; x += 1.3) post(p, x, -3.9, -2.4, 0.32, HUB.woodLight);
    p.moveTo(-5.2, -3.4).lineTo(5.2, -3.4).stroke(0.24, HUB.wood);
    post(p, 5.3, -6.4, 2.6, 0.4, HUB.woodDark);
    p.roundRect(4.7, -7.4, 1.2, 1.3, 0.3).fill(HUB.gold).stroke(0.14, INK);
  }
  const w = stage === 1 ? 4.0 : 4.9;
  const h = stage === 1 ? 2.6 : 3.2;
  p.roundRect(-w, -h + 0.3, w * 2, h * 2, 0.9).fill(HUB.soil).stroke(O, INK);
  for (let y = -h + 1.0; y < h; y += 0.9) p.moveTo(-w + 0.5, y).lineTo(w - 0.5, y).stroke(0.12, HUB.soilDark);
  if (stage >= 2) {
    p.roundRect(-w, -h + 0.3, w * 2, h * 2, 0.9).stroke(0.7, HUB.stone);
    p.roundRect(-w - 0.35, -h - 0.05, w * 2 + 0.7, h * 2 + 0.7, 1.1).stroke(0.12, INK);
  }
  if (stage === 4)
    for (const [x, y, c] of [
      [-5.6, 3.2, 0xffb3c6],
      [-5.1, 3.8, 0xfff2a0],
      [5.5, 3.4, 0xffb3c6],
    ] as const)
      p.circle(x, y, 0.4).fill(c).stroke(0.1, INK);
}

// ---- Expedition Board: a notice post that becomes a roofed board -----------------------------

function board(p: Pen, stage: Stage): void {
  groundShadow(p, 4.5);
  if (stage >= 2) pad(p, 5, 3);
  if (stage === 1) {
    post(p, 0, -5, 3, 0.7);
    p.rect(-1.6, -5.6, 3.2, 3.0).fill(HUB.woodLight).stroke(O, INK);
    return;
  }
  const w = stage === 4 ? 4.8 : 3.6;
  for (const x of [-w + 0.7, w - 0.7]) post(p, x, -6, 3, 0.7);
  if (stage >= 3) {
    p.poly([-w - 1, -7.2, 0, -10.2, w + 1, -7.2]).fill(HUB.roof).stroke(O, INK);
    p.poly([-w - 1, -7.2, 0, -10.2, 0, -9.2, -w, -7.2]).fill(HUB.roofLight);
    if (stage === 4) p.moveTo(-w - 1, -7.2).lineTo(0, -10.2).lineTo(w + 1, -7.2).stroke(0.24, HUB.gold);
  }
  block(p, -w, -7, w * 2, 5.4, 0.6, HUB.woodLight, HUB.wood);
  p.rect(-w + 0.5, -6.5, w * 2 - 1, 4.0).fill(0xc9a070);
  if (stage === 4) {
    // A pinned map and a pennant.
    p.rect(-w + 0.8, -6.2, 2.4, 1.8).fill(HUB.cloth).stroke(0.1, INK);
    p.moveTo(-w + 1.2, -5.8).quad(-w + 2, -4.6, -w + 2.8, -5.6).stroke(0.1, 0xb04a3a);
    post(p, w + 1.3, -9, 3, 0.3, HUB.woodDark);
    p.poly([w + 1.45, -9, w + 3.4, -8.2, w + 1.45, -7.4]).fill(0x4e64b8).stroke(0.12, INK);
  }
  if (stage >= 3) {
    block(p, -w - 1.9, 0.6, 1.8, 2.2, 0.7, HUB.wood, HUB.woodDark);
  }
}

// ---- Salvage Loom: a frame loom that grows a canopy -----------------------------------------

function loom(p: Pen, stage: Stage): void {
  groundShadow(p, 4.8);
  if (stage >= 2) pad(p);
  const w = stage <= 2 ? 2.6 : 3.6;
  const top = stage <= 2 ? -4.5 : -6.5;
  if (stage === 4) {
    for (const x of [-w - 1.1, w + 1.1]) post(p, x, top - 2.4, 3.2, 0.5, HUB.woodDark);
    p.roundRect(-w - 1.7, top - 3.4, (w + 1.7) * 2, 1.4, 0.4).fill(0x6b4a8e).stroke(O, INK);
    for (let x = -w - 1.2; x < w + 1.4; x += 1.4) p.circle(x, top - 2.0, 0.35).fill(0x6b4a8e).stroke(0.1, INK);
    for (const x of [-w - 1.7, w + 1.7]) p.circle(x, top - 3.6, 0.45).fill(HUB.gold).stroke(0.12, INK);
  }
  for (const x of [-w, w]) post(p, x, top, 2.8, 0.6);
  p.rect(-w - 0.4, top - 0.2, w * 2 + 0.8, 0.8).fill(HUB.woodLight).stroke(O * 0.8, INK);
  p.rect(-w + 0.3, 1.0, w * 2 - 0.6, 0.6).fill(HUB.wood).stroke(0.16, INK);
  // Warp threads, and the woven cloth growing at the bottom.
  for (let x = -w + 0.6; x <= w - 0.59; x += 0.45) p.moveTo(x, top + 0.6).lineTo(x, 1.0).stroke(0.07, HUB.cloth);
  p.rect(-w + 0.4, -0.6 - (stage - 1) * 0.5, w * 2 - 0.8, 1.6 + (stage - 1) * 0.5).fill(0x9fb4ff).stroke(0.1, INK);
  if (stage >= 2) block(p, w + 0.8, 0.2, 2.2, 2.6, 0.9, HUB.wood, HUB.woodDark);
  if (stage >= 3) for (const y of [0.6, 1.5, 2.4]) p.roundRect(-w - 2.6, y - 0.4, 1.6, 0.8, 0.2).fill(0xe8dcc8).stroke(0.12, INK);
  if (stage === 4) block(p, w + 0.8, -2.4, 2.2, 2.2, 0.8, HUB.wood, HUB.woodDark);
}

const DRAW: Readonly<Record<BuildingId, (p: Pen, stage: Stage) => void>> = {
  kindling_pit: kindling,
  rune_garden: garden,
  expedition_board: board,
  salvage_loom: loom,
};

const cache = new Map<string, GraphicsContext>();

/** The shape of a building at a stage (0: the empty plot). Built once per pair and shared. */
export function buildingShape(id: BuildingId, stage: Stage): GraphicsContext {
  const key = `${id}:${stage}`;
  let c = cache.get(key);
  if (!c) {
    c = stage === 0 ? plot(id) : ctx((p) => DRAW[id](p, stage));
    cache.set(key, c);
  }
  return c;
}

/** Where the animated parts of a building go at a stage. */
export function buildingSpots(id: BuildingId, stage: Stage): BuildingSpots {
  if (stage === 0) return { top: -3.6 };
  switch (id) {
    case 'kindling_pit':
      return stage <= 2 ? { top: -3, flame: { x: 0, y: 1.0 } } : { top: -11, flame: { x: 0, y: 2.6 } };
    case 'rune_garden':
      return { top: stage === 4 ? -11.3 : stage === 3 ? -7.5 : -3.5 };
    case 'expedition_board': {
      if (stage === 1) return { top: -5.6, pins: [{ x: -0.8, y: -4.4 }, { x: 0.8, y: -4.4 }, { x: 0, y: -3.4 }] };
      const w = stage === 4 ? 4.8 : 3.6;
      const x0 = stage === 4 ? -w + 4.2 : -w + 1.3;
      const dx = stage === 4 ? 1.8 : 2.4;
      return { top: stage >= 3 ? -10.2 : -7, pins: [0, 1, 2].map((i) => ({ x: x0 + i * dx, y: -4.8 })) };
    }
    case 'salvage_loom': {
      const w = stage <= 2 ? 2.6 : 3.6;
      const top = stage <= 2 ? -4.5 : -6.5;
      return { top: stage === 4 ? top - 4 : top - 0.4, shuttle: { x0: -w + 0.5, x1: w - 0.5, y: -1.2 - (stage - 1) * 0.5 } };
    }
  }
}
