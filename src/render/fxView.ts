import { Container, Sprite, Texture } from 'pixi.js';
import type { DamageType } from '../../data/combatTypes';
import type { Atlas } from './atlas';
import { ENEMY, FX, INK, PROJ } from './combatPalette';
import { FxLayer, type FxParticle } from './particles';

const TAU = Math.PI * 2;

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

interface Swoosh {
  main: Sprite;
  echo: Sprite;
  t: number;
  angle: number;
  dir: number;
}

/** Spark colors per damage type for hit bursts. */
const HIT_COLORS: Record<DamageType, readonly number[]> = {
  physical: [FX.ivory, 0xffffff, FX.spark],
  fire: [PROJ.boltCore, PROJ.boltRim, 0xffe9a0],
  frost: [0x8fe3ff, 0xe6fbff],
  storm: [0xf5e04a, 0x9b7bff],
};

/**
 * Particles and one-shot effects driven by sim events. `player` holds the player's own
 * effects (dimmed by effect density, below telegraphs); `top` holds effects that must stay
 * readable (enemy shot impacts, shield clanks, the player's hurt and death), above the player.
 */
export class FxView {
  readonly player = new Container();
  readonly top = new Container();
  /** Free particles of the player's effects (also bolt embers). */
  readonly pNorm: FxLayer;
  readonly pAdd: FxLayer;
  private readonly tNorm: FxLayer;
  private readonly tAdd: FxLayer;
  private readonly swooshLayer = new Container();
  private readonly swooshes: Swoosh[] = [];
  private swingDir = 1;
  /** Screen-space red vignette for player hurt. */
  readonly vignette: Sprite;
  private vignetteT = 0;

  constructor(private readonly atlas: Atlas) {
    const t = atlas.get('dot');
    const cap = FX.maxParticles / 4;
    this.pNorm = new FxLayer(t, cap);
    this.pAdd = new FxLayer(t, cap, 'add');
    this.tNorm = new FxLayer(t, cap);
    this.tAdd = new FxLayer(t, cap, 'add');
    this.player.addChild(this.pNorm.container, this.swooshLayer, this.pAdd.container);
    this.top.addChild(this.tNorm.container, this.tAdd.container);
    for (let i = 0; i < 6; i++) {
      const main = new Sprite(atlas.get('crescent'));
      const echo = new Sprite(atlas.get('crescent'));
      main.visible = echo.visible = false;
      this.swooshLayer.addChild(echo, main);
      this.swooshes.push({ main, echo, t: 1, angle: 0, dir: 1 });
    }
    this.vignette = new Sprite(makeVignette());
    this.vignette.alpha = 0;
    this.vignette.tint = FX.hurt;
  }

  get particleCount(): number {
    return this.pNorm.count + this.pAdd.count + this.tNorm.count + this.tAdd.count;
  }

  reset(): void {
    for (const l of [this.pNorm, this.pAdd, this.tNorm, this.tAdd]) l.clear();
    for (const s of this.swooshes) {
      s.t = 1;
      s.main.visible = s.echo.visible = false;
    }
    this.vignetteT = 0;
  }

  update(dt: number, screenW: number, screenH: number): void {
    this.pNorm.update(dt);
    this.pAdd.update(dt);
    this.tNorm.update(dt);
    this.tAdd.update(dt);
    for (const s of this.swooshes) {
      if (s.t >= 1) continue;
      s.t += dt / FX.strikeTime;
      if (s.t >= 1) {
        s.main.visible = s.echo.visible = false;
        continue;
      }
      const u = s.t;
      const sweep = (1 - (1 - u) * (1 - u)) * 0.9 - 0.55;
      s.main.rotation = s.angle + sweep * s.dir;
      s.echo.rotation = s.angle + (sweep - 0.28) * s.dir;
      const sc = 0.85 + 0.2 * u;
      s.main.scale.set(sc, sc * s.dir);
      s.echo.scale.set(sc * 0.96, sc * 0.96 * s.dir);
      s.main.alpha = u < 0.35 ? 1 : 1 - (u - 0.35) / 0.65;
      s.echo.alpha = s.main.alpha * 0.4;
    }
    this.vignetteT = Math.max(0, this.vignetteT - dt);
    this.vignette.alpha = FX.vignetteAlpha * (this.vignetteT / FX.vignetteTime) ** 1.5;
    this.vignette.visible = this.vignette.alpha > 0.003;
    this.vignette.width = screenW;
    this.vignette.height = screenH;
  }

  // ---- building blocks ----------------------------------------------------------------------

  /** Radial burst of `n` particles. */
  private burst(
    layer: FxLayer,
    tex: string,
    x: number,
    y: number,
    n: number,
    speed: [number, number],
    life: [number, number],
    colors: readonly number[],
    size: [number, number],
    opts: { drag?: number; grav?: number; spin?: number; align?: number; dir?: number; spread?: number; a0?: number; jitter?: number } = {},
  ): void {
    const t = this.atlas.get(tex);
    for (let i = 0; i < n; i++) {
      const ang = opts.dir !== undefined ? opts.dir + rand(-1, 1) * (opts.spread ?? 0.6) : rand(0, TAU);
      const sp = rand(speed[0], speed[1]);
      const j = opts.jitter ?? 0;
      const p = layer.spawn(
        t,
        x + rand(-j, j),
        y + rand(-j, j),
        Math.cos(ang) * sp,
        Math.sin(ang) * sp,
        rand(life[0], life[1]),
        colors[i % colors.length]!,
        size[0],
        size[1],
      );
      if (!p) return;
      p.drag = opts.drag ?? 3;
      p.grav = opts.grav ?? 0;
      p.a0 = opts.a0 ?? 1;
      p.hold = 0.4;
      if (opts.align !== undefined) {
        p.align = true;
        p.stretch = opts.align;
      } else {
        p.rotation = rand(0, TAU);
        p.spin = rand(-1, 1) * (opts.spin ?? 0);
      }
    }
  }

  private one(layer: FxLayer, tex: string, x: number, y: number, life: number, tint: number, s0: number, s1: number, a0 = 1, rot = 0): FxParticle | null {
    const p = layer.spawn(this.atlas.get(tex), x, y, 0, 0, life, tint, s0, s1);
    if (p) {
      p.a0 = a0;
      p.rotation = rot;
    }
    return p;
  }

  /** Dark-backed star: reads on light and dark ground alike. */
  private glint(layer: FxLayer, x: number, y: number, size: number, color: number, life: number, rot = 0): void {
    this.one(layer, 'star', x, y, life, INK, size * 1.35, size * 0.5, 0.8, rot);
    this.one(layer, 'star', x, y, life, color, size, size * 0.35, 1, rot);
  }

  // ---- events ---------------------------------------------------------------------------------

  strike(x: number, y: number, dirX: number, dirY: number): void {
    let s = this.swooshes[0]!;
    for (const c of this.swooshes) if (c.t > s.t) s = c;
    this.swingDir = -this.swingDir;
    s.t = 0;
    s.angle = Math.atan2(dirY, dirX);
    s.dir = this.swingDir;
    s.main.position.set(x, y);
    s.echo.position.set(x, y);
    s.main.visible = s.echo.visible = true;
  }

  castFlash(x: number, y: number, dirX: number, dirY: number): void {
    this.one(this.pAdd, 'glow', x, y, FX.castFlashTime * 1.5, PROJ.boltGlow, 2.6, 1.2, 0.8);
    this.glint(this.pNorm, x, y, 1.1, PROJ.boltCore, FX.castFlashTime, rand(0, 1));
    this.burst(this.pNorm, 'spark', x, y, 4, [14, 26], [0.1, 0.18], [PROJ.boltCore, PROJ.boltRim], [1.1, 0.4], {
      dir: Math.atan2(dirY, dirX),
      spread: 0.7,
      align: 0.03,
      drag: 6,
    });
  }

  castFizzle(x: number, y: number): void {
    this.burst(this.pNorm, 'puff', x, y, 3, [1, 3], [0.25, 0.4], [0x8a8090], [0.35, 0.7], { a0: 0.6, grav: -4 });
  }

  /** A projectile ended. Player bolts fizz orange; enemy arrows spark in the danger color. */
  projectileEnd(x: number, y: number, enemy: boolean, reason: string): void {
    const layer = enemy ? this.tNorm : this.pNorm;
    const add = enemy ? this.tAdd : this.pAdd;
    const hot = enemy ? [PROJ.arrowDanger, 0xff8a4a, 0xffd27a] : [PROJ.boltCore, PROJ.boltRim, 0xfff3c6];
    if (reason === 'hit') {
      this.one(add, 'glow', x, y, 0.16, enemy ? PROJ.arrowDanger : PROJ.boltGlow, 3.2, 1.5, 0.9);
      this.one(layer, 'ring', x, y, 0.2, hot[0]!, 0.6, 3.2, 0.9);
      this.burst(layer, 'spark', x, y, enemy ? 6 : 8, [14, 30], [0.12, 0.25], hot, [1.1, 0.4], { align: 0.025, drag: 5 });
      this.burst(layer, 'puff', x, y, 2, [1, 3], [0.3, 0.5], [FX.smoke], [0.4, 0.9], { a0: 0.45, grav: -5 });
    } else if (reason === 'wall') {
      this.one(add, 'glow', x, y, 0.12, enemy ? PROJ.arrowDanger : PROJ.boltGlow, 2.2, 1, 0.7);
      this.burst(layer, 'puff', x, y, 4, [2, 6], [0.3, 0.55], [FX.dust, 0xe8d7b8], [0.5, 1.0], { a0: 0.8, drag: 4 });
      this.burst(layer, 'spark', x, y, 5, [10, 22], [0.1, 0.2], hot, [0.9, 0.3], { align: 0.025, drag: 5 });
      if (enemy) this.burst(layer, 'chip', x, y, 3, [6, 12], [0.3, 0.5], [ENEMY.ember_archer.arrowShaft], [0.45, 0.35], { spin: 12, drag: 4 });
    } else if (reason === 'expired') {
      this.burst(layer, 'puff', x, y, 3, [1, 3], [0.3, 0.5], [FX.smoke], [0.4, 0.8], { a0: 0.5, grav: -4 });
      this.one(add, 'glow', x, y, 0.2, enemy ? PROJ.arrowDanger : PROJ.boltGlow, 1.6, 0.4, 0.6);
    } else {
      this.burst(layer, 'puff', x, y, 2, [1, 3], [0.25, 0.4], [FX.smoke], [0.4, 0.7], { a0: 0.5 });
    }
  }

  /** Shield block: a white clank star and sparks thrown back off the shield. */
  shieldBlock(x: number, y: number, awayX: number, awayY: number): void {
    const dir = Math.atan2(awayY, awayX);
    this.glint(this.tNorm, x, y, 1.9, FX.clank, 0.16, rand(0, 1));
    this.one(this.tNorm, 'ring', x, y, 0.18, FX.clank, 0.5, 2.6, 0.9);
    this.burst(this.tNorm, 'spark', x, y, 9, [16, 34], [0.12, 0.26], [0xffffff, FX.spark, 0xffd27a], [1.2, 0.4], {
      dir,
      spread: 1.1,
      align: 0.03,
      drag: 5,
    });
    this.burst(this.tNorm, 'splinter', x, y, 2, [6, 12], [0.3, 0.5], [0xffffff], [0.5, 0.4], { dir, spread: 1.2, spin: 14 });
  }

  /** Damage landed on an enemy. */
  hitEnemy(x: number, y: number, kind: string, type: DamageType, crit: boolean, kbX: number, kbY: number): void {
    const dir = kbX !== 0 || kbY !== 0 ? Math.atan2(kbY, kbX) : undefined;
    const n = crit ? 9 : 5;
    this.burst(this.pNorm, 'spark', x, y, n, [12, 26], [0.1, 0.22], HIT_COLORS[type], [crit ? 1.3 : 1, 0.35], {
      dir,
      spread: dir === undefined ? 3.2 : 0.9,
      align: 0.03,
      drag: 6,
      jitter: 0.4,
    });
    if (crit) this.glint(this.pNorm, x, y - 0.5, 1.7, 0xffd23f, 0.18, rand(0, 1));
    if (kind === 'dummy') {
      this.burst(this.pNorm, 'straw', x, y - 0.3, 4, [5, 12], [0.4, 0.7], [0xffffff], [0.8, 0.7], { dir, spread: 1.4, spin: 10, drag: 3, grav: 10 });
    }
  }

  /** An enemy died: a kind-specific burst. */
  death(x: number, y: number, kind: string): void {
    const L = this.pNorm;
    if (kind === 'tinderling') {
      const c = ENEMY.tinderling;
      this.one(this.pAdd, 'glow', x, y, 0.3, c.glow, 4, 2, 0.9);
      this.burst(L, 'dot', x, y, 14, [6, 18], [0.35, 0.7], [c.flameOuter, c.flameInner, c.flameCore], [0.3, 0.08], { grav: -8, drag: 2.5, jitter: 0.5 });
      this.burst(L, 'puff', x, y, 4, [1, 4], [0.5, 0.8], [FX.ash, FX.smoke], [0.6, 1.2], { a0: 0.7, grav: -5, jitter: 0.6 });
      this.burst(L, 'chip', x, y, 4, [5, 10], [0.4, 0.6], [c.coal], [0.45, 0.35], { spin: 10, drag: 3 });
    } else if (kind === 'shieldbearer') {
      const c = ENEMY.shieldbearer;
      this.burst(L, 'splinter', x, y, 12, [8, 20], [0.5, 0.9], [0xffffff, 0xd8c0a0], [1.1, 0.8], { spin: 14, drag: 3.5, jitter: 1 });
      this.burst(L, 'chip', x, y, 6, [6, 14], [0.4, 0.7], [c.armorLight, c.helm], [0.55, 0.4], { spin: 10, drag: 3 });
      this.burst(L, 'puff', x, y + 0.8, 6, [2, 6], [0.5, 0.8], [FX.dust, 0xe8d7b8], [0.8, 1.5], { a0: 0.8, drag: 3, jitter: 1.2 });
    } else if (kind === 'ember_archer') {
      const c = ENEMY.ember_archer;
      this.burst(L, 'chip', x, y, 8, [6, 15], [0.45, 0.8], [c.cloak, c.cloakShade, c.hood], [0.6, 0.45], { spin: 9, drag: 3 });
      this.burst(L, 'dot', x, y, 8, [5, 14], [0.3, 0.6], [c.eye, c.arrowTip], [0.25, 0.06], { grav: -6, drag: 2.5 });
      this.burst(L, 'splinter', x, y, 3, [6, 12], [0.4, 0.7], [0x6b4a3a], [0.8, 0.6], { spin: 12 });
      this.burst(L, 'puff', x, y + 0.5, 4, [1, 4], [0.5, 0.8], [FX.dust], [0.6, 1.1], { a0: 0.7, drag: 3 });
    } else {
      this.burst(L, 'puff', x, y, 6, [2, 6], [0.4, 0.7], [FX.dust], [0.6, 1.2], { a0: 0.8 });
    }
  }

  spawnPuff(x: number, y: number): void {
    this.burst(this.tNorm, 'puff', x, y + 0.6, 5, [3, 7], [0.3, 0.5], [FX.dust, 0xe8d7b8], [0.6, 1.0], { a0: 0.7, drag: 5, jitter: 0.6 });
  }

  playerHurt(x: number, y: number): void {
    this.vignetteT = FX.vignetteTime;
    this.burst(this.tNorm, 'spark', x, y, 5, [10, 20], [0.1, 0.2], [FX.hurt, 0xffd0d0], [1, 0.3], { align: 0.03, drag: 6 });
  }

  evaded(x: number, y: number): void {
    this.glint(this.tNorm, x + 1.2, y - 2.2, 1.0, FX.evade, 0.3, 0.4);
    this.one(this.tNorm, 'ring', x, y, 0.25, FX.evade, 1.6, 2.8, 0.7);
  }

  /** The Loomwright unravels: threads spill out and fall away. */
  playerDeath(x: number, y: number): void {
    this.burst(this.tNorm, 'thread', x, y - 0.5, 26, [4, 14], [0.7, 1.2], [FX.thread, FX.threadBlue, 0x3d4cb0], [0.9, 0.6], {
      spin: 5,
      drag: 2,
      grav: 6,
      jitter: 1.2,
    });
    this.burst(this.tNorm, 'dot', x, y - 0.5, 10, [3, 9], [0.5, 0.9], [FX.thread], [0.22, 0.05], { grav: -4, drag: 2 });
  }

  /** Threads converge on the respawn point; the player view fades the body in after them. */
  playerRespawn(x: number, y: number): void {
    const t = this.atlas.get('thread');
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU + rand(-0.1, 0.1);
      const r = rand(4, 7);
      const life = FX.reweaveTime * rand(0.45, 0.6);
      const sx = x + Math.cos(a) * r;
      const sy = y - 0.5 + Math.sin(a) * r;
      const p = this.tNorm.spawn(t, sx, sy, (x - sx) / life, (y - 0.5 - sy) / life, life, i % 2 ? FX.thread : FX.threadBlue, 0.9, 0.4);
      if (!p) return;
      p.align = true;
      p.hold = 0.8;
    }
    this.one(this.tAdd, 'glow', x, y - 0.5, FX.reweaveTime, FX.thread, 1, 4, 0.6);
  }
}

/** Red-edged radial vignette, transparent in the middle. */
function makeVignette(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 60, 128, 128, 182);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,1)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return Texture.from(c);
}
