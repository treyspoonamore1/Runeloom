import { BitmapFont, BitmapText, Container } from 'pixi.js';
import type { DamageType } from '../../data/combatTypes';
import { INK, NUMBERS as N } from './combatPalette';

/** Bitmap font shared by damage numbers and the AI overlay labels. */
export const FONT = 'RuneloomNumbers';
const FONT_SIZE = 48;
let installed = false;

export function installFont(): void {
  if (installed) return;
  installed = true;
  BitmapFont.install({
    name: FONT,
    style: {
      fontFamily: 'Arial Black, Arial, sans-serif',
      fontWeight: '900',
      fontSize: FONT_SIZE,
      fill: 0xffffff,
      stroke: { color: INK, width: 9, join: 'round' },
    },
    chars: [['a', 'z'], ['A', 'Z'], ['0', '9'], ' !.-_:+/%'],
    resolution: 1,
    padding: 6,
  });
}

interface Num {
  text: BitmapText;
  wx: number;
  wy: number;
  t: number;
  life: number;
  size: number;
  pop: number;
  /** Cells risen over the number's life. */
  rise: number;
  live: boolean;
}

/**
 * Floating damage numbers (DESIGN §4): pooled bitmap text in screen space, placed from world
 * positions each frame so they keep a constant on-screen size. Rounded amounts, colored by damage
 * type; crits are bigger and gold with a pop; numbers on the same target stack sideways and up.
 */
export class DamageNumbers {
  readonly root = new Container();
  private readonly nums: Num[] = [];
  /** Per target: time of the last number and how many are stacked. */
  private readonly stacks = new Map<number, { t: number; n: number }>();
  private time = 0;

  constructor() {
    installFont();
    for (let i = 0; i < N.pool; i++) {
      const text = new BitmapText({ text: '0', style: { fontFamily: FONT, fontSize: FONT_SIZE } });
      text.anchor.set(0.5, 1);
      text.visible = false;
      this.root.addChild(text);
      this.nums.push({ text, wx: 0, wy: 0, t: 0, life: 1, size: 1, pop: 1, rise: N.rise, live: false });
    }
  }

  reset(): void {
    for (const n of this.nums) {
      n.live = false;
      n.text.visible = false;
    }
    this.stacks.clear();
  }

  /** target: enemy id, or -1 for the player. */
  damage(target: number, x: number, y: number, amount: number, crit: boolean, type: DamageType, onPlayer: boolean): void {
    const v = Math.round(amount);
    if (v <= 0) return;
    const color = onPlayer ? N.player : crit ? N.crit : N.colors[type];
    this.spawn(target, x, y, crit ? `${v}!` : `${v}`, color, crit ? N.critSize : N.size, crit ? N.critLife : N.life, crit ? N.critPop : 1.3);
  }

  /**
   * Damage over time (batched 'dot' events): smaller, slanted numbers beside the target in the
   * damage type's color, drifting up slowly, so they never read as hits.
   */
  dot(x: number, y: number, amount: number, type: DamageType, onPlayer: boolean): void {
    const v = Math.round(amount);
    if (v <= 0) return;
    const color = onPlayer ? N.dotPlayer : N.dotColors[type];
    const n = this.spawn(-3, x + N.dotDx, y - N.dotDy, `${v}`, color, N.dotSize, N.dotLife, 1, N.dotRise);
    n.wx += (Math.random() - 0.5) * 0.6;
    n.text.skew.x = N.dotSkew;
  }

  label(x: number, y: number, text: string, color: number): void {
    this.spawn(-2, x, y, text, color, N.size * 0.8, N.life, 1.2);
  }

  /** target -3: no stacking (DoT numbers). */
  private spawn(target: number, x: number, y: number, s: string, color: number, size: number, life: number, pop: number, rise: number = N.rise): Num {
    // Reuse a free slot, else the oldest.
    let slot: Num | null = null;
    for (const n of this.nums) {
      if (!n.live) {
        slot = n;
        break;
      }
      if (!slot || n.t / n.life > slot.t / slot.life) slot = n;
    }
    const n = slot!;
    if (target === -3) {
      n.wx = x;
      n.wy = y - 2.2;
    } else {
      if (this.stacks.size > 256) this.stacks.clear();
      let st = this.stacks.get(target);
      if (!st) this.stacks.set(target, (st = { t: -1e9, n: 0 }));
      st.n = this.time - st.t < N.stackWindow ? st.n + 1 : 0;
      st.t = this.time;
      const k = st.n % 6;
      const dx = (k === 0 ? 0 : k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * 0.5 * N.stackDx;
      n.wx = x + dx + (Math.random() - 0.5) * 0.4;
      n.wy = y - 2.2 - Math.min(st.n, 6) * N.stackDy * 0.5;
    }
    n.t = 0;
    n.life = life;
    n.size = size;
    n.pop = pop;
    n.rise = rise;
    n.live = true;
    n.text.text = s;
    n.text.skew.x = 0;
    n.text.tint = color;
    n.text.visible = true;
    n.text.alpha = 1;
    // Newest on top.
    this.root.setChildIndex(n.text, this.root.children.length - 1);
    return n;
  }

  /** scale and offset: the camera's world-to-screen transform; screenScale = screen height / 720. */
  update(dt: number, scale: number, ox: number, oy: number, screenScale: number): void {
    this.time += dt;
    for (const n of this.nums) {
      if (!n.live) continue;
      n.t += dt;
      if (n.t >= n.life) {
        n.live = false;
        n.text.visible = false;
        continue;
      }
      const u = n.t / n.life;
      const rise = (1 - (1 - u) * (1 - u)) * n.rise;
      const popT = Math.min(1, n.t / 0.12);
      const pop = 1 + (n.pop - 1) * (1 - popT) * (1 - popT);
      n.text.position.set(n.wx * scale + ox, (n.wy - rise) * scale + oy);
      n.text.scale.set(((n.size * screenScale) / FONT_SIZE) * pop);
      n.text.alpha = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
    }
  }
}
