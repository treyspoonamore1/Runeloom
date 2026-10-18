import { Container, Sprite } from 'pixi.js';
import { PLAYER_ID, type Enemy, type GameState } from '../sim';
import { enemyDef, type EnemyKind } from '../../data/enemies';
import type { Atlas } from './atlas';
import { ENEMY as C } from './combatPalette';
import { BOW_TIP_X, BOW_TIP_Y } from './enemyShapes';
import type { FxParticle } from './particles';

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
/** Shortest signed angle from a to b. */
function angleDelta(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

/** Per-kind layout: shadow size, feet height (lift pivot), face offset scale. */
const LAYOUT: Record<EnemyKind, { shadowRx: number; shadowRy: number; shadowY: number; foot: number }> = {
  tinderling: { shadowRx: 1.25, shadowRy: 0.55, shadowY: 0.75, foot: 0.85 },
  shieldbearer: { shadowRx: 2.5, shadowRy: 1.05, shadowY: 1.55, foot: 1.6 },
  ember_archer: { shadowRx: 1.45, shadowRy: 0.65, shadowY: 1.15, foot: 1.3 },
  dummy: { shadowRx: 1.6, shadowRy: 0.65, shadowY: 1.35, foot: 1.4 },
};

const FLAME_POS = [
  [-0.55, -0.95, 0.75],
  [0.05, -1.2, 1],
  [0.55, -0.9, 0.7],
] as const;

/**
 * One enemy's look: layered atlas sprites with procedural bob, lean, facing, hit flash, squash,
 * windup anticipation and a death topple. Reads its Enemy, never writes it. Pooled per kind.
 */
export class EnemyView {
  readonly root = new Container();
  /** Bobs, leans and squashes around the feet. */
  private readonly lift = new Container();
  private readonly flash: Sprite;
  private readonly face: Sprite | null = null;
  private readonly flames: Sprite[] = [];
  private readonly legs: Sprite[] = [];
  /** Shield (shieldbearer) or bow (archer): rotated to the facing, moved behind when facing north. */
  private readonly held: Container | null = null;
  private heldBack = false;
  private readonly heldFlash: Sprite | null = null;
  private readonly strings: Sprite[] = [];
  private readonly arrow: Sprite | null = null;

  enemy: Enemy | null = null;
  shadow: FxParticle | null = null;
  glow: FxParticle | null = null;
  /** Frame stamp of the last update that saw this enemy alive. */
  seen = 0;
  /** -1 while alive; seconds since death otherwise. */
  dying = -1;

  private time = 0;
  private phase = Math.random() * 10;
  private bobPhase = 0;
  private run = 0;
  private velX = 0;
  private velY = 0;
  private face0 = 0;
  private deform = 0;
  private deformVel = 0;
  private flashT = 0;
  private recoilX = 0;
  private recoilY = 0;
  private lungeT = 0;
  private pull = 0;
  private popT = 0;
  private wobble = 0;
  private wobbleVel = 0;
  private topple = 0;
  /** Interpolated position, cells. */
  x = 0;
  y = 0;

  constructor(
    readonly kind: EnemyKind,
    atlas: Atlas,
  ) {
    const L = LAYOUT[kind];
    const sprite = (name: string) => new Sprite(atlas.get(name));
    this.lift.pivot.set(0, L.foot);
    this.lift.position.set(0, L.foot);
    if (kind === 'tinderling') {
      for (const [lx, ly] of [
        [-0.7, 0.7],
        [-0.3, 0.92],
        [0.3, 0.92],
        [0.7, 0.7],
      ] as const) {
        const leg = sprite('tinderling_leg');
        leg.position.set(lx, ly);
        this.legs.push(leg);
        this.root.addChild(leg);
      }
    } else if (kind === 'shieldbearer') {
      for (const lx of [-0.85, 0.85]) {
        const b = sprite('shieldbearer_boot');
        b.position.set(lx, 1.55);
        this.legs.push(b);
        this.root.addChild(b);
      }
    }
    this.root.addChild(this.lift);
    this.lift.addChild(sprite(`${kind}_body`));
    this.flash = sprite(`${kind}_flash`);
    this.flash.alpha = 0;
    this.lift.addChild(this.flash);
    if (kind === 'tinderling') {
      this.face = sprite('tinderling_eyes');
      for (const [fx, fy, s] of FLAME_POS) {
        const f = sprite('tinderling_flame');
        f.position.set(fx, fy);
        f.scale.set(s);
        this.flames.push(f);
      }
      this.lift.addChild(this.face, ...this.flames);
    } else if (kind === 'shieldbearer') {
      this.face = sprite('shieldbearer_visor');
      this.lift.addChild(this.face);
      this.held = new Container();
      this.heldFlash = sprite('shieldbearer_shield_flash');
      this.heldFlash.alpha = 0;
      this.held.addChild(sprite('shieldbearer_shield'), this.heldFlash);
      this.held.position.set(0, -0.2);
      this.lift.addChild(this.held);
    } else if (kind === 'ember_archer') {
      this.face = sprite('ember_archer_face');
      this.lift.addChild(this.face);
      this.held = new Container();
      for (let i = 0; i < 2; i++) {
        const s = sprite('line');
        s.tint = C.ember_archer.string;
        this.strings.push(s);
      }
      this.arrow = sprite('ember_archer_arrow');
      this.held.addChild(this.strings[0]!, this.strings[1]!, this.arrow, sprite('ember_archer_bow'));
      this.lift.addChild(this.held);
    }
  }

  /** Fresh state for a newly seen enemy. */
  bind(e: Enemy): void {
    this.enemy = e;
    this.dying = -1;
    this.time = 0;
    this.run = this.velX = this.velY = 0;
    this.face0 = Math.atan2(e.facingY, e.facingX);
    this.deform = this.deformVel = this.flashT = 0;
    this.recoilX = this.recoilY = this.lungeT = this.pull = 0;
    this.wobble = this.wobbleVel = this.topple = 0;
    this.popT = 0;
    this.root.alpha = 1;
    this.root.tint = 0xffffff;
    this.root.visible = true;
    for (const f of this.flames) f.visible = true;
  }

  hit(kbX: number, kbY: number, fromX: number, fromY: number): void {
    this.flashT = C.flashTime;
    this.deformVel += C.hitKick;
    let dx = kbX;
    let dy = kbY;
    if (dx === 0 && dy === 0) {
      dx = this.x - fromX;
      dy = this.y - fromY;
      const l = Math.hypot(dx, dy) || 1;
      dx /= l;
      dy /= l;
    }
    const r = this.kind === 'dummy' ? 0.5 : 1;
    this.recoilX = dx * C.recoil * r;
    this.recoilY = dy * C.recoil * r;
    if (this.kind === 'dummy') this.wobbleVel += (dx >= 0 ? 1 : -1) * 3.5;
  }

  attacked(): void {
    this.lungeT = 0.16;
    this.pull = 0;
  }

  shieldBlock(): void {
    if (this.heldFlash) this.heldFlash.alpha = 1;
    this.deformVel -= 2;
  }

  die(): void {
    if (this.dying >= 0) return;
    this.dying = 0;
    this.flashT = C.flashTime * 1.5;
    this.topple = (this.recoilX >= 0 ? 1 : -1) * (0.9 + Math.random() * 0.4);
    for (const f of this.flames) f.visible = false;
    if (this.arrow) this.arrow.visible = false;
  }

  /** Per-frame update of a live enemy at interpolated (x, y). */
  update(state: GameState, x: number, y: number, dt: number): void {
    const e = this.enemy!;
    this.time += dt;
    this.x = x;
    this.y = y;
    // Velocity from the last tick's actual motion (walls and knockback included).
    const k = 1 - Math.exp(-dt / 0.06);
    this.velX += ((e.x - e.prevX) * 60 - this.velX) * k;
    this.velY += ((e.y - e.prevY) * 60 - this.velY) * k;
    const def = enemyDef(e.kind);
    const speed = Math.hypot(this.velX, this.velY);
    const norm = def.speed > 0 ? 1 / def.speed : 0;
    this.run += (Math.min(1, speed * norm) - this.run) * k;

    // Facing: attack direction while attacking, else the target (archer) or the sim facing.
    let fx = e.facingX;
    let fy = e.facingY;
    const a = e.attack;
    const s = a.shape;
    if (a.phase !== 'none' && s.kind !== 'circle') {
      fx = s.dirX;
      fy = s.dirY;
    } else if (e.kind === 'ember_archer' && e.ai.targetId === PLAYER_ID) {
      const dx = state.player.x - e.x;
      const dy = state.player.y - e.y;
      const l = Math.hypot(dx, dy);
      if (l > 1e-6) {
        fx = dx / l;
        fy = dy / l;
      }
    }
    const target = Math.atan2(fy, fx);
    this.face0 += angleDelta(this.face0, target) * (1 - Math.exp(-dt / C.turnSmoothing));
    const cx = Math.cos(this.face0);
    const cy = Math.sin(this.face0);

    // Windup anticipation: lean back and crouch; lunge forward on release.
    let wind = 0;
    if (a.phase === 'windup' && def.attack) wind = smoothstep(0, 1, 1 - a.timeLeft / def.attack.windup);
    this.lungeT = Math.max(0, this.lungeT - dt);
    const lunge = this.lungeT > 0 ? Math.sin((this.lungeT / 0.16) * Math.PI) * 0.6 : 0;
    const off = lunge - wind * C.windupLean;

    // Bob and waddle.
    this.bobPhase += (speed * dt * Math.PI) / C.bobStride;
    const b = Math.abs(Math.sin(this.bobPhase + this.phase));
    const hop = b * C.bobHeight * this.run * (e.kind === 'shieldbearer' ? 0.7 : 1);
    const waddle = Math.sin(this.bobPhase + this.phase) * 0.12 * this.run;

    this.stepSprings(dt);
    const decay = Math.exp(-dt / C.recoilDecay);
    this.recoilX *= decay;
    this.recoilY *= decay;
    this.popT = Math.min(C.spawnPop, this.popT + dt);
    const pop = this.popT / C.spawnPop;
    const popScale = pop < 1 ? 0.3 + 0.7 * pop + Math.sin(pop * Math.PI) * 0.25 : 1;

    this.root.position.set(x + this.recoilX + cx * off, y + this.recoilY + cy * off * 0.6);
    this.lift.position.y = LAYOUT[this.kind].foot - hop;
    const sq = 1 + this.deform;
    const crouch = 1 - wind * C.windupSquash;
    this.lift.scale.set(popScale * (1 / sq) * (2 - crouch), popScale * sq * crouch);
    this.lift.rotation = clamp(this.velX * norm, -1, 1) * C.leanTilt + waddle + this.wobble;

    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.alpha = this.flashT > 0 ? C.flashAlpha * (this.flashT / C.flashTime) ** 0.5 : 0;
    if (this.heldFlash) this.heldFlash.alpha = Math.max(this.flash.alpha, this.heldFlash.alpha - dt * 8);

    if (this.face) {
      const vis = this.kind === 'dummy' ? 1 : smoothstep(-0.95, -0.4, cy);
      const fyBase = this.kind === 'tinderling' ? -0.25 : this.kind === 'shieldbearer' ? -1.65 : -1.12;
      this.face.position.set(cx * 0.36, fyBase + cy * 0.26);
      this.face.alpha = vis;
      this.face.scale.set(0.8 + 0.2 * vis, 0.6 + 0.4 * vis);
    }
    this.animateParts(cx, cy, wind, norm);
    this.placeShadow(x, y, hop);
  }

  private animateParts(cx: number, cy: number, wind: number, norm: number): void {
    const t = this.time + this.phase;
    // Legs scurry (tinderling) or step (shieldbearer).
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i]!;
      const ph = this.bobPhase * 2 + this.phase + (i % 2) * Math.PI;
      leg.pivot.y = Math.sin(ph) * 0.18 * this.run;
      leg.pivot.x = Math.cos(ph) * 0.12 * this.run;
    }
    // Flames flicker and trail behind the motion.
    const trail = clamp(this.velX * norm, -1, 1) * 0.45;
    for (let i = 0; i < this.flames.length; i++) {
      const f = this.flames[i]!;
      const s = FLAME_POS[i]![2];
      const n = 0.6 * Math.sin(t * (11 + i * 3.1)) + 0.4 * Math.sin(t * (27 + i * 5.3) + i);
      f.scale.set(s * (1 - 0.08 * n), s * (1 + 0.2 * n + 0.15 * this.run));
      f.rotation = -trail + 0.1 * Math.sin(t * 6 + i * 2);
    }
    if (this.glow) {
      const n = 0.5 * Math.sin(t * 13) + 0.5 * Math.sin(t * 31);
      this.glow.scaleX = this.glow.scaleY = 2.6 + 0.25 * n;
    }
    if (this.held) {
      const angle = Math.atan2(cy, cx);
      const back = cy < -0.3;
      if (back !== this.heldBack) {
        this.heldBack = back;
        this.lift.removeChild(this.held);
        if (back) this.lift.addChildAt(this.held, 0);
        else this.lift.addChild(this.held);
      }
      if (this.kind === 'shieldbearer') {
        this.held.rotation = angle;
        this.held.position.set(0, -0.3);
      } else {
        // Archer: bow in the leading hand, string pulled with the windup.
        this.pull += (wind - this.pull) * 0.5;
        this.held.rotation = angle;
        this.held.position.set(cx * 1.35, -0.5 + cy * 0.75);
        const nx = BOW_TIP_X - this.pull * 1.25;
        for (let i = 0; i < 2; i++) {
          const str = this.strings[i]!;
          const ty = i === 0 ? -BOW_TIP_Y : BOW_TIP_Y;
          const dx = nx - BOW_TIP_X;
          const dy = -ty;
          str.position.set(BOW_TIP_X, ty);
          str.rotation = Math.atan2(dy, dx);
          str.scale.set(Math.hypot(dx, dy), 1);
        }
        if (this.arrow) {
          this.arrow.visible = wind > 0;
          this.arrow.position.set(nx, 0);
        }
      }
    }
  }

  private placeShadow(x: number, y: number, hop: number): void {
    const L = LAYOUT[this.kind];
    if (this.shadow) {
      const s = 1 - hop * 0.6;
      this.shadow.x = x + this.recoilX * 0.5;
      this.shadow.y = y + L.shadowY;
      this.shadow.scaleX = L.shadowRx * s;
      this.shadow.scaleY = L.shadowRy * s;
      this.shadow.fade(this.root.alpha);
    }
    if (this.glow) {
      this.glow.x = this.root.x;
      this.glow.y = this.root.y - 0.3;
      this.glow.fade(0.5 * this.root.alpha * (this.dying >= 0 ? Math.max(0, 1 - this.dying * 4) : 1));
    }
  }

  private stepSprings(dt: number): void {
    const w = TAU * C.springHz;
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      this.deformVel += (-w * w * this.deform - 2 * C.springDamping * w * this.deformVel) * h;
      this.deform += this.deformVel * h;
      const w2 = TAU * 2.2;
      this.wobbleVel += (-w2 * w2 * this.wobble - 2 * 0.2 * w2 * this.wobbleVel) * h;
      this.wobble += this.wobbleVel * h;
      left -= h;
    }
    this.deform = clamp(this.deform, -0.3, 0.35);
    this.wobble = clamp(this.wobble, -0.3, 0.3);
  }

  /** Death topple then corpse fade. Returns false once fully faded. */
  updateDeath(dt: number): boolean {
    this.dying += dt;
    this.time += dt;
    const d = this.dying;
    const t = clamp(d / C.dieTime, 0, 1);
    const ease = 1 - (1 - t) * (1 - t);
    this.stepSprings(dt);
    this.flashT = Math.max(0, this.flashT - dt);
    this.flash.alpha = this.flashT > 0 ? C.flashAlpha : 0;
    this.lift.rotation = this.topple * ease * 1.25;
    this.lift.scale.set(1 + 0.2 * ease, 1 - 0.4 * ease);
    this.lift.position.y = LAYOUT[this.kind].foot + ease * 0.3;
    // Lerp toward the corpse tint.
    const g = 1 - ease * 0.45;
    const tr = Math.round(((C.corpseTint >> 16) & 255) + (255 - ((C.corpseTint >> 16) & 255)) * g);
    const tg = Math.round(((C.corpseTint >> 8) & 255) + (255 - ((C.corpseTint >> 8) & 255)) * g);
    const tb = Math.round((C.corpseTint & 255) + (255 - (C.corpseTint & 255)) * g);
    this.root.tint = (tr << 16) | (tg << 8) | tb;
    const fadeStart = C.dieTime + C.corpseHold;
    this.root.alpha = d < fadeStart ? 1 : Math.max(0, 1 - (d - fadeStart) / C.corpseFade);
    this.placeShadow(this.x, this.y, 0);
    return d < fadeStart + C.corpseFade;
  }
}
