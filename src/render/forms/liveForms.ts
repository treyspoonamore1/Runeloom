import type { Texture } from 'pixi.js';
import { DT, type GameState } from '../../sim';
import type { SpellInstance } from '../../sim/weave/runtime/types';
import { mixRgb } from '../ailmentPalette';
import type { Atlas } from '../atlas';
import { ECHO_ALPHA, ECHO_TINT, spellLook, type ElementLook } from '../elementLook';
import type { FxLayer } from '../particles';
import type { ShotPools } from './oneShots';

const TAU = Math.PI * 2;
const SIGIL_FADE_IN = 0.15;
const SIGIL_FADE_OUT = 0.3;
/** Orb trail: ghosts behind the orb and the ticks between them. */
const ORB_GHOSTS = 5;
const ORB_GHOST_TICKS = 2;

/** Per-instance render memory for the few long-lived forms (Sigil emit pulses). */
interface Memo {
  procs: number;
  pulse: number;
  seen: number;
}

/**
 * The forms that live for a while and are drawn straight from `state.spells` every frame:
 * Nova (expanding ring), Lob (arcing glob with a ground shadow and a landing marker), Orb
 * (orbiting core with a faint trail) and Sigil (rune circle that pulses when it emits).
 * Bolts are ProjectileView's; instant forms are one-shots (FormLayer).
 */
export class LiveForms {
  private readonly t: Record<'glow' | 'ring' | 'novaRing' | 'shadow' | 'sigil' | 'sigilCore' | 'dot', Texture>;
  private readonly memo = new Map<number, Memo>();
  /** Live orbs by id this frame (for hit flashes). */
  readonly orbs = new Map<number, SpellInstance>();
  private frame = 0;
  private time = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly fx: FxLayer,
  ) {
    this.t = {
      glow: atlas.get('glow'),
      ring: atlas.get('ring'),
      novaRing: atlas.get('nova_ring'),
      shadow: atlas.get('shadow'),
      sigil: atlas.get('sigil_circle'),
      sigilCore: atlas.get('sigil_core'),
      dot: atlas.get('dot'),
    };
  }

  reset(): void {
    this.memo.clear();
    this.orbs.clear();
  }

  update(s: GameState, alpha: number, dt: number, P: ShotPools): void {
    const frame = ++this.frame;
    this.time += dt;
    this.orbs.clear();
    for (const inst of s.spells) {
      if (inst.ended) continue;
      switch (inst.form) {
        case 'nova':
          this.nova(inst, alpha, P);
          break;
        case 'lob':
          this.lob(inst, alpha, P);
          break;
        case 'orb':
          this.orbs.set(inst.id, inst);
          this.orb(inst, alpha, P);
          break;
        case 'sigil':
          this.sigil(inst, dt, frame, P);
          break;
        default:
      }
    }
    if (this.memo.size > 0) for (const [id, m] of this.memo) if (m.seen !== frame) this.memo.delete(id);
  }

  private colors(inst: SpellInstance): { L: ElementLook; pale: (c: number) => number; a: number } {
    const L = spellLook(inst.spec.elements);
    return inst.echo
      ? { L, pale: (c) => mixRgb(c, ECHO_TINT, 0.55), a: ECHO_ALPHA }
      : { L, pale: (c) => c, a: 1 };
  }

  private nova(inst: SpellInstance, alpha: number, P: ShotPools): void {
    const pr = inst.spec.params;
    if (pr.form !== 'nova') return;
    const u = pr.expandTime > 0 ? Math.min(1, (inst.age + alpha * DT) / pr.expandTime) : 1;
    const r = Math.max(0.3, pr.radius * u);
    const { L, pale, a } = this.colors(inst);
    const f = P.ground.next(this.t.glow);
    if (f) {
      f.x = inst.cx;
      f.y = inst.cy;
      f.scaleX = f.scaleY = r * 1.05;
      f.paint(pale(L.glow), 0.24 * a);
    }
    for (const [c, k, al] of [
      [L.rim, 1, 0.9],
      [L.core, 0.975, 0.7],
    ] as const) {
      const p = P.air.next(this.t.novaRing);
      if (!p) return;
      p.x = inst.cx;
      p.y = inst.cy;
      p.scaleX = p.scaleY = (r / 4) * k;
      p.paint(pale(c), al * a);
    }
  }

  private lob(inst: SpellInstance, alpha: number, P: ShotPools): void {
    const pr = inst.spec.params;
    if (pr.form !== 'lob') return;
    const u = pr.flightTime > 0 ? Math.min(1, (inst.age + alpha * DT) / pr.flightTime) : 1;
    const gx = inst.prevX + (inst.x - inst.prevX) * alpha;
    const gy = inst.prevY + (inst.y - inst.prevY) * alpha;
    const dist = Math.hypot(inst.toX - inst.fromX, inst.toY - inst.fromY);
    const peak = Math.max(2.5, dist * 0.3);
    const h = peak * 4 * u * (1 - u);
    const { L, pale, a } = this.colors(inst);
    // Where it will land: a faint ring that firms up as it falls.
    const m = P.ground.next(this.t.ring);
    if (m) {
      m.x = inst.toX;
      m.y = inst.toY;
      m.scaleX = m.scaleY = pr.burstRadius;
      m.paint(pale(L.rim), (0.12 + 0.3 * u) * a);
    }
    const sh = P.ground.next(this.t.shadow);
    if (sh) {
      sh.x = gx;
      sh.y = gy;
      const k = 1 - 0.45 * (h / peak);
      sh.scaleX = 0.95 * k;
      sh.scaleY = 0.5 * k;
      sh.paint(0xffffff, 1);
    }
    const y = gy - h;
    const g = P.air.next(this.t.glow);
    if (g) {
      g.x = gx;
      g.y = y;
      g.scaleX = g.scaleY = 2.3;
      g.paint(pale(L.glow), L.glowAlpha * a);
    }
    const c = P.air.next(this.atlas.get(L.boltCore));
    if (c) {
      c.x = gx;
      c.y = y;
      c.rotation = inst.age * 9;
      c.scaleX = c.scaleY = 0.95;
      c.paint(inst.echo ? ECHO_TINT : 0xffffff, a);
    }
    if (Math.random() < 0.5) {
      const e = this.fx.spawn(this.t.dot, gx + (Math.random() - 0.5), y + (Math.random() - 0.5), 0, 1.5, 0.3, L.sparks[0]!, 0.2, 0.05);
      if (e) e.drag = 2;
    }
  }

  private orb(inst: SpellInstance, alpha: number, P: ShotPools): void {
    const pr = inst.spec.params;
    if (pr.form !== 'orb') return;
    const x = inst.prevX + (inst.x - inst.prevX) * alpha;
    const y = inst.prevY + (inst.y - inst.prevY) * alpha;
    const { L, pale, a } = this.colors(inst);
    // Trail: ghosts placed back along the orbit around the current center.
    const ox = inst.x - inst.cx;
    const oy = inst.y - inst.cy;
    const step = -Math.atan2(pr.tickRotation.sin, pr.tickRotation.cos) * ORB_GHOST_TICKS;
    for (let i = 1; i <= ORB_GHOSTS; i++) {
      const c = Math.cos(step * i);
      const sn = Math.sin(step * i);
      const p = P.air.next(this.t.dot);
      if (!p) break;
      p.x = x - inst.x + inst.cx + ox * c - oy * sn;
      p.y = y - inst.y + inst.cy + ox * sn + oy * c;
      p.scaleX = p.scaleY = inst.radius * 0.5 * (1 - i / (ORB_GHOSTS + 1));
      p.paint(pale(L.trail), 0.45 * (1 - i / (ORB_GHOSTS + 1)) * a);
    }
    const fadeOut = Math.min(1, inst.lifeLeft / 0.25);
    const g = P.air.next(this.t.glow);
    if (g) {
      g.x = x;
      g.y = y;
      g.scaleX = g.scaleY = inst.radius * 1.9 * (0.94 + 0.08 * Math.sin(this.time * 17 + inst.id));
      g.paint(pale(L.glow), L.glowAlpha * a * fadeOut);
    }
    const c = P.air.next(this.atlas.get(L.boltCore));
    if (c) {
      c.x = x;
      c.y = y;
      c.rotation = L.crackle ? Math.random() * TAU : this.time * 4;
      c.scaleX = c.scaleY = inst.radius * 0.65;
      c.paint(inst.echo ? ECHO_TINT : 0xffffff, a * fadeOut);
    }
  }

  private sigil(inst: SpellInstance, dt: number, frame: number, P: ShotPools): void {
    let m = this.memo.get(inst.id);
    let procs = 0;
    for (const n of inst.procs) procs += n;
    if (!m) this.memo.set(inst.id, (m = { procs, pulse: 0, seen: frame }));
    m.seen = frame;
    const { L, pale, a } = this.colors(inst);
    if (procs > m.procs) {
      m.pulse = 1;
      const r = this.fx.spawn(this.t.ring, inst.x, inst.y, 0, 0, 0.3, pale(L.core), 2.6, 4.2);
      if (r) r.a0 = 0.8;
    }
    m.procs = procs;
    m.pulse = Math.max(0, m.pulse - dt * 5);
    const appear = Math.min(1, inst.age / SIGIL_FADE_IN);
    const fade = Math.min(appear, inst.lifeLeft / SIGIL_FADE_OUT, 1);
    const sc = (0.6 + 0.4 * appear) * (1 + 0.12 * m.pulse);
    const c = P.ground.next(this.t.sigil);
    if (c) {
      c.x = inst.x;
      c.y = inst.y;
      c.rotation = inst.age * 0.5;
      c.scaleX = c.scaleY = sc;
      c.paint(pale(mixRgb(L.rim, 0xffffff, 0.35 * m.pulse)), (0.7 + 0.3 * m.pulse) * fade * a);
    }
    const k = P.ground.next(this.t.sigilCore);
    if (k) {
      k.x = inst.x;
      k.y = inst.y;
      k.rotation = -inst.age * 1.2;
      k.scaleX = k.scaleY = sc * (0.9 + 0.3 * m.pulse);
      k.paint(pale(L.core), fade * a);
    }
  }
}
