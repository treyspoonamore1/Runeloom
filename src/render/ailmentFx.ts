import { Container, Sprite, type Texture } from 'pixi.js';
import { enemyDef } from '../../data/enemies';
import type { Ailments, GameState } from '../sim';
import type { Atlas } from './atlas';
import { AilmentDebug } from './ailmentDebug';
import { freezeBurst, rand, shatterBurst, spawnHeld, thawBurst, type BurstTex } from './ailmentBursts';
import { AIL, BODY, ICON_EXTRA, type BodyBox } from './ailmentPalette';
import { AilmentParts, type PartsFrame, type PartTextures } from './ailmentParts';
import { CreatureFx, PLAYER_KEY, type CreatureBody } from './creatureFx';
import { ICON_BLIND, ICON_OIL, ICON_WET, StatusIcons } from './statusIcons';
import type { TerrainState } from '../sim/actors/terrainState';
import type { EnemyLayer } from './enemyLayer';
import { FX } from './combatPalette';
import { makeVignette } from './fxView';
import { FxLayer, ImmediatePool, type FxParticle } from './particles';
import type { PlayerView } from './playerView';

const TAU = Math.PI * 2;


/** Status icon bits for the grid states (StatusIcons.row). */
function terrainFlags(T: TerrainState): number {
  return (T.wetLeft > 0 ? ICON_WET : 0) | (T.oiledLeft > 0 ? ICON_OIL : 0) | (T.blind ? ICON_BLIND : 0);
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
  private readonly t: BurstTex;
  private playerParts: AilmentParts | null = null;
  private budget = 0;
  private rot = 0;
  private time = 0;
  /** Reused per-body input for AilmentParts.update (no per-frame allocation). */
  private readonly frame: PartsFrame = { dt: 0, burnRatio: 0, lean: 0, wet: false, oiled: false, doused: false };
  /** Grid chemistry on bodies (Wet, Oiled, falls, charge, arcs, doused Tinderlings, shields, haze). */
  readonly creature: CreatureFx;
  /** Reused per-body input for CreatureFx.body. */
  private readonly cb: CreatureBody;

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
    this.creature = new CreatureFx(atlas, this.fx, this.threat, this.norm, this.add, this.tNorm, this.glows);
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
    this.cb = { key: 0, kind: '', a: null!, terrain: null!, parts: null!, box: BODY.player, x: 0, y: 0, vx: 0, vy: 0, player: false };
  }

  get particleCount(): number {
    return this.norm.count + this.add.count + this.tNorm.count;
  }

  reset(): void {
    this.norm.clear();
    this.add.clear();
    this.tNorm.clear();
    this.playerParts?.reset();
    this.creature.reset();
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
    this.creature.begin(dt);
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
      const T = e.terrain;
      // Cheap per-enemy looks that must stay current even without ailments.
      this.creature.enemyState(v, dt);
      v.glowMul = a.freeze.timeLeft > 0 ? 0.25 : e.kind === 'tinderling' && T.wetLeft > 0 ? 0 : 1;
      let parts = v.ailParts;
      if (!anyAilment(a) && !CreatureFx.active(T) && !this.creature.hasCrackle(e.id) && !(parts && parts.active))
        continue;
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
      f.wet = T.wetLeft > 0;
      f.oiled = T.oiledLeft > 0;
      f.doused = e.kind === 'tinderling' && f.wet;
      parts.update(a, f);
      const rx = v.root.x;
      const ry = v.root.y;
      if (rx < vx0 || rx > vx1 || ry < vy0 || ry > vy1) continue;
      parts.draw(this.over, this.partTex, v.root.x, v.root.y + v.lift.y - v.lift.pivot.y);
      this.body(parts, a, box, v.root.x, v.root.y, vx, run, dt, this.norm);
      this.creatureBody(e.id, e.kind, a, T, parts, box, rx, ry, vx, vy, false, dt);
      const top = v.root.y + box.top - this.icons.lift - (ICON_EXTRA[e.kind] ?? 0);
      this.icons.row(a, v.root.x, top, terrainFlags(T));
      this.debug.label(a, v.root.x + box.w + 0.4, v.root.y + box.top * 0.5, xf);
    }
    this.updatePlayer(s, player, dt, xf);
    this.creature.end(dt, s, enemies, player);
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
    const T = p.terrain;
    if (!anyAilment(a) && !CreatureFx.active(T) && !this.creature.hasCrackle(PLAYER_KEY) && !(parts && parts.active))
      return;
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
    f.wet = T.wetLeft > 0;
    f.oiled = T.oiledLeft > 0;
    f.doused = false;
    parts.update(a, f);
    const x = player.root.x;
    const y = player.root.y;
    parts.draw(this.overPlayer, this.partTex, x + player.lift.x, y + player.lift.y);
    this.body(parts, a, box, x, y, p.vx, run, dt, this.tNorm);
    this.creatureBody(PLAYER_KEY, 'player', a, T, parts, box, x, y, p.vx, p.vy, true, dt);
    this.icons.row(a, x, y + box.top - this.icons.lift, terrainFlags(T));
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
    if (parts.justFroze) freezeBurst(layer, this.t, x, cy, box);
    if (parts.justThawed) thawBurst(layer, this.t, x, cy, box);
  }

  private creatureBody(key: number, kind: string, a: Ailments, T: TerrainState, parts: AilmentParts, box: BodyBox, x: number, y: number, vx: number, vy: number, player: boolean, dt: number): void {
    const b = this.cb;
    b.key = key;
    b.kind = kind;
    b.a = a;
    b.terrain = T;
    b.parts = parts;
    b.box = box;
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.player = player;
    this.creature.body(b, dt);
  }

  private spawn(layer: FxLayer, tex: Texture, x: number, y: number, vx: number, vy: number, life: number, tint: number, s0: number, s1: number): FxParticle | null {
    return spawnHeld(layer, tex, x, y, vx, vy, life, tint, s0, s1);
  }

  /** A frozen enemy died: ice shards burst out (no corpse), with a bright frost flash. */
  shatter(x: number, y: number, kind: string): void {
    shatterBurst(this.norm, this.add, this.t, x, y, kind);
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
    } else {
      const hz = this.creature.haze(s);
      if (hz) {
        alpha = hz.alpha;
        tint = hz.tint;
      } else if (!p.dead && a.chill > 0) {
        alpha = AIL.edgeChill * (a.chill / 100);
        tint = AIL.frost;
      }
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
