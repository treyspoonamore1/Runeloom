import { Container, Sprite, type Renderer, type Texture } from 'pixi.js';
import type { AttackShape, GameState } from '../sim';
import { enemyDef } from '../../data/enemies';
import { bakeTexture } from './atlas';
import { TELEGRAPH as T } from './combatPalette';
import type { Pen } from './pen';

const TAU = Math.PI * 2;
const PAD = 1;

interface ShapeTex {
  /** Solid white area, tinted for the base, growing and flash fills. */
  fill: Texture;
  /** Red-magenta edge over a dark halo. */
  edge: Texture;
  /** Shape dimensions the textures were baked for (kind code, then up to two numbers). */
  k: number;
  a: number;
  b: number;
}

/** One telegraph or flash on screen: base fill, growing fill, edge. */
class Slot {
  readonly root = new Container();
  readonly base = new Sprite();
  readonly grow = new Sprite();
  readonly edge = new Sprite();
  constructor() {
    this.root.addChild(this.base, this.grow, this.edge);
    this.base.tint = this.grow.tint = T.fill;
  }
}

interface Flash {
  tex: ShapeTex;
  shape: AttackShape;
  x: number;
  y: number;
  t: number;
  strength: number;
}

function dims(s: AttackShape): [number, number, number] {
  switch (s.kind) {
    case 'circle':
      return [0, s.r, 0];
    case 'cone':
      return [1, s.r, s.halfAngleCos];
    case 'line':
      return [2, s.length, s.width];
  }
}

function sameDims(t: ShapeTex, s: AttackShape): boolean {
  switch (s.kind) {
    case 'circle':
      return t.k === 0 && t.a === s.r;
    case 'cone':
      return t.k === 1 && t.a === s.r && t.b === s.halfAngleCos;
    case 'line':
      return t.k === 2 && t.a === s.length && t.b === s.width;
  }
}

function drawShape(p: Pen, s: AttackShape): Pen {
  switch (s.kind) {
    case 'circle':
      return p.circle(0, 0, s.r);
    case 'cone': {
      const a = Math.acos(Math.max(-1, Math.min(1, s.halfAngleCos)));
      return p.moveTo(0, 0).arc(0, 0, s.r, -a, a).close();
    }
    case 'line':
      return p.rect(0, -s.width / 2, s.length, s.width);
  }
}

/**
 * Enemy attack telegraphs (DESIGN §14): while an enemy's attack is winding up, its hit shape
 * is drawn on the ground at the attack origin with a pulsing red-magenta edge and a fill that
 * grows with windup progress; 'attack' events flash the shape. Never dimmed by effect density.
 * Textures are baked per shape (cached by attack name) and reused.
 */
export class TelegraphView {
  readonly root = new Container();
  private readonly cache = new Map<string, ShapeTex>();
  private readonly slots: Slot[] = [];
  private readonly flashes: Flash[] = [];
  private time = 0;

  constructor(private readonly renderer: Renderer) {}

  reset(): void {
    this.flashes.length = 0;
  }

  /** 'attack' event: flash the shape the enemy just used. */
  attack(state: GameState, id: number): void {
    for (const e of state.enemies) {
      if (e.id !== id) continue;
      const a = e.attack;
      const def = enemyDef(e.kind).attack;
      this.flashes.push({
        tex: this.textures(a.name, a.shape),
        shape: a.shape,
        x: a.originX,
        y: a.originY,
        t: 0,
        strength: def?.projectile ? 0.45 : 1,
      });
      return;
    }
  }

  update(state: GameState, dt: number): void {
    this.time += dt;
    let n = 0;
    const pulse = 1 - T.pulseDepth * (0.5 + 0.5 * Math.sin(this.time * TAU * T.pulseHz));
    for (const e of state.enemies) {
      const a = e.attack;
      if (a.phase !== 'windup' || e.dead) continue;
      const def = enemyDef(e.kind).attack;
      if (!def) continue;
      const progress = def.windup > 0 ? Math.max(0, Math.min(1, 1 - a.timeLeft / def.windup)) : 1;
      const slot = this.slot(n++);
      const tex = this.textures(a.name, a.shape);
      this.place(slot, tex, a.shape, a.originX, a.originY);
      slot.base.alpha = T.baseAlpha;
      slot.grow.visible = true;
      slot.grow.alpha = T.growAlpha + 0.2 * progress;
      slot.grow.tint = T.fill;
      if (a.shape.kind === 'line') slot.grow.scale.set(progress, 1);
      else slot.grow.scale.set(progress);
      slot.edge.alpha = progress > 0.8 ? 1 : pulse;
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i]!;
      f.t += dt;
      if (f.t >= T.flashTime) {
        this.flashes[i] = this.flashes[this.flashes.length - 1]!;
        this.flashes.pop();
        continue;
      }
      const k = 1 - f.t / T.flashTime;
      const slot = this.slot(n++);
      this.place(slot, f.tex, f.shape, f.x, f.y);
      slot.base.alpha = T.flashAlpha * k * k * f.strength;
      slot.base.tint = T.flash;
      slot.grow.visible = false;
      slot.edge.alpha = k * f.strength;
    }
    for (let i = n; i < this.slots.length; i++) this.slots[i]!.root.visible = false;
  }

  private slot(i: number): Slot {
    let s = this.slots[i];
    if (!s) {
      s = new Slot();
      this.slots.push(s);
      this.root.addChild(s.root);
    }
    s.root.visible = true;
    s.base.tint = T.fill;
    return s;
  }

  private place(slot: Slot, tex: ShapeTex, shape: AttackShape, x: number, y: number): void {
    slot.root.position.set(x, y);
    slot.root.rotation = shape.kind === 'circle' ? 0 : Math.atan2(shape.dirY, shape.dirX);
    if (slot.base.texture !== tex.fill) {
      slot.base.texture = slot.grow.texture = tex.fill;
      slot.edge.texture = tex.edge;
      for (const s of [slot.base, slot.grow, slot.edge]) s.anchor.copyFrom(tex.fill.defaultAnchor!);
    }
    slot.base.scale.set(1);
  }

  private textures(name: string, shape: AttackShape): ShapeTex {
    const hit = this.cache.get(name);
    if (hit && sameDims(hit, shape)) return hit;
    let x0: number, y0: number, x1: number, y1: number;
    if (shape.kind === 'line') {
      x0 = -PAD;
      x1 = shape.length + PAD;
      y0 = -shape.width / 2 - PAD;
      y1 = shape.width / 2 + PAD;
    } else {
      x0 = y0 = -shape.r - PAD;
      x1 = y1 = shape.r + PAD;
    }
    const fill = bakeTexture(this.renderer, x0, y0, x1, y1, T.res, (p) => drawShape(p, shape).fill(0xffffff));
    const edge = bakeTexture(this.renderer, x0, y0, x1, y1, T.res, (p) => {
      drawShape(p, shape).stroke(T.darkWidth, T.edgeDark, 0.5);
      drawShape(p, shape).stroke(T.edgeWidth, T.edge);
    });
    const [k, a, b] = dims(shape);
    const tex = { fill, edge, k, a, b };
    this.cache.set(name, tex);
    return tex;
  }
}
