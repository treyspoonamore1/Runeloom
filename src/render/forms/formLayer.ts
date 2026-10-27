import { Container, type Texture } from 'pixi.js';
import type { GameState, SimEvent } from '../../sim';
import { mixRgb } from '../ailmentPalette';
import type { Atlas } from '../atlas';
import { ECHO_ALPHA, ECHO_TINT, spellLook, type ElementLook } from '../elementLook';
import type { FxView } from '../fxView';
import { FxLayer, ImmediatePool } from '../particles';
import { LiveForms } from './liveForms';
import { OneShots, type ShotPools } from './oneShots';

/** Mana refund motes and trigger glyphs. */
const MANA = { core: 0xd8ecff, glow: 0x4f8fff, life: 0.45 } as const;
const GLYPH_TINT = 0xffdf7a;
const BEAM_LIFE = 0.16;
const CHAIN_LIFE = 0.18;
const SWATH_LIFE = 0.38;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/**
 * Visuals for the player's spell forms (DESIGN §5, §14), all player-owned and dimmed with the
 * player's effects:
 * - from `state.spells` each frame: Nova, Lob, Orb, Sigil (LiveForms); Bolts are ProjectileView's.
 * - from events: Strike swoosh and Swath sweep (spellSpawn), Beam flash (beamFire), Chain arcs
 *   (chainJump), Lob bursts (lobLand), Nova afterglow (spellEnd), branch origin sparks, Echo
 *   tint, mana-refund motes (manaRefund), trigger glyphs (triggerFired) and Orb hit flashes.
 *
 * Layers (added by the renderer): `ground` under the bodies (Sigil, Swath, Nova fill, Lob
 * shadow), `air` above them (rings, beams, globs, orbs, glyphs).
 *
 * To add a form: draw it in LiveForms if it lives over time, or as a OneShots kind if it is
 * instant; pick its colors with spellLook(elements).
 */
export class FormLayer {
  readonly ground = new Container();
  readonly air = new Container();
  private readonly pools: ShotPools;
  private readonly sparks: FxLayer;
  private readonly sparksAdd: FxLayer;
  private readonly shots: OneShots;
  private readonly live: LiveForms;
  /** Looks and sizes of live instances by id, from spellSpawn (for their end and hit effects). */
  private readonly spawned = new Map<number, { look: ElementLook; radius: number; echo: boolean }>();
  private readonly t: Record<'glow' | 'ring' | 'star' | 'spark' | 'dot' | 'shard' | 'zapA' | 'puff', Texture>;

  constructor(
    atlas: Atlas,
    private readonly fx: FxView,
  ) {
    const dot = atlas.get('dot');
    this.pools = {
      ground: new ImmediatePool(dot, 2048),
      air: new ImmediatePool(dot, 4096),
      airAdd: new ImmediatePool(dot, 512, 'add'),
    };
    this.sparks = new FxLayer(dot, 1500);
    this.sparksAdd = new FxLayer(dot, 300, 'add');
    this.ground.addChild(this.pools.ground.container);
    this.air.addChild(
      this.pools.air.container,
      this.sparks.container,
      this.pools.airAdd.container,
      this.sparksAdd.container,
    );
    this.shots = new OneShots(atlas);
    this.live = new LiveForms(atlas, this.sparks);
    this.t = {
      glow: atlas.get('glow'),
      ring: atlas.get('ring'),
      star: atlas.get('star'),
      spark: atlas.get('spark'),
      dot,
      shard: atlas.get('shard'),
      zapA: atlas.get('zap_a'),
      puff: atlas.get('puff'),
    };
  }

  get particleCount(): number {
    return this.sparks.count + this.sparksAdd.count + this.shots.count;
  }

  reset(): void {
    this.sparks.clear();
    this.sparksAdd.clear();
    this.shots.clear();
    this.live.reset();
    this.spawned.clear();
  }

  update(s: GameState, alpha: number, dt: number, px: number, py: number): void {
    const P = this.pools;
    P.ground.begin();
    P.air.begin();
    P.airAdd.begin();
    this.live.update(s, alpha, dt, P);
    this.shots.update(dt, P, px, py);
    P.ground.end();
    P.air.end();
    P.airAdd.end();
    this.sparks.update(dt);
    this.sparksAdd.update(dt);
  }

  handle(ev: SimEvent): void {
    switch (ev.type) {
      case 'spellSpawn': {
        const L = spellLook(ev.elements);
        this.spawned.set(ev.id, { look: L, radius: radiusOf(ev.params), echo: ev.echo });
        // Branch spells read as coming from their origin: a short spark there.
        if (ev.depth > 0) this.originSpark(ev.x, ev.y, L);
        if (ev.form === 'strike') {
          const p = ev.params;
          const reach = p.form === 'strike' ? p.reach : 5;
          const tint = ev.elements.length === 0 ? 0xffffff : mixRgb(0xffffff, L.rim, 0.6);
          this.fx.strike(
            ev.x,
            ev.y,
            ev.dirX,
            ev.dirY,
            reach / 5,
            ev.echo ? ECHO_TINT : tint,
            ev.echo ? ECHO_ALPHA : 1,
          );
        } else if (ev.form === 'swath' && ev.params.form === 'swath') {
          const sh = this.shots.add('swath', SWATH_LIFE, ev.x, ev.y);
          sh.x2 = ev.dirX;
          sh.y2 = ev.dirY;
          sh.len = ev.params.length;
          sh.w = ev.params.width;
          this.paint(sh, L, ev.echo);
          for (let i = 0; i < 6; i++) {
            const d = rand(0.1, 1) * sh.len;
            const p = this.sparks.spawn(
              this.t.spark,
              ev.x + ev.dirX * d + rand(-1, 1),
              ev.y + ev.dirY * d + rand(-1, 1),
              ev.dirX * rand(6, 14),
              ev.dirY * rand(6, 14),
              rand(0.15, 0.3),
              L.sparks[i % L.sparks.length]!,
              0.8,
              0.3,
            );
            if (p) {
              p.align = true;
              p.stretch = 0.03;
              p.drag = 4;
            }
          }
        } else if (ev.form === 'sigil') {
          const r = this.sparks.spawn(this.t.ring, ev.toX, ev.toY, 0, 0, 0.3, L.core, 4, 2.8);
          if (r) r.a0 = 0.8;
        }
        break;
      }
      case 'spellEnd': {
        const info = this.spawned.get(ev.id);
        if (!info) break;
        this.spawned.delete(ev.id);
        if (ev.form === 'nova') {
          // Afterglow: the ring keeps going a little and fades.
          const r = this.sparks.spawn(
            this.t.ring,
            ev.x,
            ev.y,
            0,
            0,
            0.22,
            info.look.rim,
            info.radius,
            info.radius * 1.12,
          );
          if (r) r.a0 = info.echo ? 0.4 : 0.7;
        }
        break;
      }
      case 'beamFire': {
        const L = spellLook(ev.elements);
        const sh = this.shots.add('beam', BEAM_LIFE, ev.fromX, ev.fromY);
        sh.x2 = ev.toX;
        sh.y2 = ev.toY;
        sh.w = ev.width;
        this.paint(sh, L, false);
        sh.crackle = L.crackle;
        for (const h of ev.hits) this.impact(h.x, h.y, L, 0.7);
        if (L.shed === 'flake') this.alongLine(ev.fromX, ev.fromY, ev.toX, ev.toY, L, 'star');
        else if (L.shed === 'ember') this.alongLine(ev.fromX, ev.fromY, ev.toX, ev.toY, L, 'dot');
        break;
      }
      case 'chainJump': {
        const info = this.spawned.get(ev.id);
        const L = info?.look ?? spellLook([]);
        const sh = this.shots.add('chain', CHAIN_LIFE, ev.fromX, ev.fromY);
        sh.x2 = ev.toX;
        sh.y2 = ev.toY;
        sh.w = 0.6;
        this.paint(sh, L, false);
        sh.crackle = L.crackle;
        this.impact(ev.toX, ev.toY, L, 0.5);
        break;
      }
      case 'lobLand': {
        const L = spellLook(ev.elements);
        this.burstAt(ev.x, ev.y, ev.radius, L);
        break;
      }
      case 'manaRefund': {
        const sh = this.shots.add('mote', MANA.life, ev.x, ev.y - 0.5);
        sh.core = MANA.core;
        sh.glow = MANA.glow;
        break;
      }
      case 'triggerFired':
        // Button triggers (Cast, Channel) show no glyph: Channel would leave five a second.
        if (ev.trigger !== 'cast' && ev.trigger !== 'channel')
          this.shots.glyph(ev.trigger, ev.x, ev.y - 2.6, GLYPH_TINT);
        break;
      case 'hit': {
        // Orb hits flash at the orb.
        if (ev.spellId === undefined) break;
        const orb = this.live.orbs.get(ev.spellId);
        if (!orb) break;
        const L = spellLook(orb.spec.elements);
        const g = this.sparksAdd.spawn(
          this.t.glow,
          orb.x,
          orb.y,
          0,
          0,
          0.12,
          L.core,
          orb.radius * 1.6,
          orb.radius * 2.4,
        );
        if (g) g.a0 = 0.8;
        break;
      }
      default:
    }
  }

  private paint(
    sh: { rim: number; core: number; glow: number; alpha: number },
    L: ElementLook,
    echo: boolean,
  ): void {
    const pale = (c: number): number => (echo ? mixRgb(c, ECHO_TINT, 0.55) : c);
    sh.rim = pale(L.rim);
    sh.core = pale(L.core);
    sh.glow = pale(L.glow);
    sh.alpha = echo ? ECHO_ALPHA : 1;
  }

  private originSpark(x: number, y: number, L: ElementLook): void {
    const s = this.sparks.spawn(this.t.star, x, y, 0, 0, 0.14, L.core, 1.0, 0.3);
    if (s) s.rotation = rand(0, 1);
    const r = this.sparks.spawn(this.t.ring, x, y, 0, 0, 0.16, L.rim, 0.4, 1.4);
    if (r) r.a0 = 0.7;
  }

  /** A small hit pop in the spell's colors. */
  private impact(x: number, y: number, L: ElementLook, size: number): void {
    const g = this.sparksAdd.spawn(this.t.glow, x, y, 0, 0, 0.12, L.glow, 2.4 * size, 1.2 * size);
    if (g) g.a0 = 0.8;
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(10, 20);
      const p = this.sparks.spawn(
        this.t.spark,
        x,
        y,
        Math.cos(a) * v,
        Math.sin(a) * v,
        rand(0.08, 0.16),
        L.sparks[i % L.sparks.length]!,
        0.8,
        0.3,
      );
      if (p) {
        p.align = true;
        p.stretch = 0.03;
        p.drag = 6;
      }
    }
  }

  /** Glints (frost) or embers (fire) left along a beam. */
  private alongLine(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    L: ElementLook,
    kind: 'star' | 'dot',
  ): void {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.min(10, Math.ceil(len / 4));
    for (let i = 0; i < n; i++) {
      const u = rand(0, 1);
      const p = this.sparks.spawn(
        this.t[kind],
        x0 + (x1 - x0) * u + rand(-0.5, 0.5),
        y0 + (y1 - y0) * u + rand(-0.5, 0.5),
        0,
        kind === 'dot' ? -3 : 0,
        rand(0.25, 0.5),
        L.sparks[i % L.sparks.length]!,
        kind === 'star' ? 0.7 : 0.22,
        0.05,
      );
      if (p) {
        p.rotation = rand(0, 1);
        p.drag = 2;
      }
    }
  }

  /** Lob landing: a ring out to the burst radius, a flash and element debris. */
  private burstAt(x: number, y: number, radius: number, L: ElementLook): void {
    if (L.shed === 'wisp') return this.gustBurstAt(x, y, radius, L);
    const g = this.sparksAdd.spawn(this.t.glow, x, y, 0, 0, 0.2, L.glow, radius * 0.9, radius * 1.3);
    if (g) g.a0 = 0.7;
    const r = this.sparks.spawn(this.t.ring, x, y, 0, 0, 0.24, L.rim, radius * 0.35, radius);
    if (r) r.a0 = 0.9;
    const tex = L.shed === 'flake' ? this.t.shard : L.shed === 'spark' ? this.t.spark : this.t.dot;
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(radius * 1.5, radius * 3.5);
      const p = this.sparks.spawn(
        tex,
        x,
        y,
        Math.cos(a) * v,
        Math.sin(a) * v,
        rand(0.2, 0.4),
        L.sparks[i % L.sparks.length]!,
        tex === this.t.dot ? 0.3 : 0.7,
        0.1,
      );
      if (!p) break;
      p.drag = 4;
      if (tex === this.t.spark) {
        p.align = true;
        p.stretch = 0.03;
      } else {
        p.spin = rand(-8, 8);
        if (tex === this.t.dot) p.grav = -6;
      }
    }
    const pf = this.sparks.spawn(this.t.puff, x, y, 0, -1, 0.45, 0x8a7f88, radius * 0.25, radius * 0.45);
    if (pf) pf.a0 = 0.35;
  }

  /**
   * Gale Lob landing (playtest 8): the ball of wind bursts. A soft pale flash, a ring out to the
   * burst, and pale streaks flung outward along the radius, as the gust it leaves blows. No
   * rising embers and no dust puff: wind has neither.
   */
  private gustBurstAt(x: number, y: number, radius: number, L: ElementLook): void {
    const g = this.sparksAdd.spawn(this.t.glow, x, y, 0, 0, 0.18, L.glow, radius * 0.6, radius * 1.1);
    if (g) g.a0 = 0.45;
    const r = this.sparks.spawn(this.t.ring, x, y, 0, 0, 0.3, L.rim, radius * 0.3, radius * 1.05);
    if (r) r.a0 = 0.8;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + rand(-0.15, 0.15);
      const v = rand(radius * 2.5, radius * 4);
      const p = this.sparks.spawn(
        this.t.spark,
        x + Math.cos(a) * 0.8,
        y + Math.sin(a) * 0.8,
        Math.cos(a) * v,
        Math.sin(a) * v,
        rand(0.18, 0.3),
        L.sparks[i % L.sparks.length]!,
        0.8,
        0.25,
      );
      if (!p) break;
      p.align = true;
      p.stretch = 0.05;
      p.drag = 3;
    }
  }
}

function radiusOf(p: { form: string } & Record<string, unknown>): number {
  const r = (p as { radius?: number }).radius;
  return typeof r === 'number' ? r : 0;
}
