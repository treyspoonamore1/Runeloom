import type { Texture } from 'pixi.js';
import { attackByName, isEnemyKind } from '../../../data/enemies';
import type { Enemy, GameState, SimEvent } from '../../sim';
import type { M4AttackKey } from '../../app/m4Wiring';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { ELEMENT, INK, TELEGRAPH as T } from '../combatPalette';
import { FEN_BOSS as P } from './fenBossPalette';
import { FenBossGlow } from './fenBossGlow';
import { FenTelegraphs } from './fenTelegraphs';

const TAU = Math.PI * 2;
const BELL = P.bellwether;
const COIL = P.glasswater_coil;

/**
 * Telegraph accents of the Drowned Foundry's bosses (CONTENT §5, DESIGN §10.5, §14), over the
 * ground telegraphs and never dimmed:
 * - Old Bellwether: sound rings rolling out over the Toll ring's marker, then the wave itself (a
 *   bright band at the sim's `waveR`, red-magenta edges, and the circle where it stops: dodge
 *   through it or stand outside); chevrons down the roll line; violet crackle under the self-toll.
 * - Glasswater Coil: chevrons and ripples down the lunge line; the glass spit's arc to a landing
 *   circle the size of its puddle (and, in flight, the shadow growing where it will land); a
 *   whirl around the tail thrash; the pulse and pylon warnings (FenBossGlow); lightning on the
 *   pylons when the storm lands.
 */
export class FenBossTelegraphs extends FenTelegraphs {
  readonly glow = new FenBossGlow();
  private readonly glassTex: Texture;
  private readonly crystalTex: Texture;
  private state: GameState | null = null;

  constructor(atlas: Atlas) {
    super(atlas);
    this.glassTex = atlas.get('water_glob');
    this.crystalTex = atlas.get('frost_crystal');
    this.root.addChildAt(this.glow.ground, 0);
  }

  override reset(): void {
    super.reset();
    this.glow.reset();
  }

  /** The bosses' own sim events: warnings start and end, lightning, splashes, bursts. */
  handleSim(events: readonly SimEvent[], s: GameState): void {
    this.glow.handle(events, s);
    for (const ev of events) {
      switch (ev.type) {
        case 'coilPylonStorm':
          for (const p of ev.pylons) this.bolt(p.x, p.y);
          break;
        case 'coilPuddle':
          this.splashRing(ev.x, ev.y, ev.radius, COIL.ripple, 10);
          break;
        case 'coilIceBreak':
          for (let i = 0; i < 16; i++) {
            const a = rand(0, TAU);
            const p = this.fx.spawn(this.crystalTex, ev.x, ev.y, Math.cos(a) * rand(8, 16), Math.sin(a) * rand(5, 10), rand(0.35, 0.6), 0xffffff, 0.9, 0.3);
            if (p) p.rotation = a;
          }
          this.splashRing(ev.x, ev.y, ev.radius, COIL.iced, 0);
          break;
        case 'coilOverloaded':
          this.burst(ev.x, ev.y, 14, ELEMENT.storm, 4);
          this.burst(ev.x, ev.y, 10, ELEMENT.stormGlow, 6);
          break;
        case 'coilPulse':
          this.burst(ev.x, ev.y, 10, ELEMENT.storm, ev.pulse === 'body' ? ev.reach * 0.5 : 6);
          break;
        case 'bellSelfToll':
          this.splashRing(ev.x, ev.y, 9, BELL.selfToll, 0);
          this.burst(ev.x, ev.y, 10, ELEMENT.stormGlow, 4);
          break;
        case 'bellWave':
          this.splashRing(ev.x, ev.y, 5, BELL.tollGlow, 0);
          break;
        case 'bellRollStunned':
          this.splashRing(ev.x, ev.y, 6, BELL.dust, 0);
          break;
        default:
          break;
      }
    }
  }

  override update(s: GameState, signals: Parameters<FenTelegraphs['update']>[1], dt: number): void {
    this.state = s;
    this.glow.update(s, dt);
    super.update(s, signals, dt);
  }

  protected override accent(e: Enemy, key: M4AttackKey, u: number): boolean {
    switch (key) {
      case 'tollRing':
      case 'tollFoundry':
        this.soundRings(e, u, BELL.tollGlow);
        return true;
      case 'selfToll':
        this.soundRings(e, u, BELL.selfToll);
        this.crackleUnder(e, u);
        return true;
      case 'shellRoll':
      case 'coilLunge':
        this.chevrons(e, u);
        if (key === 'coilLunge') this.lungeRipples(e, u);
        return true;
      case 'glassSpit':
        this.spitArc(e, u);
        return true;
      case 'tailThrash':
        this.whirl(e, u);
        return true;
      case 'callPylons':
      case 'coilDive':
        if (Math.random() < 0.5 + u) this.crackle(e.x, e.y, u);
        return true;
      default:
        return super.accent(e, key, u);
    }
  }

  protected override ongoing(s: GameState): void {
    super.ongoing(s);
    // Crackle over every glowing warning's cells, denser as it nears.
    const W = s.grid.width;
    for (const g of this.glow.glowing()) {
      const n = g.cells.length;
      if (n === 0) continue;
      const k = Math.min(8, 1 + Math.floor((n / 250) * (0.3 + g.u)));
      for (let j = 0; j < k; j++) {
        if (Math.random() > 0.35 + 0.5 * g.u) continue;
        const i = g.cells[Math.floor(Math.random() * n)]!;
        this.put(this.over, Math.random() < 0.5 ? this.t.zapA : this.t.zapB, (i % W) + 0.5, Math.floor(i / W) + 0.5, 1.1, 1.1, Math.random() < 0.7 ? ELEMENT.storm : ELEMENT.stormGlow, 0.95, rand(0, TAU));
      }
    }
    for (const e of s.enemies) {
      const f = e.boss?.fen;
      if (!e.dead && f && f.waveR > 0) this.wave(e, f.waveR);
    }
    for (const p of s.projectiles) {
      if (p.kind !== 'glass_spit') continue;
      const lx = p.x + p.vx * p.lifeLeft;
      const ly = p.y + p.vy * p.lifeLeft;
      const land = this.landRadius(s, p.ownerId);
      const k = 1 - Math.min(1, p.lifeLeft / 0.6);
      this.put(this.pool, this.t.shadow, lx, ly, 0.8 + land * k, 0.4 + land * 0.5 * k, 0xffffff, 0.6 + 0.4 * k);
      this.put(this.pool, this.t.ring, lx, ly, land, land, T.edge, 0.85);
      this.put(this.pool, this.glassTex, p.x, p.y - 1.5, 1.1, 1.1, 0xffffff, 1, this.time * 6);
    }
  }

  /** The toll's ring wave: a bright band at the front, red-magenta edges, the stop circle. */
  private wave(e: Enemy, r: number): void {
    const a = e.attack;
    const def = isEnemyKind(e.kind) ? attackByName(e.kind, a.name) : null;
    const width = def?.wave?.width ?? 3;
    const max = def && def.shape.kind === 'circle' ? def.shape.r : r;
    const x = a.originX;
    const y = a.originY;
    this.put(this.pool, this.t.ring, x, y, max, max, T.edge, 0.7);
    const n = Math.max(12, Math.ceil((TAU * r) / 1.1));
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU;
      const px = x + Math.cos(ang) * r;
      const py = y + Math.sin(ang) * r;
      this.put(this.pool, this.t.dot, px, py, width * 0.55, width * 0.55, BELL.tollGlow, 0.5);
      if (i % 2 === 0) this.put(this.over, this.t.dot, px, py, width * 0.25, width * 0.25, 0xffffff, 0.6);
    }
    const h = width / 2;
    this.put(this.pool, this.t.ring, x, y, r + h, r + h, T.edge, 1);
    if (r > h) this.put(this.pool, this.t.ring, x, y, r - h, r - h, T.edge, 0.8);
  }

  /** Gold (or violet) sound rings rolling out across the toll's marker. */
  private soundRings(e: Enemy, u: number, tint: number): void {
    const s = e.attack.shape;
    const R = s.kind === 'circle' ? s.r : 8;
    const speed = 6 + 10 * u;
    for (let k = 0; k < 3; k++) {
      const r = (this.time * speed + (k * R) / 3) % R;
      const fade = Math.min(1, r / 2) * (1 - r / R);
      this.put(this.pool, this.t.ring, e.attack.originX, e.attack.originY, r, r, tint, (0.35 + 0.5 * u) * fade);
    }
    this.put(this.over, this.t.glow, e.x, e.y - 3, 4 + 4 * u, 4 + 4 * u, tint, 0.25 + 0.4 * u);
  }

  /** The self-toll: violet crackle on the ground it stands on. */
  private crackleUnder(e: Enemy, u: number): void {
    if (Math.random() > 0.4 + u) return;
    const a = rand(0, TAU);
    const r = rand(1, 7);
    this.put(this.over, Math.random() < 0.5 ? this.t.zapA : this.t.zapB, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.7, 1, 1, Math.random() < 0.6 ? ELEMENT.stormGlow : BELL.selfToll, 0.9, rand(0, TAU));
  }

  /** Ripples running down the lunge line toward its end. */
  private lungeRipples(e: Enemy, u: number): void {
    const s = e.attack.shape;
    if (s.kind !== 'line') return;
    const step = 4;
    const off = (this.time * 14) % step;
    for (let d = off; d < s.length; d += step) {
      const fade = Math.min(1, (s.length - d) / 4) * (0.4 + 0.6 * u);
      const r = 1.5 + (d / s.length) * 1.5;
      const p = this.put(this.pool, this.t.ring, e.attack.originX + s.dirX * d, e.attack.originY + s.dirY * d, r, r * 0.5, COIL.ripple, 0.7 * fade);
      if (p) p.rotation = 0;
    }
  }

  /** The spit's arc from the mouth to where the player stands, and the landing circle (its puddle). */
  private spitArc(e: Enemy, u: number): void {
    const a = e.attack;
    const s = a.shape;
    if (s.kind !== 'line') return;
    const st = this.state;
    const px = st ? st.player.x : a.originX + s.dirX * s.length;
    const py = st ? st.player.y : a.originY + s.dirY * s.length;
    // It lands where the player stands, along its aim line (at most the line's length).
    const d = Math.min(s.length, Math.max(4, (px - a.originX) * s.dirX + (py - a.originY) * s.dirY));
    const lx = a.originX + s.dirX * d;
    const ly = a.originY + s.dirY * d;
    const n = 10;
    for (let i = 1; i < n; i++) {
      const f = i / n;
      if (f > u * 1.3) break;
      const x = a.originX + (lx - a.originX) * f;
      const y = a.originY + (ly - a.originY) * f - Math.sin(Math.PI * f) * Math.min(8, d * 0.25);
      this.put(this.pool, this.t.dot, x, y, 0.5, 0.5, INK, 0.5 * u);
      this.put(this.pool, this.t.dot, x, y, 0.34, 0.34, COIL.glassLight, 0.95 * u);
    }
    const land = this.landRadius(st, e.id);
    this.put(this.pool, this.t.dot, lx, ly, land, land, T.fill, 0.12 + 0.15 * u);
    this.put(this.pool, this.t.ring, lx, ly, land, land, T.edge, 0.5 + 0.5 * u);
  }

  /** The puddle radius of the glass spit (data/bossesFen.ts landWater). */
  private landRadius(s: GameState | null, ownerId: number): number {
    const e = s?.enemies.find((x) => x.id === ownerId);
    const def = e && isEnemyKind(e.kind) ? attackByName(e.kind, 'glass_spit') : null;
    return def?.projectile?.landWater?.radius ?? 2;
  }

  /** The tail thrash: dust and water whirling around the circle it will sweep. */
  private whirl(e: Enemy, u: number): void {
    const s = e.attack.shape;
    const R = s.kind === 'circle' ? s.r : 7;
    const n = 8;
    for (let i = 0; i < n; i++) {
      const ang = this.time * (3 + 6 * u) + (i / n) * TAU;
      const r = R * 0.7;
      this.put(this.pool, this.t.chevron, e.attack.originX + Math.cos(ang) * r, e.attack.originY + Math.sin(ang) * r, 1.4, 1.4, T.edge, 0.4 + 0.5 * u, ang + Math.PI / 2);
    }
  }

  private splashRing(x: number, y: number, r: number, tint: number, drops: number): void {
    const ring = this.fx.spawn(this.t.ring, x, y, 0, 0, 0.45, tint, r * 0.3, r);
    if (ring) {
      ring.aspect = 0.6;
      ring.a0 = 0.9;
    }
    for (let i = 0; i < drops; i++) {
      const a = rand(0, TAU);
      const p = this.fx.spawn(this.t.dot, x, y, Math.cos(a) * rand(4, 9), Math.sin(a) * rand(2, 5) - 5, rand(0.3, 0.5), tint, 0.3, 0.1);
      if (p) p.grav = 26;
    }
  }

  private burst(x: number, y: number, n: number, tint: number, r: number): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const d = rand(0, r);
      const z = this.fx.spawn(Math.random() < 0.5 ? this.t.zapA : this.t.zapB, x + Math.cos(a) * d, y + Math.sin(a) * d, 0, 0, rand(0.1, 0.2), tint, rand(0.8, 1.4), rand(0.8, 1.4));
      if (z) z.rotation = rand(0, TAU);
    }
  }
}
