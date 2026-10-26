import { Container, Graphics, Sprite, type GraphicsContext } from 'pixi.js';
import { TILE_CELLS as T, type Grid } from '../../sim';
import type { WorldObject } from '../../sim/world/objects';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { ELEMENT } from '../combatPalette';
import { clamp, smoothstep } from '../mathx';
import { PAL } from '../palette';
import type { WorldFx } from './worldFx';
import { OBJ as C, OBJ_FEEL as F } from './worldPalette';
import { TimerRing } from './timerRing';

/** Per-kind looks of the puzzle objects and pickups (ObjectView owns one per object). */
const TAU = Math.PI * 2;

export interface Frame {
  t: number;
  dt: number;
  fx: WorldFx;
  /** The chemistry grid (M8 wind vanes read the wind on their tile). */
  grid?: Grid;
}

/** One object's sprites and state animation. */
export abstract class Look {
  readonly root = new Container();
  /** Displayed tile center (cells): blocks ease toward the sim's tile. */
  x = 0;
  y = 0;
  /** 0–1 progress of the on/off transition (doors, chests, plates). */
  k = 0;
  constructor(
    protected readonly atlas: Atlas,
    o: WorldObject,
  ) {
    this.x = (o.tx + 0.5) * T;
    this.y = (o.ty + 0.5) * T;
    this.k = o.on ? 1 : 0;
  }
  protected add(name: string, x = 0, y = 0, parent: Container = this.root): Sprite {
    const s = new Sprite(this.atlas.get(name));
    s.position.set(x, y);
    parent.addChild(s);
    return s;
  }
  update(o: WorldObject, f: Frame): void {
    this.x = (o.tx + 0.5) * T;
    this.y = (o.ty + 0.5) * T;
    this.root.position.set(this.x, this.y);
    this.k = clamp(this.k + ((o.on ? 1 : -1) * f.dt) / this.speed(), 0, 1);
    this.pose(o, f);
  }
  protected speed(): number {
    return 0.15;
  }
  protected abstract pose(o: WorldObject, f: Frame): void;
}

export class BrazierLook extends Look {
  private readonly glow: Sprite;
  private readonly flame: Graphics;
  private readonly seed = Math.random() * 10;
  constructor(atlas: Atlas, o: WorldObject, flameCtx: GraphicsContext) {
    super(atlas, o);
    this.glow = this.add('glow', 0, 0.1);
    this.glow.blendMode = 'add';
    this.glow.tint = PAL.flameOuter;
    this.flame = new Graphics(flameCtx);
    this.flame.position.set(0, 0.1);
    this.root.addChild(this.flame);
  }
  protected override speed(): number {
    return 0.22;
  }
  protected pose(o: WorldObject, f: Frame): void {
    const t = f.t + this.seed;
    const n = 0.6 * Math.sin(t * 9.1) + 0.4 * Math.sin(t * 23.7 + 1.3);
    const lit = smoothstep(0, 1, this.k);
    // Lighting overshoots a little (whoosh); going out shrinks to an ember.
    const pop = o.on ? 1 + 0.35 * Math.sin(Math.min(1, this.k) * Math.PI) : 1;
    this.flame.visible = lit > 0.02;
    this.flame.scale.set((1 - 0.07 * n) * lit * pop, (1 + 0.16 * n) * lit * pop);
    this.flame.rotation = 0.07 * Math.sin(t * 5.3);
    const r = 4.2 + 0.4 * n;
    this.glow.scale.set(r, r * 0.8);
    this.glow.alpha = (0.55 + 0.12 * n) * lit;
    if (!o.on && f.fx && Math.random() < 0.6 * f.dt) {
      const p = f.fx.one(
        f.fx.top,
        f.fx.t.puff,
        this.x + rand(-0.3, 0.3),
        this.y - 0.4,
        1.2,
        0x8a7f86,
        0.3,
        0.9,
        0.35,
      );
      if (p) p.vy = -2;
    }
  }
}

export class DoorLook extends Look {
  private readonly leaves: Sprite[];
  private readonly lock: Sprite | null;
  constructor(atlas: Atlas, o: WorldObject, vertical: boolean) {
    super(atlas, o);
    this.add('door_frame');
    const leaf =
      o.kind === 'big_key_door' ? 'door_leaf_big' : o.kind === 'locked_door' ? 'door_leaf_iron' : 'door_leaf';
    this.leaves = [this.add(leaf, -1.5, 0), this.add(leaf, 1.5, 0)];
    this.lock =
      o.kind === 'locked_door'
        ? this.add('lock_small', 0, 0.95)
        : o.kind === 'big_key_door'
          ? this.add('lock_big', 0, -0.4)
          : null;
    // A door in a north-south wall turns with it.
    if (vertical) this.root.rotation = Math.PI / 2;
  }
  protected override speed(): number {
    return F.doorOpen;
  }
  protected pose(): void {
    const u = smoothstep(0, 1, this.k);
    const s = 1 - u;
    this.leaves[0]!.scale.x = s;
    this.leaves[1]!.scale.x = -s;
    this.leaves[0]!.visible = this.leaves[1]!.visible = s > 0.01;
    if (this.lock) this.lock.visible = this.k < 0.05;
  }
}

export class ChestLook extends Look {
  private readonly lid: Sprite;
  private readonly open: Sprite;
  private readonly sparkle: Sprite;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    const big = o.kind === 'big_key_chest';
    const pre = big ? 'bigchest' : 'chest';
    this.sparkle = this.add('glow', 0, -0.5);
    this.sparkle.tint = C.gold;
    this.add(`${pre}_base`);
    this.open = this.add(`${pre}_open`);
    this.lid = this.add(`${pre}_lid`);
    if (big) this.root.scale.set(1.15);
  }
  protected override speed(): number {
    return F.chestOpen;
  }
  protected pose(_o: WorldObject, f: Frame): void {
    const open = this.k > 0.5;
    this.lid.visible = !open;
    this.open.visible = open;
    const bounce = Math.sin(clamp(this.k, 0, 1) * Math.PI) * 0.12;
    this.lid.scale.set(1 + bounce, 1 - bounce);
    this.sparkle.visible = !open;
    this.sparkle.alpha = 0.18 + 0.08 * Math.sin(f.t * 3);
    this.sparkle.scale.set(2.2);
  }
}

export class BlockLook extends Look {
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.add(o.kind === 'ice_block' ? 'ice_block_obj' : 'push_block');
  }
  override update(o: WorldObject, f: Frame): void {
    // Ease toward the sim's tile, at least as fast as the block moves.
    const tx = (o.tx + 0.5) * T;
    const ty = (o.ty + 0.5) * T;
    const max = Math.max(F.blockCatchUp, Math.hypot(o.vx, o.vy) * T * 1.2) * f.dt;
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) {
      this.x = tx;
      this.y = ty;
    } else if (d > 0) {
      const m = Math.min(1, max / d);
      this.x += dx * m;
      this.y += dy * m;
    }
    this.root.position.set(this.x, this.y);
    if (o.kind === 'ice_block' && d > 0.3 && Math.random() < 30 * f.dt) {
      const p = f.fx.one(
        f.fx.ground,
        f.fx.t.crystal,
        this.x - Math.sign(dx) * 2 + rand(-0.5, 0.5),
        this.y + 1.6 - Math.sign(dy) * 2,
        0.35,
        0xffffff,
        0.5,
        0.2,
        0.9,
      );
      if (p) p.spin = rand(-5, 5);
    }
  }
  protected pose(): void {}
}

export class SwitchLook extends Look {
  private readonly crystal: Sprite;
  private readonly glow: Sprite;
  private readonly ring: TimerRing;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.glow = this.add('glow', 0, -1.6);
    this.add('switch_base');
    this.crystal = this.add('switch_crystal', 0, -1.4);
    this.ring = new TimerRing(this.root, -1.6);
    this.root.scale.set(1.3);
  }
  protected pose(o: WorldObject, f: Frame): void {
    this.ring.update(o, f.t);
    const on = smoothstep(0, 1, this.k);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * TAU * F.switchHz);
    this.crystal.tint = mixRgb(C.crystalOff, C.crystalOn, on);
    this.crystal.position.y = -1.4 - 0.25 * on + Math.sin(f.t * 2) * 0.08 * on;
    this.glow.tint = ELEMENT.storm;
    this.glow.alpha = on * (0.55 + 0.3 * pulse);
    this.glow.scale.set(2.2 + pulse * 0.6);
    if (o.on && Math.random() < 6 * f.dt) {
      const p = f.fx.one(
        f.fx.add,
        Math.random() < 0.5 ? f.fx.t.zapA : f.fx.t.zapB,
        this.x + rand(-0.8, 0.8),
        this.y - 1.6 + rand(-0.6, 0.6),
        0.08,
        ELEMENT.storm,
        0.6,
        0.5,
      );
      if (p) p.rotation = rand(0, TAU);
    }
  }
}

export class PlateLook extends Look {
  private readonly up: Sprite;
  private readonly down: Sprite;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.up = this.add('plate_up');
    this.down = this.add('plate_down');
  }
  protected override speed(): number {
    return 0.08;
  }
  protected pose(_o: WorldObject, f: Frame): void {
    const down = this.k > 0.5;
    this.up.visible = !down;
    this.down.visible = down;
    this.down.tint = mixRgb(0xffffff, C.plateGlow, 0.6 + 0.4 * Math.sin(f.t * 4));
  }
}

export class PickupLook extends Look {
  private readonly item: Sprite;
  private readonly glow: Sprite;
  private readonly shadow: Sprite;
  private readonly seed = Math.random() * 10;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    const heart = o.kind === 'heart_seed';
    this.shadow = this.add('shadow', 0, 1.3);
    this.glow = this.add('glow', 0, -0.6);
    this.glow.tint = heart ? C.heart : C.shard;
    this.item = this.add(heart ? 'heart_seed' : 'loom_shard', 0, -0.6);
  }
  protected pose(o: WorldObject, f: Frame): void {
    const t = f.t + this.seed;
    const bob = Math.sin(t * TAU * F.bobHz) * F.bob;
    const taken = this.k;
    this.root.visible = taken < 1;
    this.item.position.y = -0.8 + bob - taken * 2;
    this.item.alpha = 1 - taken;
    this.item.rotation = Math.sin(t * 1.3) * 0.12;
    this.shadow.scale.set(1.0 - bob * 0.5, 0.45 - bob * 0.2);
    this.shadow.alpha = 1 - taken;
    const pulse = 0.5 + 0.5 * Math.sin(t * TAU * F.glowHz);
    this.glow.scale.set(2.4 + 0.4 * pulse);
    this.glow.alpha = (0.35 + 0.2 * pulse) * (1 - taken);
    if (!o.on && Math.random() < 3 * f.dt) {
      const p = f.fx.one(
        f.fx.top,
        f.fx.t.star,
        this.x + rand(-1, 1),
        this.y - 0.8 + rand(-1, 0.8),
        0.4,
        0xffffff,
        0.45,
        0.05,
      );
      if (p) p.vy = -1;
    }
  }
}

/** Draws nothing (an object another layer draws, such as a Hearth station tile). */
export class HiddenLook extends Look {
  protected pose(): void {}
}

export class LoomStoneLook extends Look {
  private readonly rune: Sprite;
  private readonly ring: Sprite;
  private readonly pillar: Sprite;
  private readonly runeGlow: Sprite;
  constructor(atlas: Atlas, o: WorldObject) {
    super(atlas, o);
    this.ring = this.add('loom_ring', 0, 1.2);
    this.ring.tint = C.loomRune;
    this.add('loom_stone_obj');
    this.runeGlow = this.add('glow', 0, -1.8);
    this.runeGlow.tint = C.loomRune;
    this.rune = this.add('loom_rune', 0, -1.8);
    this.rune.scale.set(0.72);
    this.pillar = this.add('glow', 0, -9);
    this.pillar.tint = C.loomRune;
    this.root.scale.set(1.2);
  }
  protected override speed(): number {
    return 0.6;
  }
  protected pose(o: WorldObject, f: Frame): void {
    const on = smoothstep(0, 1, this.k);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2.2);
    this.rune.tint = mixRgb(C.loomRuneOff, C.loomRune, on);
    // A small glow on the rune only, so the stone itself stays stone-colored.
    this.runeGlow.alpha = on * (0.3 + 0.2 * pulse);
    this.runeGlow.scale.set(0.95 + 0.15 * pulse);
    this.ring.alpha = on * 0.85;
    this.ring.rotation = f.t * F.ringSpin;
    this.ring.scale.set(3.4 * (0.6 + 0.4 * on), 3.4 * (0.6 + 0.4 * on) * 0.5);
    this.pillar.alpha = on * F.pillarAlpha * (0.8 + 0.2 * pulse);
    this.pillar.scale.set(1.1, 5.5);
    if (o.on && Math.random() < F.motes * f.dt) {
      const a = rand(0, TAU);
      const p = f.fx.one(
        f.fx.top,
        f.fx.t.dot,
        this.x + Math.cos(a) * 2.6,
        this.y + 1.2 + Math.sin(a) * 1.2,
        1.4,
        C.loomRune,
        0.3,
        0.06,
      );
      if (p) {
        p.vy = -rand(3, 5);
        p.vx = -Math.cos(a) * 0.8;
      }
    }
  }
}

/** Puzzle objects and pickups of the current room (state.objects), drawn under the bodies. */
