import { BitmapText, Container } from 'pixi.js';
import type { GameState } from '../sim';
import { bossStateId, bossStatus, type BossStateId } from '../app/bossStatus';
import { FONT, installFont } from './damageNumbers';
import type { EnemyLayer } from './enemyLayer';
import type { ScreenXf } from './m4Layers';

/** Pop label colors per state (the boss bar's tones: gold when it opens up, ice and storm when helpless). */
const COLOR: Partial<Record<BossStateId, number>> = {
  stranded: 0xffd36a,
  iced: 0xbfeaff,
  overloaded: 0xf2e27a,
};
const FONT_SIZE = 48;
/** At most this many pops at once (one per boss). */
const POOL = 4;

export interface BossPop {
  /** The boss's enemy id. */
  id: number;
  label: string;
  color: number;
  /** Seconds since it popped. */
  t: number;
}

/**
 * Which pops are up (no Pixi, so tests run it in Node): watches each Fen boss's state
 * (app/bossStatus.ts, the same the boss bar's state line reads) and pops on a change into a state
 * with a pop label; a boss seen for the first time doesn't pop. One pop per boss: a new one
 * replaces it. Pops last tuning.bossReadout.popSeconds.
 */
export class BossPopTracker {
  readonly live: BossPop[] = [];
  /** Each boss's state last frame. */
  private readonly last = new Map<number, BossStateId>();

  reset(): void {
    this.last.clear();
    this.live.length = 0;
  }

  update(s: GameState, dt: number): void {
    const T = s.tuning.bossReadout;
    for (let i = this.live.length - 1; i >= 0; i--) {
      this.live[i]!.t += dt;
      if (this.live[i]!.t >= T.popSeconds) this.live.splice(i, 1);
    }
    for (const e of s.enemies) {
      if (e.dead || !e.boss?.fen) continue;
      const st = bossStateId(s, e);
      if (!st) continue;
      const was = this.last.get(e.id);
      this.last.set(e.id, st.id);
      if (was === undefined || was === st.id) continue;
      const label = bossStatus(s, e)?.pop;
      if (!label) continue;
      const k = this.live.findIndex((p) => p.id === e.id);
      if (k >= 0) this.live.splice(k, 1);
      if (this.live.length >= POOL) this.live.shift();
      this.live.push({ id: e.id, label, color: COLOR[st.id] ?? 0xffffff, t: 0 });
    }
    if (this.last.size > 32) this.last.clear();
  }
}

/**
 * The pop label over a Fen boss entering a state the player caused (playtest 8): STRANDED, ICED,
 * OVERLOADED (the Glasswater Coil). Any state with a pop in data/ui.ts bossStateCopy pops here, for
 * either boss; the Bellwether's ring has none, since the shared ring effect already shows "RUNG!".
 * Screen-space bitmap text that follows the boss, sized and timed by tuning.bossReadout. Reads
 * sim state only.
 */
export class BossPops {
  readonly root = new Container();
  readonly tracker = new BossPopTracker();
  private readonly texts: BitmapText[] = [];

  reset(): void {
    this.tracker.reset();
    for (const t of this.texts) t.visible = false;
  }

  update(s: GameState, enemies: EnemyLayer, dt: number, xf: ScreenXf): void {
    this.tracker.update(s, dt);
    const T = s.tuning.bossReadout;
    const live = this.tracker.live;
    for (let i = 0; i < live.length; i++) {
      const p = live[i]!;
      const text = this.text(i);
      const v = enemies.view(p.id);
      const e = v?.enemy;
      if (!v || !e) {
        text.visible = false;
        continue;
      }
      const u = p.t / T.popSeconds;
      const rise = (1 - (1 - u) * (1 - u)) * T.popRise;
      const wy = v.y - e.radius - T.popLift - rise;
      // A quick overshoot on appearing, then a fade over the last third.
      const k = Math.min(1, p.t / 0.15);
      const pop = 1 + 0.5 * (1 - k) * (1 - k);
      if (text.text !== p.label) text.text = p.label;
      text.tint = p.color;
      text.visible = true;
      text.position.set(Math.round(v.x * xf.scale + xf.ox), Math.round(wy * xf.scale + xf.oy));
      text.scale.set(((T.popSize * xf.screenScale) / FONT_SIZE) * pop);
      text.alpha = u < 0.66 ? 1 : 1 - (u - 0.66) / 0.34;
    }
    for (let i = live.length; i < this.texts.length; i++) this.texts[i]!.visible = false;
  }

  private text(i: number): BitmapText {
    let t = this.texts[i];
    if (!t) {
      installFont();
      t = new BitmapText({ text: '', style: { fontFamily: FONT, fontSize: FONT_SIZE } });
      t.anchor.set(0.5, 1);
      this.root.addChild(t);
      this.texts.push(t);
    }
    return t;
  }
}
