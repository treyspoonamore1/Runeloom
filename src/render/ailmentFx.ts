import { Container, Sprite, type Texture } from 'pixi.js';
import { enemyDef } from '../../data/enemies';
import type { Ailments, GameState } from '../sim';
import type { Atlas } from './atlas';
import { AilmentDebug } from './ailmentDebug';
import { AIL, BODY, ICON_EXTRA, type BodyBox } from './ailmentPalette';
import { AilmentParts, type PartsFrame, type PartTextures } from './ailmentParts';
import type { EnemyLayer } from './enemyLayer';
import { FX } from './combatPalette';
import { makeVignette } from './fxView';
import { FxLayer, ImmediatePool, type FxParticle } from './particles';
import type { PlayerView } from './playerView';
import { StatusIcons } from './statusIcons';

const TAU = Math.PI * 2;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function anyAilment(a: Ailments): boolean {
  return a.ignite.timeLeft > 0 || a.chill > 0 || a.freeze.timeLeft > 0 || a.shock.timeLeft > 0;
}

/** Camera transform for screen-space labels. */
export interface ScreenXf {
  scale: number;
  ox: number;
  oy: number;
  screenScale: number;
}

/**
 * Entity ailment visuals (DESIGN §6.4, §14), read from `ailments` on every enemy and the player
 * each frame: body-attached parts (AilmentParts), warm glows under burning bodies, shed embers,
 * frost flakes and storm sparks, status icons, the freeze/thaw/shatter bursts, the player's
 * screen-edge tint and the numeric debug labels. Render-only: never writes the sim.
 *
 * Layers (added by the renderer): `glows` under the bodies; `fx` (dimmed with the player's
 * effects) and `threat` (the player's own ailments, never dimmed) above them; `icons` above
 * everything in the world; `edge` and `debug.labels` in screen space.
 */
export class AilmentFx {
  readonly glows: ImmediatePool;
  /** Flames, crystals and arcs on enemies, right above the bodies (never dimmed: they are status). */
  readonly over: ImmediatePool;
  private readonly overPlayer: ImmediatePool;
  private readonly partTex: PartTextures;
  readonly fx = new Container();
  readonly threat = new Container();
  readonly icons: StatusIcons;
  readonly edge: Sprite;
  readonly debug = new AilmentDebug();
  private readonly norm: FxLayer;
  private readonly add: FxLayer;
  private readonly tNorm: FxLayer;
  private readonly t: Record<'dot' | 'glow' | 'spark' | 'crystal' | 'shard' | 'ring' | 'star' | 'puff', Texture>;
  private playerParts: AilmentParts | null = null;
  private budget = 0;
  private rot = 0;
  private time = 0;
  /** Reused per-body input for AilmentParts.update (no per-frame allocation). */
  private readonly frame: PartsFrame = { dt: 0, burnRatio: 0, lean: 0 };

  constructor(private readonly atlas: Atlas) {
    const dot = atlas.get('dot');
    this.glows = new ImmediatePool(atlas.get('glow'), 512, 'add');
    this.over = new ImmediatePool(atlas.get('ail_flame'), 3072);
    this.overPlayer = new ImmediatePool(atlas.get('ail_flame'), 32);
    this.partTex = {
      flame: atlas.get('ail_flame'),
      crystal: atlas.get('frost_crystal'),
      zapA: atlas.get('zap_a'),
      zapB: atlas.get('zap_b'),
    };
    this.norm = new FxLayer(dot, 1200);
    this.add = new FxLayer(dot, 200, 'add');
    this.tNorm = new FxLayer(dot, 200);
    this.fx.addChild(this.norm.container, this.add.container);
    this.threat.addChild(this.overPlayer.container, this.tNorm.container);
    this.icons = new StatusIcons(atlas, 2048);
    this.edge = new Sprite(makeVignette());
    this.edge.alpha = 0;
    this.edge.visible = false;
    this.t = {
      dot,
      glow: atlas.get('glow'),
      spark: atlas.get('spark'),
      crystal: atlas.get('frost_crystal'),
      shard: atlas.get('shard'),
      ring: atlas.get('ring'),
      star: atlas.get('star'),
      puff: atlas.get('puff'),
    };
  }

  get particleCount(): number {
    return this.norm.count + this.add.count + this.tNorm.count;
  }

  reset(): void {
    this.norm.clear();
    this.add.clear();
    this.tNorm.clear();
    this.playerParts?.reset();
    this.edge.visible = false;
  }

  update(
    s: GameState,
    enemies: EnemyLayer,
    player: PlayerView,
    dt: number,
    xf: ScreenXf,
    screenW: number,
    screenH: number,
    debug: boolean,
  ): void {
    this.time += dt;
    // Spawn allowance for this frame; a fraction carries over so slow frames still emit.
    this.budget = Math.min(this.budget, 1) + AIL.spawnBudget * dt;
    this.glows.begin();
    this.over.begin();
    this.overPlayer.begin();
    this.icons.begin(dt, xf.screenScale / xf.scale);
    this.debug.begin(debug);
    // Visible world rect (plus a margin): off-screen bodies keep their state but draw nothing.
    const m = 6;
    const vx0 = -xf.ox / xf.scale - m;
    const vy0 = -xf.oy / xf.scale - m;
    const vx1 = (screenW - xf.ox) / xf.scale + m;
    const vy1 = (screenH - xf.oy) / xf.scale + m;
    // Start at a rotating offset so the spawn budget is shared fairly in big crowds.
    const list = s.enemies;
    const n = list.length;
    const start = n > 0 ? this.rot++ % n : 0;
    for (let k = 0; k < n; k++) {
      const e = list[(k + start) % n]!;
      if (e.dead) continue;
      const v = enemies.view(e.id);
      if (!v || v.dying >= 0) continue;
      const a = e.ailments;
      let parts = v.ailParts;
      if (!anyAilment(a) && !(parts && parts.active)) continue;
      const box = BODY[e.kind];
      if (!parts) {
        parts = v.ailParts = new AilmentParts(this.atlas, box, v.root);
        v.lift.addChild(parts.root);
      }
      const speed = enemyDef(e.kind).speed;
      const vx = (e.x - e.prevX) * 60;
      const vy = (e.y - e.prevY) * 60;
      const run = speed > 0 ? Math.min(1, Math.hypot(vx, vy) / speed) : 0;
      const lean = speed > 0 ? Math.max(-1, Math.min(1, vx / speed)) : 0;
      // Tinderlings burn already (and can't be ignited): never stack a second fire on them.
      const burnRatio = e.kind === 'tinderling' ? -1 : a.ignite.dps / e.maxLife;
      const f = this.frame;
      f.dt = dt;
      f.burnRatio = burnRatio;
      f.lean = lean;
      parts.update(a, f);
      v.glowMul = a.freeze.timeLeft > 0 ? 0.25 : 1;
      const rx = v.root.x;
      const ry = v.root.y;
      if (rx < vx0 || rx > vx1 || ry < vy0 || ry > vy1) continue;
      parts.draw(this.over, this.partTex, v.root.x, v.root.y + v.lift.y - v.lift.pivot.y);
      this.body(parts, a, box, v.root.x, v.root.y, vx, run, dt, this.norm);
      const top = v.root.y + box.top - this.icons.lift - (ICON_EXTRA[e.kind] ?? 0);
      this.icons.row(a, v.root.x, top);
      this.debug.label(a, v.root.x + box.w + 0.4, v.root.y + box.top * 0.5, xf);
    }
    this.updatePlayer(s, player, dt, xf);
    this.glows.end();
    this.over.end();
    this.overPlayer.end();
    this.icons.end();
    this.debug.end();
    this.norm.update(dt);
    this.add.update(dt);
    this.tNorm.update(dt);
    this.updateEdge(s, dt, screenW, screenH);
  }

  private updatePlayer(s: GameState, player: PlayerView, dt: number, xf: ScreenXf): void {
    const p = s.player;
    const a = p.ailments;
    let parts = this.playerParts;
    if (p.dead) {
      if (parts) parts.root.visible = false;
      return;
    }
    if (!anyAilment(a) && !(parts && parts.active)) return;
    const box = BODY.player;
    if (!parts) {
      parts = this.playerParts = new AilmentParts(this.atlas, box, player.lift);
      player.lift.addChild(parts.root);
    }
    parts.root.visible = true;
    const speed = s.tuning.player.moveSpeed;
    const run = speed > 0 ? Math.min(1, Math.hypot(p.vx, p.vy) / speed) : 0;
    const lean = speed > 0 ? Math.max(-1, Math.min(1, p.vx / speed)) : 0;
    const f = this.frame;
    f.dt = dt;
    f.burnRatio = a.ignite.dps / Math.max(1, p.maxLife);
    f.lean = lean;
    parts.update(a, f);
    const x = player.root.x;
    const y = player.root.y;
    parts.draw(this.overPlayer, this.partTex, x + player.lift.x, y + player.lift.y);
    this.body(parts, a, box, x, y, p.vx, run, dt, this.tNorm);
    this.icons.row(a, x, y + box.top - this.icons.lift);
    this.debug.label(a, x + box.w + 0.4, y + box.top * 0.5, xf);
  }

  /** Glow, shed particles and freeze/thaw bursts for one body at (x, y). */
  private body(
    parts: AilmentParts,
    a: Ailments,
    box: BodyBox,
    x: number,
    y: number,
    vx: number,
    run: number,
    dt: number,
    layer: FxLayer,
  ): void {
    const h = box.bottom - box.top;
    const cy = y + (box.top + box.bottom) / 2;
    if (parts.burn > 0) {
      const g = this.glows.next(this.t.glow);
      if (g) {
        const n = 0.5 * Math.sin(this.time * 13 + x) + 0.5 * Math.sin(this.time * 29 + y);
        g.x = x;
        g.y = cy - h * 0.1;
        g.scaleX = g.scaleY = AIL.igniteGlowScale * box.w * (0.75 + 0.25 * parts.burn + 0.06 * n);
        g.paint(AIL.fire, AIL.igniteGlowAlpha * parts.burn);
      }
      parts.emberAcc += dt * parts.burn * (AIL.emberRate + AIL.emberRunRate * run);
      if (parts.emberAcc > 2) parts.emberAcc = 2; // starved by the frame budget: don't bank a burst
      while (parts.emberAcc >= 1) {
        parts.emberAcc -= 1;
        if (this.budget < 1) break;
        this.budget--;
        const c = Math.random();
        const p = this.spawn(layer, this.t.dot, x + rand(-0.7, 0.7) * box.w, y + box.top + rand(0.1, 0.55) * h, -vx * 0.3 + rand(-1.5, 1.5), -rand(3, 7), rand(0.35, 0.7), c < 0.4 ? AIL.fire : c < 0.8 ? AIL.fireInner : AIL.fireCore, rand(0.16, 0.26), 0.04);
        if (p) {
          p.grav = -5;
          p.drag = 1.5;
        }
      }
    }
    const frozen = a.freeze.timeLeft > 0;
    if (!frozen && a.chill > AIL.crystalFrom) {
      parts.flakeAcc += dt * AIL.flakeRate * (a.chill / 100);
      if (parts.flakeAcc > 2) parts.flakeAcc = 2; // starved by the frame budget: don't bank a burst
      while (parts.flakeAcc >= 1) {
        parts.flakeAcc -= 1;
        if (this.budget < 1) break;
        this.budget--;
        const p = this.spawn(layer, this.t.crystal, x + rand(-0.8, 0.8) * box.w, y + box.top + rand(0.1, 0.7) * h, rand(-0.8, 0.8), rand(0.8, 2), rand(0.6, 1), 0xffffff, 0.3, 0.12);
        if (p) p.spin = rand(-3, 3);
      }
    }
    if (a.shock.timeLeft > 0) {
      const k = Math.min(1, Math.max(0, (a.shock.effect - 0.05) / 0.45));
      parts.sparkAcc += dt * (1 + 6 * k);
      if (parts.sparkAcc > 2) parts.sparkAcc = 2; // starved by the frame budget: don't bank a burst
      while (parts.sparkAcc >= 1) {
        parts.sparkAcc -= 1;
        if (this.budget < 1) break;
        this.budget--;
        const ang = rand(0, TAU);
        const sp = rand(8, 16);
        const p = this.spawn(layer, this.t.spark, x + rand(-0.6, 0.6) * box.w, y + box.top + rand(0.2, 0.8) * h, Math.cos(ang) * sp, Math.sin(ang) * sp, rand(0.08, 0.16), Math.random() < 0.5 ? AIL.storm : AIL.stormGlow, 0.8, 0.3);
        if (p) {
          p.align = true;
          p.stretch = 0.03;
          p.drag = 6;
        }
      }
    }
    if (parts.justFroze) this.freezeBurst(x, cy, box, layer);
    if (parts.justThawed) this.thawBurst(x, cy, box, layer);
  }

  private spawn(layer: FxLayer, tex: Texture, x: number, y: number, vx: number, vy: number, life: number, tint: number, s0: number, s1: number): FxParticle | null {
    const p = layer.spawn(tex, x, y, vx, vy, life, tint, s0, s1);
    if (p) p.hold = 0.4;
    return p;
  }

  /** Radial burst of n particles. */
  private burst(layer: FxLayer, tex: Texture, x: number, y: number, n: number, sp: [number, number], life: [number, number], tints: readonly number[], s: [number, number], jitter: number, cfg: (p: FxParticle) => void): void {
    for (let i = 0; i < n; i++) {
      const ang = rand(0, TAU);
      const v = rand(sp[0], sp[1]);
      const p = this.spawn(layer, tex, x + rand(-jitter, jitter), y + rand(-jitter, jitter), Math.cos(ang) * v, Math.sin(ang) * v, rand(life[0], life[1]), tints[i % tints.length]!, s[0], s[1]);
      if (!p) return;
      p.rotation = rand(0, TAU);
      cfg(p);
    }
  }

  /** Crystallize: a cold ring snaps inward and glints flash on the block. */
  private freezeBurst(x: number, y: number, box: BodyBox, layer: FxLayer): void {
    const r = Math.max(box.w, (box.bottom - box.top) / 2);
    const ring = this.spawn(layer, this.t.ring, x, y, 0, 0, 0.2, AIL.frost, r * 1.8, r * 0.9);
    if (ring) ring.hold = 0;
    this.burst(layer, this.t.star, x, y, 3, [0, 0], [0.18, 0.28], [0xffffff], [0.9, 0.2], r * 0.6, (p) => (p.a0 = 0.9));
    this.burst(layer, this.t.crystal, x, y, 5, [4, 8], [0.25, 0.4], [0xffffff], [0.4, 0.15], r * 0.4, (p) => {
      p.drag = 5;
      p.spin = rand(-6, 6);
    });
  }

  /** Thaw: the block cracks, a few chips fall and water drips. */
  private thawBurst(x: number, y: number, box: BodyBox, layer: FxLayer): void {
    const r = Math.max(box.w, (box.bottom - box.top) / 2);
    this.burst(layer, this.t.shard, x, y, 5, [3, 8], [0.35, 0.55], [AIL.ice, 0xffffff], [0.7, 0.45], r * 0.6, (p) => {
      p.spin = rand(-8, 8);
      p.grav = 18;
      p.drag = 2;
    });
    this.burst(layer, this.t.dot, x, y + r * 0.3, 7, [1, 4], [0.35, 0.6], [AIL.water, 0xd8f4ff], [0.16, 0.1], r * 0.8, (p) => {
      p.grav = 22;
    });
    this.burst(layer, this.t.puff, x, y, 3, [1, 3], [0.4, 0.6], [0xe8f8ff], [0.5, 1.1], r * 0.5, (p) => {
      p.a0 = 0.5;
      p.grav = -3;
    });
  }

  /** A frozen enemy died: ice shards burst out (no corpse), with a bright frost flash. */
  shatter(x: number, y: number, kind: string): void {
    const box = BODY[kind as keyof typeof BODY] ?? BODY.tinderling;
    const cy = y + (box.top + box.bottom) / 2;
    const r = Math.max(box.w, (box.bottom - box.top) / 2);
    const L = this.norm;
    // Frost flash: a short cold bloom (normal blend: additive bleaches light ground) and a white core.
    const flash = this.spawn(L, this.t.glow, x, cy, 0, 0, 0.2, AIL.frost, r * 2.2, r * 2.8);
    if (flash) {
      flash.hold = 0.1;
      flash.a0 = 0.8;
    }
    const core = this.spawn(this.add, this.t.glow, x, cy, 0, 0, 0.1, 0xffffff, r * 1.3, r * 0.8);
    if (core) core.hold = 0.3;
    const ring = this.spawn(L, this.t.ring, x, cy, 0, 0, 0.24, AIL.frost, r * 0.8, r * 2.6);
    if (ring) ring.hold = 0.1;
    this.burst(L, this.t.shard, x, cy, AIL.shatterShards, [10, 24], [0.5, 0.9], [AIL.ice, 0xffffff, 0x9fdcff, 0xd8f4ff], [1.25, 0.8], r * 0.5, (p) => {
      p.spin = rand(-14, 14);
      p.drag = 3;
      p.grav = 14;
    });
    this.burst(L, this.t.shard, x, cy, 8, [3, 9], [0.4, 0.7], [0xffffff, AIL.ice], [0.8, 0.55], r * 0.7, (p) => {
      p.spin = rand(-10, 10);
      p.drag = 2;
      p.grav = 18;
    });
    this.burst(L, this.t.star, x, cy, 4, [2, 6], [0.15, 0.3], [0xffffff], [1.2, 0.3], r * 0.8, (p) => (p.drag = 4));
    this.burst(L, this.t.puff, x, cy, 5, [1, 4], [0.5, 0.8], [0xeafaff, 0xcfeefc], [0.7, 1.6], r * 0.6, (p) => {
      p.a0 = 0.55;
      p.drag = 2;
      p.grav = -2;
    });
  }

  /** Subtle screen-edge tint while the player burns, is chilled or frozen (never dimmed). */
  private updateEdge(s: GameState, dt: number, w: number, h: number): void {
    const p = s.player;
    const a = p.ailments;
    let alpha = 0;
    let tint: number = FX.hurt;
    if (!p.dead && a.freeze.timeLeft > 0) {
      alpha = AIL.edgeFrozen;
      tint = AIL.frost;
    } else if (!p.dead && a.ignite.timeLeft > 0) {
      alpha = AIL.edgeBurn * (0.8 + 0.2 * Math.sin(this.time * 9) * Math.sin(this.time * 3.7));
      tint = AIL.fire;
    } else if (!p.dead && a.chill > 0) {
      alpha = AIL.edgeChill * (a.chill / 100);
      tint = AIL.frost;
    }
    const e = this.edge;
    const k = 1 - Math.exp(-dt / 0.12);
    e.alpha += (alpha - e.alpha) * k;
    if (alpha > 0 && e.tint !== tint) e.tint = tint;
    e.visible = e.alpha > 0.004;
    e.width = w;
    e.height = h;
  }
}
