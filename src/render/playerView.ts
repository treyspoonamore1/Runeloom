import { Container, Graphics } from 'pixi.js';
import type { PlayerState } from '../sim';
import { spells } from '../../data/spells';
import { ELEMENT, FX } from './combatPalette';
import type { Tuning } from '../../data/tuning';
import { PLAYER as P } from './palette';
import { buildPlayerShapes } from './playerShapes';

interface Ghost {
  /** Rotated to the stretch axis and scaled; the child undoes the rotation. */
  axis: Container;
  body: Graphics;
  life: number;
}

const TAU = Math.PI * 2;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a: number, b: number, v: number): number {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * The Loomwright: layered shapes with procedural animation (DESIGN §15).
 * All animation state here is visual only, driven by frameDt; the sim state is
 * read, never written.
 */
export class PlayerView {
  /** Afterimages, in world space behind the player. */
  readonly ghostLayer = new Container();
  readonly root = new Container();
  private readonly shadow: Graphics;
  /** Stretch axis: rotated to the dodge direction and scaled along it. */
  private readonly axis = new Container();
  private readonly unaxis = new Container();
  /** Everything that bobs and leans (ailment parts attach here). */
  readonly lift = new Container();
  private readonly staffBack: Graphics;
  private readonly staffFront: Graphics;
  private readonly cloakRim: Graphics;
  private readonly hood = new Container();
  private readonly hoodPeak: Graphics;
  private readonly hoodRim: Graphics;
  private readonly face: Graphics;
  private readonly pips = new Graphics();
  private readonly ghosts: Ghost[] = [];
  private readonly flash: Graphics;
  private readonly flashHood: Graphics;
  private readonly castGlow: Graphics;
  /** Animation speed from the sim's actionSpeed: chill slows the idle motion, Freeze stops it. */
  animSpeed = 1;
  /** Staff tip in world cells, for cast flashes (updated every frame). */
  readonly tip = { x: 0, y: 0 };

  private hurtT = 0;
  /** Seconds since death (-1 alive) and since respawn (-1 when not re-weaving). */
  private deadT = -1;
  private weaveT = -1;

  private time = 0;
  private bobPhase = 0;
  private run = 0;
  private leanX = 0;
  private leanY = 0;
  private deform = 0;
  private deformVel = 0;
  private deformAngle = 0;
  private prevDodgeLeft = 0;
  private ghostTimer = 0;
  private pipAlpha = P.pipIdleAlpha;
  private pipKey = -1;

  constructor() {
    const s = buildPlayerShapes();
    this.shadow = new Graphics(s.shadow);
    this.staffBack = new Graphics(s.staff);
    this.staffFront = new Graphics(s.staff);
    this.cloakRim = new Graphics(s.cloakRim);
    this.hoodPeak = new Graphics(s.hoodPeak);
    this.hoodRim = new Graphics(s.hoodRim);
    this.face = new Graphics(s.face);
    this.flash = new Graphics(s.flash);
    this.flashHood = new Graphics(s.flashHood);
    this.flash.tint = this.flashHood.tint = FX.hurt;
    this.flash.alpha = this.flashHood.alpha = 0;
    this.castGlow = new Graphics(s.castGlow);
    this.castGlow.visible = false;
    this.hood.addChild(this.hoodPeak, new Graphics(s.hood), this.face, this.hoodRim, this.flashHood);
    this.lift.addChild(
      this.staffBack,
      new Graphics(s.cloak),
      this.cloakRim,
      this.flash,
      this.hood,
      this.staffFront,
      this.castGlow,
    );
    this.unaxis.addChild(this.lift);
    this.axis.addChild(this.unaxis);
    this.root.addChild(this.shadow, this.axis, this.pips);
    for (let i = 0; i < P.ghostPool; i++) {
      const axis = new Container();
      const body = new Graphics(s.ghost);
      axis.addChild(body);
      axis.visible = false;
      this.ghostLayer.addChild(axis);
      this.ghosts.push({ axis, body, life: 0 });
    }
  }

  /** Clears trails and springs (room change, reset). */
  reset(): void {
    this.deform = 0;
    this.deformVel = 0;
    this.prevDodgeLeft = 0;
    this.run = 0;
    this.leanX = 0;
    this.leanY = 0;
    this.hurtT = 0;
    this.deadT = -1;
    this.weaveT = -1;
    this.root.alpha = 1;
    for (const g of this.ghosts) {
      g.life = 0;
      g.axis.visible = false;
    }
  }

  /** A hit landed on the player: red flash. */
  hurt(): void {
    this.hurtT = FX.hurtFlashTime;
  }

  /** x, y: interpolated position in cells. */
  update(p: PlayerState, x: number, y: number, tuning: Tuning['player'], dt: number): void {
    this.time += dt * this.animSpeed;
    this.root.position.set(x, y);
    const dodging = p.dodgeLeft > 0;

    // Dodge start and landing kick the squash-and-stretch spring.
    if (dodging && (this.prevDodgeLeft <= 0 || p.dodgeLeft > this.prevDodgeLeft + 1e-6)) {
      const dx = p.dodgeDirX || p.faceX;
      const dy = p.dodgeDirY || p.faceY;
      if (dx !== 0 || dy !== 0) this.deformAngle = Math.atan2(dy, dx);
      this.deformVel += P.dodgeKick;
      this.ghostTimer = 0;
    } else if (!dodging && this.prevDodgeLeft > 0) {
      this.deformVel += P.landKick;
    }
    this.prevDodgeLeft = p.dodgeLeft;
    this.stepSpring(dt);
    const sx = 1 + this.deform;
    this.axis.rotation = this.deformAngle;
    this.axis.scale.set(sx, 1 / sx);
    this.unaxis.rotation = -this.deformAngle;

    // Run blend and lean follow velocity with a short smoothing.
    const speed = Math.hypot(p.vx, p.vy);
    const k = 1 - Math.exp(-dt / P.leanSmoothing);
    const norm = tuning.moveSpeed > 0 ? 1 / tuning.moveSpeed : 0;
    const lx = clamp(p.vx * norm, -1, 1);
    const ly = clamp(p.vy * norm, -1, 1);
    this.leanX += (lx - this.leanX) * k;
    this.leanY += (ly - this.leanY) * k;
    this.run += (Math.min(1, speed * norm) - this.run) * k;

    let hop: number;
    let squash = 0;
    if (dodging) {
      const prog = tuning.dodgeDuration > 0 ? 1 - p.dodgeLeft / tuning.dodgeDuration : 1;
      hop = Math.sin(Math.PI * clamp(prog, 0, 1)) * P.bobHeight * 1.6;
    } else {
      if (tuning.moveSpeed > 0) this.bobPhase += (speed * dt * Math.PI) / P.bobStride;
      const b = Math.abs(Math.sin(this.bobPhase));
      hop = b * P.bobHeight * this.run;
      squash = (1 - b) * 0.05 * this.run;
    }
    const breath = P.breathAmp * Math.sin(this.time * TAU * P.breathHz) * (1 - this.run);
    this.lift.position.set(this.leanX * P.leanShift * 0.3, -hop);
    this.lift.rotation = this.leanX * P.leanTilt;
    this.lift.scale.set(1 + squash - breath * 0.5, 1 - squash + breath);
    const sh = 1 - (0.25 * hop) / P.bobHeight;
    this.shadow.scale.set(Math.max(0.6, sh));

    this.updateFacing(p);

    // I-frames: shimmer the body and light the rim.
    const inv = p.iframesLeft > 0;
    const shimmer = 0.5 + 0.5 * Math.cos(this.time * TAU * P.iframeHz);
    this.lift.alpha = inv ? P.iframeMinAlpha + (1 - P.iframeMinAlpha) * shimmer : 1;
    this.cloakRim.visible = inv;
    this.hoodRim.visible = inv;

    this.updateGhosts(dodging, x, y - hop, dt);
    this.drawPips(p, tuning, dt);
    this.updateCombat(p, tuning, x, y, hop, dt);
  }

  /** Hurt flash, cast cue, death collapse and re-weave. */
  private updateCombat(p: PlayerState, tuning: Tuning['player'], x: number, y: number, hop: number, dt: number): void {
    this.hurtT = Math.max(0, this.hurtT - dt);
    const f = this.hurtT > 0 ? Math.sqrt(this.hurtT / FX.hurtFlashTime) * 0.85 : 0;
    this.flash.alpha = this.flashHood.alpha = f;

    // Cast cue: a glow gathers at the staff tip until the spell releases, then fades.
    const cg = this.castGlow;
    if (p.castSpell && p.castTime > 0) {
      const elapsed = p.castTime - p.castLeft;
      const release = p.castTime * tuning.castReleaseFraction;
      const u = release > 0 ? Math.min(1, elapsed / release) : 1;
      cg.visible = true;
      cg.tint = spells[p.castSpell].form === 'bolt' ? ELEMENT.fire : FX.strikeEdge;
      cg.alpha = p.castReleased ? Math.max(0, cg.alpha - dt * 10) : 0.35 + 0.5 * u;
      cg.scale.set(p.castReleased ? cg.scale.x : 0.35 + 0.45 * u);
    } else if (cg.visible) {
      cg.alpha = Math.max(0, cg.alpha - dt * 10);
      if (cg.alpha <= 0) cg.visible = false;
    }
    const st = this.staffFront.visible ? this.staffFront : this.staffBack;
    const ca = Math.cos(st.rotation);
    const sa = Math.sin(st.rotation);
    cg.position.set(st.x + ca * 2.85, st.y + sa * 2.85);
    this.tip.x = x + this.lift.x + cg.x;
    this.tip.y = y - hop + cg.y;

    // Death: collapse into threads (fx spawns them), then stay hidden; re-weave on respawn.
    if (p.dead) {
      if (this.deadT < 0) this.deadT = 0;
      this.deadT += dt;
      this.weaveT = -1;
      const u = Math.min(1, this.deadT / FX.collapseTime);
      this.root.alpha = 1 - u;
      this.lift.scale.set(1 + 0.5 * u, 1 - 0.8 * u);
    } else if (this.deadT >= 0) {
      this.deadT = -1;
      this.weaveT = 0;
    }
    if (this.weaveT >= 0) {
      this.weaveT += dt;
      const u = Math.min(1, this.weaveT / FX.reweaveTime);
      // Threads arrive first; the body forms over the second half with a small overshoot.
      const v = Math.max(0, (u - 0.45) / 0.55);
      this.root.alpha = v;
      const sc = 0.5 + 0.5 * v + Math.sin(v * Math.PI) * 0.15;
      this.lift.scale.set(sc * this.lift.scale.x, sc * this.lift.scale.y);
      if (u >= 1) {
        this.weaveT = -1;
        this.root.alpha = 1;
      }
    }
  }

  private updateFacing(p: PlayerState): void {
    let ax = p.aimDirX;
    let ay = p.aimDirY;
    if (ax === 0 && ay === 0) {
      ax = p.faceX;
      ay = p.faceY;
    }
    if (ax === 0 && ay === 0) ay = 1;
    const len = Math.hypot(ax, ay);
    ax /= len;
    ay /= len;
    const angle = Math.atan2(ay, ax);

    this.hood.position.set(this.leanX * P.leanShift, P.hoodY + this.leanY * P.leanShift * 0.6);
    // Face looks toward the aim and hides when aiming away from the viewer.
    const vis = smoothstep(-0.9, -0.35, ay);
    this.face.position.set(ax * 0.36, ay * 0.3 + 0.08);
    this.face.alpha = vis;
    this.face.scale.set(0.8 + 0.2 * vis, 0.55 + 0.45 * vis);
    this.hoodPeak.rotation = angle + Math.PI;

    // Staff in the hand on the aim side, pointing at the aim; behind the body when aiming north.
    const hx = -ay * 0.75;
    const hy = ax * 0.75 * 0.6 - 0.15;
    const back = ay < -0.25;
    this.staffBack.visible = back;
    this.staffFront.visible = !back;
    const staff = back ? this.staffBack : this.staffFront;
    staff.position.set(hx, hy);
    staff.rotation = angle;
  }

  private stepSpring(dt: number): void {
    const w = TAU * P.springHz;
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      this.deformVel += (-w * w * this.deform - 2 * P.springDamping * w * this.deformVel) * h;
      this.deform += this.deformVel * h;
      left -= h;
    }
    this.deform = clamp(this.deform, P.deformMin, P.deformMax);
  }

  private updateGhosts(dodging: boolean, x: number, y: number, dt: number): void {
    if (dodging) {
      this.ghostTimer -= dt;
      while (this.ghostTimer <= 0) {
        this.spawnGhost(x, y);
        this.ghostTimer += P.ghostEvery;
      }
    }
    for (const g of this.ghosts) {
      if (g.life <= 0) continue;
      g.life -= dt;
      if (g.life <= 0) {
        g.axis.visible = false;
        continue;
      }
      const f = g.life / P.ghostLife;
      g.body.alpha = P.ghostAlpha * f;
    }
  }

  private spawnGhost(x: number, y: number): void {
    let g = this.ghosts[0]!;
    for (const c of this.ghosts) if (c.life < g.life) g = c;
    g.life = P.ghostLife;
    g.axis.visible = true;
    g.axis.position.set(x, y);
    g.axis.rotation = this.deformAngle;
    g.axis.scale.set(1 + this.deform, 1 / (1 + this.deform));
    g.body.rotation = -this.deformAngle;
    g.body.alpha = P.ghostAlpha;
    // Newest ghost sits closest to the player.
    this.ghostLayer.setChildIndex(g.axis, this.ghostLayer.children.length - 1);
  }

  /** Dodge charges as pips under the feet; the recharging one fills like a clock. */
  private drawPips(p: PlayerState, tuning: Tuning['player'], dt: number): void {
    const n = Math.max(0, Math.floor(tuning.dodgeCharges));
    const full = p.dodgeCharges >= n;
    const target = full ? P.pipIdleAlpha : 1;
    this.pipAlpha += (target - this.pipAlpha) * (1 - Math.exp(-dt / (full ? 0.5 : 0.05)));
    this.pips.alpha = this.pipAlpha;
    const progress =
      !full && tuning.dodgeRecharge > 0 ? clamp(1 - p.dodgeRechargeLeft / tuning.dodgeRecharge, 0, 1) : 0;
    const key = (n * 64 + p.dodgeCharges) * 64 + Math.round(progress * 48);
    if (key === this.pipKey) return;
    this.pipKey = key;
    const g = this.pips.clear();
    const r = P.pipR;
    for (let i = 0; i < n; i++) {
      const cx = (i - (n - 1) / 2) * P.pipGap;
      const cy = P.pipY;
      if (i < p.dodgeCharges) {
        g.circle(cx, cy, r).fill(P.pipFull).stroke({ width: 0.14, color: P.pipEmpty });
      } else {
        g.circle(cx, cy, r).fill({ color: P.pipEmpty, alpha: 0.45 });
        if (i === p.dodgeCharges && progress > 0) {
          g.moveTo(cx, cy)
            .arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * progress)
            .closePath()
            .fill({ color: P.pipFull, alpha: 0.85 });
        }
        g.circle(cx, cy, r).stroke({ width: 0.14, color: P.pipEmpty });
      }
    }
  }
}
