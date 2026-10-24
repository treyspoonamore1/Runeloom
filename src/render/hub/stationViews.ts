import { Container, Graphics, Sprite, type GraphicsContext } from 'pixi.js';
import type { GameState } from '../../sim';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { buildFlame } from '../ambientView';
import { clamp } from '../mathx';
import { PAL } from '../palette';
import type { WorldFx } from '../world/worldFx';
import { HUB, HUB_FEEL as F } from './hubPalette';
import { firePit } from './hubShapes';
import { K, NPC_POSE, npcShapes, type NpcId } from './npcShapes';

const TAU = Math.PI * 2;

/** Where a station stands: the center of its tile rectangle (cells) and its size. */
export interface StationBox {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

/** One station's drawing; the hub view owns one per station in the room. */
export interface StationView {
  readonly root: Container;
  /** Top of the art above the box center (cells, negative is up), for the prompt. */
  top(): number;
  update(s: GameState, t: number, dt: number, fx: WorldFx): void;
  /** A one-shot flourish (used, upgraded, lit). */
  flourish(fx: WorldFx, strong: boolean): void;
  destroy(): void;
}

export function shapeGraphics(c: GraphicsContext, parent: Container): Graphics {
  const g = new Graphics(c);
  g.scale.set(1 / K);
  parent.addChild(g);
  return g;
}

/** An NPC: idle bob and breath; turns to face the player when near. */
export class NpcView implements StationView {
  readonly root = new Container();
  private readonly fig = new Container();
  private readonly body: Graphics;
  private readonly head: Graphics;
  private readonly prop: Graphics;
  private readonly seed = Math.random() * 10;
  private face = 1;

  constructor(
    private readonly id: NpcId,
    private readonly box: StationBox,
  ) {
    const sh = npcShapes()[id];
    shapeGraphics(sh.shadow, this.root);
    this.root.addChild(this.fig);
    this.body = shapeGraphics(sh.body, this.fig);
    this.head = shapeGraphics(sh.head, this.fig);
    this.prop = shapeGraphics(sh.prop, this.fig);
    this.root.position.set(box.cx, box.cy - 0.6);
    this.root.scale.set(1.15);
  }

  top(): number {
    return -4.6;
  }

  update(s: GameState, t: number, dt: number): void {
    const p = s.player;
    const dx = p.x - this.box.cx;
    const near = Math.hypot(dx, p.y - this.box.cy) < F.npcFaceRange && !p.dead;
    // Face the player when near, else look about now and then.
    const want = near ? (dx >= 0 ? 1 : -1) : Math.sin((t + this.seed) * 0.23) >= 0 ? 1 : -1;
    this.face += (want - this.face) * clamp(dt * 10, 0, 1);
    this.fig.scale.x = Math.abs(this.face) < 0.15 ? 0.15 * Math.sign(this.face || 1) : this.face;
    const ph = (t + this.seed) * TAU * F.npcBobHz;
    const bob = Math.sin(ph) * F.npcBob;
    this.body.scale.set((1 + 0.025 * Math.sin(ph)) / K, (1 - 0.03 * Math.sin(ph)) / K);
    this.body.position.y = 0;
    const pose = NPC_POSE[this.id];
    this.head.position.set(0.05, pose.headY + bob);
    this.head.rotation = 0.05 * Math.sin(ph * 0.5);
    this.prop.position.set(pose.propX, pose.propY + bob * 0.6 + 0.05 * Math.sin(ph * 1.7));
  }

  flourish(fx: WorldFx): void {
    fx.burst(fx.top, fx.t.star, this.box.cx, this.box.cy - 3, 5, [2, 4], [0.3, 0.5], [0xffffff, HUB.gold], [0.35, 0.1], 0.5, (q) => (q.drag = 3));
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

/** The Hearth fire: a ring of stones, a big layered flame and a warm additive glow. Dark when unlit. */
export class FireView implements StationView {
  readonly root = new Container();
  private readonly flames: Graphics[] = [];
  private readonly glow: Sprite;
  private readonly inner: Sprite;
  private lit = 0;

  constructor(
    atlas: Atlas,
    private readonly box: StationBox,
    flameCtx: GraphicsContext,
    lit: boolean,
  ) {
    this.lit = lit ? 1 : 0;
    this.root.position.set(box.cx, box.cy);
    this.glow = new Sprite(atlas.get('glow'));
    this.glow.blendMode = 'add';
    this.glow.tint = PAL.flameOuter;
    this.root.addChild(this.glow);
    shapeGraphics(pitCtx(), this.root);
    this.inner = new Sprite(atlas.get('glow'));
    this.inner.blendMode = 'add';
    this.inner.tint = HUB.emberCore;
    this.inner.position.set(0, -0.4);
    this.root.addChild(this.inner);
    for (const [x, s] of [
      [-1.4, 0.7],
      [1.4, 0.75],
      [0, 1],
    ] as const) {
      const g = new Graphics(flameCtx);
      g.position.set(x, 1.4);
      g.scale.set(s * F.fireScale);
      this.root.addChild(g);
      this.flames.push(g);
    }
  }

  top(): number {
    return -7.5;
  }

  update(s: GameState, t: number, dt: number, fx: WorldFx): void {
    const on = s.hero.hearth.lit;
    this.lit = clamp(this.lit + (on ? dt : -dt) / 0.8, 0, 1);
    const k = this.lit;
    this.flames.forEach((g, i) => {
      const n = 0.6 * Math.sin(t * (8.3 + i) + i * 2.1) + 0.4 * Math.sin(t * (21.7 - i * 3) + i);
      const base = (i === 2 ? 1 : 0.72) * F.fireScale;
      const sc = Math.max(0.12, k) * base;
      g.visible = k > 0.02;
      g.scale.set(sc * (1 - 0.07 * n), sc * (1 + 0.15 * n));
      g.rotation = 0.06 * Math.sin(t * (4.1 + i));
    });
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.3) * Math.sin(t * 5.1);
    this.glow.scale.set(F.fireGlow * (0.95 + 0.08 * pulse), F.fireGlow * 0.75 * (0.95 + 0.08 * pulse));
    this.glow.alpha = (0.12 + F.fireGlowAlpha * k) * (0.9 + 0.1 * pulse);
    this.inner.scale.set(3.4 + 0.4 * pulse, 2.4);
    this.inner.alpha = 0.15 + 0.5 * k;
    if (k > 0.5 && Math.random() < F.fireEmbers * dt) {
      const p = fx.one(fx.add, fx.t.dot, this.box.cx + rand(-2, 2), this.box.cy - 1.5, rand(1.2, 2), HUB.ember, 0.35, 0.05);
      if (p) {
        p.vy = -rand(4, 7);
        p.vx = rand(-0.8, 0.8);
      }
    } else if (k < 0.5 && Math.random() < 2 * dt) {
      const p = fx.one(fx.top, fx.t.puff, this.box.cx + rand(-1, 1), this.box.cy - 0.5, 1.6, 0x8a7f86, 0.5, 1.4, 0.3);
      if (p) p.vy = -2;
    }
  }

  flourish(fx: WorldFx, strong: boolean): void {
    const { cx, cy } = this.box;
    fx.one(fx.add, fx.t.glow, cx, cy - 1, strong ? 1.2 : 0.5, PAL.flameOuter, strong ? 4 : 2, strong ? 12 : 6, 0.8);
    fx.burst(fx.add, fx.t.dot, cx, cy - 1.5, strong ? 24 : 8, [3, strong ? 12 : 6], [0.5, 1.2], [HUB.ember, HUB.emberCore], [0.45, 0.05], 1.5, (q) => {
      q.drag = 1.5;
      q.vy -= 4;
    });
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}

let pit: GraphicsContext | null = null;
function pitCtx(): GraphicsContext {
  return (pit ??= firePit());
}

let flame: GraphicsContext | null = null;
export function flameCtx(): GraphicsContext {
  return (flame ??= buildFlame());
}
