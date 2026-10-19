import { BitmapText, Container, Sprite, Texture } from 'pixi.js';
import type { GameState } from '../../sim';
import type { M4Cue } from '../../app/m4Signals';
import { rand } from '../ailmentBursts';
import { FX } from '../combatPalette';
import { FONT, installFont } from '../damageNumbers';
import type { Shake } from '../shake';
import { BEAST_FEEL, BESTIARY } from '../bestiary/bestiaryPalette';
import type { WorldFx } from './worldFx';
import { MOMENT as M, OBJ } from './worldPalette';

const TAU = Math.PI * 2;

/**
 * Transitions and big moments: the room-change fade from black, the level-up burst, boss phase
 * changes and death, player death (the screen darkens) and the respawn at a Loom Stone. The
 * overlay is screen space, above the world and below the HUD; bursts go to WorldFx.
 */
export class MomentsView {
  /** Screen space: black fade, white flash, death dim, level-up text. */
  readonly screen = new Container();
  private readonly black = new Sprite(Texture.WHITE);
  private readonly flash = new Sprite(Texture.WHITE);
  private readonly level: BitmapText;
  private roomT = -1;
  private flashT = -1;
  private flashColor = 0xffffff;
  private flashPeak = 0.6;
  private deadT = -1;
  private respawnT = -1;
  private levelT = -1;
  private levelX = 0;
  private levelY = 0;

  constructor(
    private readonly fx: WorldFx,
    private readonly shake: Shake | null,
  ) {
    installFont();
    this.black.tint = 0x0d0a10;
    this.flash.blendMode = 'normal';
    this.level = new BitmapText({ text: 'LEVEL UP', style: { fontFamily: FONT, fontSize: 30 } });
    this.level.anchor.set(0.5, 1);
    this.level.tint = M.levelColor;
    this.screen.addChild(this.black, this.flash, this.level);
    this.black.alpha = this.flash.alpha = 0;
    this.level.visible = false;
  }

  handle(c: M4Cue, s: GameState): void {
    const fx = this.fx;
    const t = fx.t;
    switch (c.type) {
      case 'roomEnter':
        this.roomT = 0;
        break;
      case 'levelUp': {
        this.levelT = 0;
        this.level.text = `LEVEL ${c.level}`;
        for (let i = 0; i < 2; i++) {
          const r = fx.one(
            fx.ground,
            t.ring,
            c.x,
            c.y + 1.2,
            0.6 + i * 0.25,
            M.levelRing,
            1,
            7 + i * 2,
            0.95,
          );
          if (r) r.aspect = 0.5;
        }
        fx.one(fx.add, t.glow, c.x, c.y - 1, 0.7, M.levelColor, 2, 7, 0.85);
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const p = fx.top.spawn(
            t.spark,
            c.x + Math.cos(a) * 1.2,
            c.y - 1 + Math.sin(a) * 1.2,
            Math.cos(a) * 16,
            Math.sin(a) * 16,
            0.35,
            i % 2 ? M.levelColor : 0xffffff,
            1.4,
            0.4,
          );
          if (p) {
            p.align = true;
            p.stretch = 0.04;
            p.drag = 4;
          }
        }
        fx.spiral(c.x, c.y, 18, 1.8, [M.levelColor, FX.thread, FX.threadBlue], 9, 1.1);
        break;
      }
      case 'bossPhase':
        this.flashT = 0;
        this.flashColor = 0xff9a4a;
        this.flashPeak = 0.25;
        this.shake?.kick(2);
        fx.one(fx.top, t.ring, c.x, c.y - 2, 0.6, BESTIARY.cinder_warden.heat, 2, 16, 0.9);
        fx.one(fx.add, t.glow, c.x, c.y - 2, 0.6, BESTIARY.cinder_warden.heat, 4, 12, 0.8);
        break;
      case 'superheatChanged':
        if (c.on) fx.one(fx.top, t.ring, c.x, c.y - 2, 0.45, BESTIARY.cinder_warden.seamHot, 3, 10, 0.8);
        else
          fx.burst(fx.top, t.puff, c.x, c.y - 3, 10, [2, 6], [0.8, 1.2], [0xf2f2f6], [0.8, 2.2], 2.5, (p) => {
            p.a0 = 0.6;
            p.grav = -3;
          });
        break;
      case 'bossDeath':
        this.bossDeath(c.x, c.y, c.kind);
        break;
      case 'hulkFuse':
        fx.burst(
          fx.top,
          t.spark,
          c.x,
          c.y - 3,
          8,
          [6, 14],
          [0.2, 0.35],
          [0xffe08a, 0xff7a2f],
          [0.9, 0.3],
          0.8,
          (p) => {
            p.align = true;
            p.stretch = 0.03;
          },
        );
        break;
      case 'flood':
        this.flashT = 0;
        this.flashColor = 0x2f7bff;
        this.flashPeak = 0.18;
        break;
      case 'playerDeath':
        this.deadT = 0;
        this.respawnT = -1;
        break;
      case 'playerRespawn': {
        this.deadT = -1;
        this.respawnT = 0;
        // Re-woven at the Loom Stone: its rune flares and a ring of threads washes out.
        const stone = s.objects.find(
          (o) => o.kind === 'loom_stone' && Math.hypot((o.tx + 0.5) * 4 - c.x, (o.ty + 0.5) * 4 - c.y) < 12,
        );
        const sx = stone ? (stone.tx + 0.5) * 4 : c.x;
        const sy = stone ? (stone.ty + 0.5) * 4 : c.y;
        fx.one(fx.add, t.glow, sx, sy - 2, 0.8, OBJ.loomRune, 2, 8, 0.85);
        for (let i = 0; i < 2; i++) {
          const r = fx.one(fx.ground, t.ring, sx, sy + 1.2, 0.7 + i * 0.3, OBJ.loomRune, 1, 9 + i * 3, 0.9);
          if (r) r.aspect = 0.5;
        }
        break;
      }
      default:
    }
  }

  private bossDeath(x: number, y: number, kind: string): void {
    const fx = this.fx;
    const t = fx.t;
    const warden = kind === 'cinder_warden';
    const hot = warden ? [0xfff0b0, 0xff8a3a, 0xffd25a] : [0xffb84a, 0x5c4743, 0x3a2b2a];
    this.flashT = 0;
    this.flashColor = 0xffffff;
    this.flashPeak = 0.75;
    this.shake?.kick(3);
    fx.one(fx.add, t.glow, x, y - 2, BEAST_FEEL.bossFlash * 3, 0xffffff, 6, 14, 1);
    for (let i = 0; i < 3; i++) {
      const r = fx.one(
        fx.top,
        t.ring,
        x,
        y - 1,
        BEAST_FEEL.bossRings * (0.7 + i * 0.25),
        hot[i % hot.length]!,
        2 + i,
        22 + i * 6,
        0.9,
      );
      if (r) r.hold = 0.2;
    }
    fx.burst(fx.top, t.dot, x, y - 2, 70, [8, 26], [0.8, 1.6], hot, [0.45, 0.08], 2.5, (p) => {
      p.drag = 2;
      p.grav = -4;
    });
    fx.burst(
      fx.top,
      t.chip,
      x,
      y - 1,
      24,
      [8, 20],
      [0.7, 1.2],
      warden
        ? [BESTIARY.cinder_warden.iron, BESTIARY.cinder_warden.ironLight]
        : [BESTIARY.tar.body, BESTIARY.tar.shade],
      [1.2, 0.8],
      2,
      (p) => {
        p.spin = rand(-10, 10);
        p.grav = 22;
        p.drag = 1.5;
      },
    );
    fx.burst(fx.top, t.puff, x, y, 14, [2, 7], [1.0, 1.6], [0x5a4a52, 0x7a6a70], [1.2, 3.2], 3, (p) => {
      p.a0 = 0.6;
      p.grav = -2;
    });
    // A pillar of embers rising where the boss fell.
    const pillar = fx.one(fx.add, t.glow, x, y - 8, BEAST_FEEL.bossPillar, hot[1]!, 2.5, 2.5, 0.75);
    if (pillar) {
      pillar.aspect = 4;
      pillar.hold = 0.5;
    }
  }

  /** playerDead: the state's flag; a living player lifts the death dim even without a respawn event. */
  update(
    dt: number,
    w: number,
    h: number,
    scale: number,
    ox: number,
    oy: number,
    screenScale: number,
    playerDead: boolean,
  ): void {
    if (this.deadT >= 0 && !playerDead) {
      this.deadT = -1;
      this.respawnT = 0;
    }
    for (const s of [this.black, this.flash]) {
      s.width = w;
      s.height = h;
    }
    let black = 0;
    if (this.roomT >= 0) {
      this.roomT += dt;
      const u = this.roomT - M.roomHold;
      black = u <= 0 ? 1 : Math.max(0, 1 - u / M.roomFade);
      if (u > M.roomFade) this.roomT = -1;
    }
    if (this.deadT >= 0) {
      this.deadT += dt;
      black = Math.max(black, M.deathAlpha * Math.min(1, this.deadT / M.deathDim));
    } else if (this.respawnT >= 0) {
      this.respawnT += dt;
      black = Math.max(black, M.deathAlpha * Math.max(0, 1 - this.respawnT / M.respawnFade));
      if (this.respawnT > M.respawnFade) this.respawnT = -1;
    }
    this.black.alpha = black;
    this.black.visible = black > 0.002;
    if (this.flashT >= 0) {
      this.flashT += dt;
      const k = Math.max(0, 1 - this.flashT / (M.bossFlash * 2));
      this.flash.tint = this.flashColor;
      this.flash.alpha = this.flashPeak * k * k;
      if (k <= 0) this.flashT = -1;
    } else this.flash.alpha = 0;
    this.flash.visible = this.flash.alpha > 0.002;
    if (this.levelT >= 0) {
      this.levelT += dt;
      const u = this.levelT / M.levelTime;
      this.level.visible = u < 1;
      const pop = u < 0.15 ? 0.6 + (u / 0.15) * 0.6 : 1.2 - Math.min(0.2, (u - 0.15) * 0.6);
      this.level.scale.set(pop * screenScale);
      this.level.alpha = u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25;
      this.level.position.set(this.levelX * scale + ox, (this.levelY - 3.5 - u * 2.5) * scale + oy);
      if (u >= 1) this.levelT = -1;
    }
  }

  /** The player's position, for the level-up text. */
  follow(x: number, y: number): void {
    this.levelX = x;
    this.levelY = y;
  }

  reset(): void {
    this.flashT = -1;
    this.levelT = -1;
    this.level.visible = false;
  }
}
