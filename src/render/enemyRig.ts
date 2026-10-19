import { Container, Sprite } from 'pixi.js';
import type { EnemyKind } from '../../data/enemies';
import type { Atlas } from './atlas';
import { ENEMY as C } from './combatPalette';

/** Per-kind layout: shadow size, feet height (lift pivot), face offset scale. */
export const LAYOUT: Record<EnemyKind, { shadowRx: number; shadowRy: number; shadowY: number; foot: number }> = {
  tinderling: { shadowRx: 1.25, shadowRy: 0.55, shadowY: 0.75, foot: 0.85 },
  shieldbearer: { shadowRx: 2.5, shadowRy: 1.05, shadowY: 1.55, foot: 1.6 },
  ember_archer: { shadowRx: 1.45, shadowRy: 0.65, shadowY: 1.15, foot: 1.3 },
  dummy: { shadowRx: 1.6, shadowRy: 0.65, shadowY: 1.35, foot: 1.4 },
};

/** Tinderling flame tongues: x, y, scale. */
export const FLAME_POS = [
  [-0.55, -0.95, 0.75],
  [0.05, -1.2, 1],
  [0.55, -0.9, 0.7],
] as const;

/** The sprites of one enemy, built once per pooled view. */
export interface EnemyRig {
  flash: Sprite;
  face: Sprite | null;
  flames: Sprite[];
  legs: Sprite[];
  held: Container | null;
  heldFlash: Sprite | null;
  strings: Sprite[];
  arrow: Sprite | null;
  /** Shieldbearer: char marks over the shield. */
  scorch: Sprite | null;
}

/** Builds a kind's layered sprites into `root` (feet, legs) and `lift` (everything that bobs). */
export function buildRig(kind: EnemyKind, atlas: Atlas, root: Container, lift: Container): EnemyRig {
  const L = LAYOUT[kind];
  const sprite = (name: string) => new Sprite(atlas.get(name));
  const r: EnemyRig = {
    flash: sprite(`${kind}_flash`),
    face: null,
    flames: [],
    legs: [],
    held: null,
    heldFlash: null,
    strings: [],
    arrow: null,
    scorch: null,
  };
  lift.pivot.set(0, L.foot);
  lift.position.set(0, L.foot);
  if (kind === 'tinderling') {
    for (const [lx, ly] of [
      [-0.7, 0.7],
      [-0.3, 0.92],
      [0.3, 0.92],
      [0.7, 0.7],
    ] as const) {
      const leg = sprite('tinderling_leg');
      leg.position.set(lx, ly);
      r.legs.push(leg);
      root.addChild(leg);
    }
  } else if (kind === 'shieldbearer') {
    for (const lx of [-0.85, 0.85]) {
      const b = sprite('shieldbearer_boot');
      b.position.set(lx, 1.55);
      r.legs.push(b);
      root.addChild(b);
    }
  }
  root.addChild(lift);
  lift.addChild(sprite(`${kind}_body`));
  r.flash.alpha = 0;
  lift.addChild(r.flash);
  if (kind === 'tinderling') {
    r.face = sprite('tinderling_eyes');
    for (const [fx, fy, s] of FLAME_POS) {
      const f = sprite('tinderling_flame');
      f.position.set(fx, fy);
      f.scale.set(s);
      r.flames.push(f);
    }
    lift.addChild(r.face, ...r.flames);
  } else if (kind === 'shieldbearer') {
    r.face = sprite('shieldbearer_visor');
    lift.addChild(r.face);
    r.held = new Container();
    r.heldFlash = sprite('shieldbearer_shield_flash');
    r.heldFlash.alpha = 0;
    r.scorch = sprite('shield_scorch');
    r.scorch.alpha = 0;
    r.held.addChild(sprite('shieldbearer_shield'), r.scorch, r.heldFlash);
    r.held.position.set(0, -0.2);
    lift.addChild(r.held);
  } else if (kind === 'ember_archer') {
    r.face = sprite('ember_archer_face');
    lift.addChild(r.face);
    r.held = new Container();
    for (let i = 0; i < 2; i++) {
      const s = sprite('line');
      s.tint = C.ember_archer.string;
      r.strings.push(s);
    }
    r.arrow = sprite('ember_archer_arrow');
    r.held.addChild(r.strings[0]!, r.strings[1]!, r.arrow, sprite('ember_archer_bow'));
    lift.addChild(r.held);
  }
  return r;
}
