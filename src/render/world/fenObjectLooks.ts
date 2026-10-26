import { Container, type Sprite } from 'pixi.js';
import { TILE_CELLS as T, type Grid } from '../../sim';
import type { WorldObject } from '../../sim/world/objects';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { smoothstep } from '../mathx';
import { ATMO } from '../terrain/regionLook';
import { Look, type Frame } from './objectLooks';
import { TimerRing } from './timerRing';
import { OBJ as C, OBJ_FEEL as F } from './worldPalette';

/**
 * Looks of the M8 puzzle objects: the sealed conduit switch (`Q`) and the wind vane (`Y`).
 */
const TAU = Math.PI * 2;

/** Wind on a tile's touching cells: 1 for a gust, 0.5 for room wind, 0 for none (DESIGN §6.6). */
export function windOnTile(grid: Grid | undefined, tx: number, ty: number): number {
  if (!grid) return 0;
  const room = grid.wind !== 0 ? 0.5 : 0;
  const x0 = Math.max(0, tx * T - 1);
  const y0 = Math.max(0, ty * T - 1);
  const x1 = Math.min(grid.width - 1, tx * T + T);
  const y1 = Math.min(grid.height - 1, ty * T + T);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) if (grid.gustTimer[y * grid.width + x]! > 0) return 1;
  return room;
}

export class SealedSwitchLook extends Look {
  private readonly crystal: Sprite;
  private readonly glow: Sprite;
  private readonly back: Sprite;
  private readonly ring: TimerRing;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.add('sealed_base');
    this.back = this.add('sealed_dome_back');
    this.glow = this.add('glow', 0, -1.9);
    this.glow.blendMode = 'add';
    this.crystal = this.add('switch_crystal', 0, -1.55);
    this.add('sealed_dome_front');
    this.add('sealed_collar');
    this.ring = new TimerRing(this.root, -1.9);
    this.root.scale.set(1.25);
  }
  protected pose(o: WorldObject, f: Frame): void {
    const on = smoothstep(0, 1, this.k);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * TAU * F.switchHz);
    // Unpowered: a dead grey crystal behind cold glass. Powered: lit, the glass glows violet.
    this.crystal.tint = mixRgb(C.crystalOff, C.crystalOn, on);
    this.crystal.position.y = -1.55 - 0.15 * on + Math.sin(f.t * 2) * 0.06 * on;
    this.back.tint = mixRgb(0xffffff, ELEMENT.stormGlow, on * 0.8);
    this.back.alpha = 1 + on * 0.6;
    this.glow.tint = ELEMENT.storm;
    this.glow.alpha = on * (0.5 + 0.3 * pulse);
    this.glow.scale.set(1.3 + pulse * 0.3);
    this.ring.update(o, f.t);
    // Arcs stay inside the glass.
    if (o.on && Math.random() < 5 * f.dt) {
      const p = f.fx.one(
        f.fx.add,
        Math.random() < 0.5 ? f.fx.t.zapA : f.fx.t.zapB,
        this.x + rand(-0.5, 0.5),
        this.y - 2.3 + rand(-0.5, 0.5),
        0.08,
        ELEMENT.storm,
        0.4,
        0.35,
      );
      if (p) p.rotation = rand(0, TAU);
    }
  }
}

export class VaneLook extends Look {
  private readonly rotor: Container;
  private readonly spinner: Sprite;
  private readonly glow: Sprite;
  private angle = 0;
  private spin = 0;
  private wasOn: boolean;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.glow = this.add('glow', 0, 1.0);
    this.glow.blendMode = 'add';
    this.glow.tint = ATMO.gale;
    this.add('vane_post');
    this.rotor = new Container();
    this.rotor.position.set(0, -3.0);
    this.rotor.scale.set(0.95, 0.5);
    this.root.addChild(this.rotor);
    this.spinner = this.add('vane_rotor', 0, 0, this.rotor);
    this.root.scale.set(1.25);
    this.wasOn = o.on;
  }
  protected pose(o: WorldObject, f: Frame): void {
    // Spins while wind touches it (DESIGN §6.6); once spun it keeps turning slowly.
    const wind = windOnTile(f.grid, o.tx, o.ty);
    const target = wind > 0 ? 6 + 8 * wind : o.on ? 1.6 : 0;
    this.spin += (target - this.spin) * (1 - Math.exp(-f.dt / (target > this.spin ? 0.25 : 1.2)));
    this.angle += this.spin * f.dt;
    this.spinner.rotation = this.angle;
    const spun = smoothstep(0, 1, this.k);
    this.spinner.tint = mixRgb(C.brass, 0xfff4c8, spun * (0.5 + 0.5 * Math.sin(f.t * 3)));
    this.glow.alpha = spun * 0.4;
    this.glow.scale.set(2.2, 1.1);
    if (o.on && !this.wasOn) {
      // The latch: a gust of pale streaks and a ring.
      f.fx.one(f.fx.top, f.fx.t.ring, this.x, this.y - 3, 0.35, ATMO.gale, 0.8, 3.5, 0.9);
      f.fx.burst(
        f.fx.add,
        f.fx.t.spark,
        this.x,
        this.y - 3,
        8,
        [6, 12],
        [0.25, 0.45],
        [ATMO.gale, 0xffffff],
        [0.7, 0.3],
        0.5,
        (p) => {
          p.align = true;
          p.stretch = 0.04;
          p.drag = 3;
        },
      );
    }
    this.wasOn = o.on;
  }
}
