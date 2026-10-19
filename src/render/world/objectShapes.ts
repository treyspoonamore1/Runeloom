import type { AtlasEntry } from '../atlas';
import { INK } from '../combatPalette';
import { PAL } from '../palette';
import type { Pen } from '../pen';
import { OBJ as C } from './worldPalette';

/**
 * Baked puzzle objects and pickups (CONTENT §6.1). Anchor (0, 0) is the tile center; a tile spans
 * -2..2 cells. Raised objects use the walls' 3/4 look: a light top face and a darker front face on
 * the south side. White parts are tinted per state.
 */
const O = 0.32;
const W = 0xffffff;

// ---- Doors: a stone frame and two leaves that slide into the posts -------------------------

function doorFrame(p: Pen): void {
  for (const x of [-2, 1.5]) {
    p.rect(x, -2, 0.5, 2.5).fill(PAL.wallTop);
    p.rect(x, 0.5, 0.5, 1.5).fill(PAL.wallFront);
    p.rect(x, -2, 0.5, 4).stroke(O * 0.8, INK);
  }
  p.rect(-2, -2, 4, 0.5)
    .fill(PAL.wallTopLight)
    .stroke(O * 0.8, INK);
  // Threshold step, seen when open.
  p.rect(-1.5, 1.45, 3, 0.55).fill(C.stoneLight).stroke(0.12, INK);
}

/** One leaf, hinge at x = 0, spanning to x = 1.52 (the door's middle): wood top and front. */
function leaf(p: Pen, top: number, front: number, band: number, ornate: boolean): void {
  p.rect(0, -1.5, 1.52, 2.0).fill(top);
  for (const x of [0.5, 1.0]) p.moveTo(x, -1.45).lineTo(x, 0.45).stroke(0.08, front);
  p.rect(0, 0.5, 1.52, 1.45).fill(front);
  p.moveTo(0, 0.5).lineTo(1.52, 0.5).stroke(0.1, INK);
  p.rect(0, 0.75, 1.52, 0.22).fill(band);
  p.rect(0, 1.5, 1.52, 0.22).fill(band);
  if (ornate) {
    p.moveTo(0.2, -1.3).quad(0.75, -0.6, 0.2, 0.2).stroke(0.12, C.gold);
    p.moveTo(1.3, -1.3).quad(0.75, -0.6, 1.3, 0.2).stroke(0.12, C.gold);
    p.circle(0.75, -0.55, 0.16).fill(C.gold);
  } else {
    p.circle(1.25, 1.2, 0.14).fill(C.brass).stroke(0.06, INK);
  }
  p.rect(0, -1.5, 1.52, 3.45).stroke(O * 0.7, INK);
}

function lockSmall(p: Pen): void {
  p.roundRect(-0.42, -0.5, 0.84, 1.0, 0.18).fill(C.brass).stroke(0.12, INK);
  p.circle(0, -0.08, 0.15).fill(INK);
  p.poly([-0.08, -0.02, 0.08, -0.02, 0.12, 0.3, -0.12, 0.3]).fill(INK);
}

function lockBig(p: Pen): void {
  p.circle(0, 0, 0.95).fill(C.goldDark).stroke(0.14, INK);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.circle(Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0.18)
      .fill(C.gold)
      .stroke(0.06, INK);
  }
  p.circle(0, 0, 0.68).fill(C.gold).stroke(0.08, INK);
  p.circle(0, -0.32, 0.17).fill(C.gem).stroke(0.06, INK);
  p.circle(0, 0.05, 0.16).fill(INK);
  p.poly([-0.09, 0.1, 0.09, 0.1, 0.14, 0.45, -0.14, 0.45]).fill(INK);
}

// ---- Chests ---------------------------------------------------------------------------------

function chestBase(p: Pen, body: number, dark: number, trim: number): void {
  p.ellipse(0.25, 1.55, 1.8, 0.45).fill({ color: PAL.shadow, alpha: 0.25 });
  p.roundRect(-1.5, -0.35, 3, 1.85, 0.2)
    .fill(body)
    .stroke(O * 0.8, INK);
  p.rect(-1.5, 0.95, 3, 0.55).fill(dark);
  for (const x of [-1.05, 0.85]) p.rect(x, -0.35, 0.2, 1.85).fill(trim);
  p.roundRect(-1.5, -0.35, 3, 1.85, 0.2).stroke(O * 0.8, INK);
}

function chestLid(p: Pen, body: number, dark: number, trim: number): void {
  p.moveTo(-1.6, -0.25).lineTo(-1.6, -0.9).quad(0, -1.85, 1.6, -0.9).lineTo(1.6, -0.25).close().fill(body);
  p.moveTo(-1.6, -0.55).quad(0, -1.4, 1.6, -0.55).stroke(0.12, dark);
  for (const x of [-1.05, 0.85]) p.rect(x, -1.5, 0.2, 1.25).fill(trim);
  p.moveTo(-1.6, -0.25)
    .lineTo(-1.6, -0.9)
    .quad(0, -1.85, 1.6, -0.9)
    .lineTo(1.6, -0.25)
    .close()
    .stroke(O * 0.8, INK);
  p.roundRect(-0.25, -0.55, 0.5, 0.55, 0.1).fill(C.brass).stroke(0.08, INK);
}

/** The open lid, swung up behind, inner side showing; the gold glints inside. */
function chestOpen(p: Pen, body: number, dark: number, trim: number): void {
  p.moveTo(-1.6, -0.35).lineTo(-1.5, -1.9).quad(0, -2.5, 1.5, -1.9).lineTo(1.6, -0.35).close().fill(dark);
  p.moveTo(-1.45, -1.75).quad(0, -2.3, 1.45, -1.75).stroke(0.14, body);
  for (const x of [-1.05, 0.85]) p.rect(x, -2.2, 0.2, 1.8).fill(trim);
  p.moveTo(-1.6, -0.35)
    .lineTo(-1.5, -1.9)
    .quad(0, -2.5, 1.5, -1.9)
    .lineTo(1.6, -0.35)
    .close()
    .stroke(O * 0.8, INK);
  p.rect(-1.35, -0.4, 2.7, 0.55).fill(0x2a1c1f);
  for (const [x, r] of [
    [-0.6, 0.2],
    [0.1, 0.25],
    [0.7, 0.18],
  ] as const)
    p.circle(x, -0.15, r).fill(C.gold);
}

// ---- Blocks -----------------------------------------------------------------------------------

function pushBlock(p: Pen): void {
  p.rect(-1.45, -1.3, 3.4, 3.4).fill({ color: PAL.shadow, alpha: 0.25 });
  p.rect(-1.7, -1.7, 3.4, 2.45).fill(C.stone);
  p.rect(-1.7, 0.75, 3.4, 0.95).fill(C.stoneDark);
  p.rect(-1.7, -1.7, 3.4, 0.3).fill(C.stoneLight);
  // Carved push arrows on the top face.
  for (const [x, y, a] of [
    [0, -1.15, -Math.PI / 2],
    [0, 0.25, Math.PI / 2],
    [-1.15, -0.45, Math.PI],
    [1.15, -0.45, 0],
  ] as const) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    p.poly([
      x + c * 0.3,
      y + s * 0.3,
      x - c * 0.15 - s * 0.25,
      y - s * 0.15 + c * 0.25,
      x - c * 0.15 + s * 0.25,
      y - s * 0.15 - c * 0.25,
    ]);
    p.fill(C.stoneDark);
  }
  p.circle(0, -0.45, 0.32).stroke(0.1, C.stoneDark);
  p.moveTo(-1.7, 0.75).lineTo(1.7, 0.75).stroke(0.12, INK);
  p.rect(-1.7, -1.7, 3.4, 3.4).stroke(O, INK);
}

function iceBlock(p: Pen): void {
  p.rect(-1.45, -1.3, 3.4, 3.4).fill({ color: PAL.shadow, alpha: 0.18 });
  p.rect(-1.7, -1.7, 3.4, 2.45).fill(C.ice);
  p.rect(-1.7, 0.75, 3.4, 0.95).fill(C.iceDeep);
  p.rect(-1.4, -1.4, 2.8, 1.85).stroke(0.14, C.iceShade);
  p.poly([-1.2, -1.5, -0.6, -1.5, -1.5, -0.4, -1.5, -0.95]).fill({ color: W, alpha: 0.8 });
  p.poly([0.2, -1.55, 0.55, -1.55, -0.6, 0.6, -0.95, 0.6]).fill({ color: W, alpha: 0.45 });
  p.moveTo(0.6, -0.9).lineTo(1.1, -0.3).lineTo(0.9, 0.3).stroke(0.08, C.iceDeep, 0.8);
  p.moveTo(-1.7, 0.75).lineTo(1.7, 0.75).stroke(0.1, C.iceDeep);
  p.rect(-1.7, -1.7, 3.4, 3.4).stroke(O, INK);
}

// ---- Switch and plate -------------------------------------------------------------------------

function switchBase(p: Pen): void {
  p.ellipse(0.2, 1.2, 1.6, 0.55).fill({ color: PAL.shadow, alpha: 0.25 });
  p.ellipse(0, 1.0, 1.4, 0.6)
    .fill(C.metalDark)
    .stroke(O * 0.7, INK);
  p.roundRect(-0.55, -1.2, 1.1, 2.3, 0.3)
    .fill(C.metal)
    .stroke(O * 0.7, INK);
  for (const y of [-0.6, 0, 0.6])
    p.moveTo(-0.55, y)
      .quad(0, y + 0.25, 0.55, y)
      .stroke(0.14, C.brass);
  p.moveTo(-0.3, -1.1).lineTo(-0.3, 0.9).stroke(0.08, 0xc8d0da);
}

function switchCrystal(p: Pen): void {
  p.poly([0, -1.1, 0.5, -0.35, 0, 0.35, -0.5, -0.35]).fill(W).stroke(0.12, INK);
  p.poly([0, -1.1, 0.5, -0.35, 0, -0.2]).fill({ color: 0x000000, alpha: 0.12 });
  p.moveTo(-0.15, -0.75).lineTo(-0.3, -0.4).stroke(0.08, W);
}

function plate(p: Pen, pressed: boolean): void {
  const lip = pressed ? 0.12 : 0.35;
  p.roundRect(-1.75, -1.75, 3.5, 3.5, 0.3)
    .fill(C.plateDark)
    .stroke(O * 0.7, INK);
  p.roundRect(-1.45, -1.45 + (pressed ? 0.18 : 0), 2.9, 2.9 - lip, 0.25).fill(
    pressed ? C.plateDark : C.plate,
  );
  if (!pressed) p.rect(-1.45, 1.45 - lip, 2.9, lip).fill(0x857868);
  const cy = pressed ? 0.1 : -0.1;
  p.circle(0, cy, 0.85).stroke(0.12, pressed ? W : 0x857868);
  p.poly([0, cy - 0.55, 0.32, cy, 0, cy + 0.55, -0.32, cy]).stroke(0.1, pressed ? W : 0x857868);
  if (pressed) p.moveTo(-1.4, -1.25).lineTo(1.4, -1.25).stroke(0.18, INK, 0.5);
}

// ---- Pickups ----------------------------------------------------------------------------------

function heartSeed(p: Pen): void {
  p.moveTo(0, 1.0).bez(-1.4, 0.0, -1.1, -1.2, 0, -0.55).bez(1.1, -1.2, 1.4, 0.0, 0, 1.0).close();
  p.fill(C.heart).stroke(0.18, INK);
  p.ellipse(-0.45, -0.45, 0.25, 0.16).fill(C.heartLight);
  p.moveTo(0, -0.55).quad(0.15, -1.0, 0.5, -1.15).stroke(0.12, 0x4e9a38);
  p.moveTo(0.5, -1.15)
    .quad(0.95, -1.3, 0.9, -0.9)
    .quad(0.6, -0.85, 0.5, -1.15)
    .close()
    .fill(0x8ad65e)
    .stroke(0.08, INK);
}

function loomShard(p: Pen): void {
  p.poly([0, -1.3, 0.62, -0.3, 0.38, 0.95, -0.38, 0.95, -0.62, -0.3]).fill(C.shard).stroke(0.16, INK);
  p.poly([0, -1.3, 0.62, -0.3, 0.1, -0.15]).fill(C.shardLight);
  p.poly([-0.38, 0.95, 0.38, 0.95, 0.1, -0.15, -0.62, -0.3]).fill({ color: C.shardDark, alpha: 0.5 });
  p.moveTo(-0.62, -0.05).bez(-0.1, 0.35, 0.2, -0.45, 0.6, 0.0).stroke(0.14, C.thread);
  p.moveTo(-0.5, 0.45).bez(-0.1, 0.8, 0.2, 0.1, 0.48, 0.5).stroke(0.12, C.thread);
}

// ---- Loom Stone: a standing stone, the region's waypoint -------------------------------------

function loomStone(p: Pen): void {
  p.ellipse(0, 1.3, 2.1, 0.85)
    .fill(C.loomStoneDark)
    .stroke(O * 0.7, INK);
  p.ellipse(0, 1.2, 1.7, 0.6).fill(C.stoneLight);
  p.moveTo(-0.95, 1.2)
    .lineTo(-1.1, -2.6)
    .quad(0, -4.0, 1.1, -2.6)
    .lineTo(0.95, 1.2)
    .quad(0, 1.55, -0.95, 1.2)
    .close();
  p.fill(C.loomStone);
  p.moveTo(0.3, 1.4)
    .quad(0.95, 1.2, 0.95, 1.2)
    .lineTo(1.1, -2.6)
    .quad(0.8, -3.4, 0.35, -3.6)
    .quad(0.75, -1.0, 0.3, 1.4)
    .close();
  p.fill(C.loomStoneDark);
  p.moveTo(-0.95, 1.2)
    .lineTo(-1.1, -2.6)
    .quad(0, -4.0, 1.1, -2.6)
    .lineTo(0.95, 1.2)
    .quad(0, 1.55, -0.95, 1.2)
    .close();
  p.stroke(O, INK);
  p.moveTo(-0.7, -2.7).quad(-0.4, -3.3, 0.1, -3.4).stroke(0.14, 0xe6e2f0);
}

/** The rune carved on the stone's face (white; tinted dull or gold). */
function loomRune(p: Pen): void {
  p.circle(0, 0, 0.62).stroke(0.14, W);
  p.poly([0, -0.95, 0.22, -0.22, 0.95, 0, 0.22, 0.22, 0, 0.95, -0.22, 0.22, -0.95, 0, -0.22, -0.22]).fill(W);
}

/** A runic circle on the ground around an active stone. */
function loomRing(p: Pen): void {
  p.circle(0, 0, 1).stroke(0.05, W);
  p.circle(0, 0, 0.86).stroke(0.025, W);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.circle(Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0.035).fill(W);
  }
}

function e(name: string, x0: number, y0: number, x1: number, y1: number, draw: (p: Pen) => void): AtlasEntry {
  return { name, x0, y0, x1, y1, draw };
}

export function objectAtlasEntries(): AtlasEntry[] {
  return [
    e('door_frame', -2.3, -2.3, 2.3, 2.3, doorFrame),
    e('door_leaf', -0.3, -1.8, 1.8, 2.25, (p) => leaf(p, C.woodLight, C.wood, C.iron, false)),
    e('door_leaf_iron', -0.3, -1.8, 1.8, 2.25, (p) => leaf(p, C.wood, C.woodDark, C.ironLight, false)),
    e('door_leaf_big', -0.3, -1.8, 1.8, 2.25, (p) => leaf(p, C.bigWood, C.bigWoodDark, C.goldDark, true)),
    e('lock_small', -0.6, -0.7, 0.6, 0.7, lockSmall),
    e('lock_big', -1.25, -1.25, 1.25, 1.25, lockBig),
    e('chest_base', -1.85, -0.6, 2.15, 2.1, (p) => chestBase(p, C.chest, C.chestDark, C.brass)),
    e('chest_lid', -1.85, -2.05, 1.85, 0.0, (p) => chestLid(p, C.chest, C.chestDark, C.brass)),
    e('chest_open', -1.85, -2.75, 1.85, 0.3, (p) => chestOpen(p, C.chest, C.chestDark, C.brass)),
    e('bigchest_base', -1.85, -0.6, 2.15, 2.1, (p) => chestBase(p, C.bigWood, C.bigWoodDark, C.gold)),
    e('bigchest_lid', -1.85, -2.05, 1.85, 0.0, (p) => chestLid(p, C.bigWood, C.bigWoodDark, C.gold)),
    e('bigchest_open', -1.85, -2.75, 1.85, 0.3, (p) => chestOpen(p, C.bigWood, C.bigWoodDark, C.gold)),
    e('push_block', -2.0, -2.0, 2.2, 2.3, pushBlock),
    e('ice_block_obj', -2.0, -2.0, 2.2, 2.3, iceBlock),
    e('switch_base', -1.7, -1.5, 1.9, 1.9, switchBase),
    e('switch_crystal', -0.7, -1.3, 0.7, 0.55, switchCrystal),
    e('plate_up', -2.0, -2.0, 2.0, 2.0, (p) => plate(p, false)),
    e('plate_down', -2.0, -2.0, 2.0, 2.0, (p) => plate(p, true)),
    e('heart_seed', -1.35, -1.5, 1.35, 1.25, heartSeed),
    e('loom_shard', -0.85, -1.55, 0.85, 1.2, loomShard),
    e('loom_stone_obj', -2.3, -4.2, 2.3, 2.4, loomStone),
    e('loom_rune', -1.05, -1.05, 1.05, 1.05, loomRune),
    e('loom_ring', -1.1, -1.1, 1.1, 1.1, loomRing),
  ];
}
