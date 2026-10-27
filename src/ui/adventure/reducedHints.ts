/**
 * One-time hints for hits a state cuts a lot (playtest 8: "I couldn't figure out what I was
 * supposed to do with the turtles/bells"). Pure, no DOM: the adventure HUD feeds it each frame's
 * events with the sim time, and shows a toast for each hint it returns.
 *
 * Counts the player's 'hit' events that carry `reduced` (Shelled: Bellshell, Old Bellwether;
 * Submerged: the Glasswater Coil). Once `reducedHits` of the same reason land within
 * `windowSeconds` of sim time (data/tuning.ts hints), that reason's hint is due, once per
 * watcher: the HUD keeps one per page session, so the sim, saves and replays never see it.
 */
import { PLAYER_ID, type HitReducedBy } from '../../sim';
import { reducedHints } from '../../../data/ui';
import type { LooseEvent, ToastSpec } from './hudEvents';

export interface HintThresholds {
  reducedHits: number;
  windowSeconds: number;
}

const REASONS: readonly HitReducedBy[] = ['shelled', 'submerged'];

export class ReducedHitHints {
  private readonly times = new Map<HitReducedBy, number[]>();
  private readonly shown = new Set<HitReducedBy>();

  /** Hints due now (each reason at most once in this watcher's life). `now`: sim seconds. */
  feed(events: readonly LooseEvent[], now: number, t: HintThresholds): HitReducedBy[] {
    const out: HitReducedBy[] = [];
    for (const e of events) {
      if (e.type !== 'hit' || e.target === 'player' || e.sourceId !== PLAYER_ID) continue;
      const why = e.reduced as HitReducedBy | undefined;
      if (why === undefined || !REASONS.includes(why) || this.shown.has(why)) continue;
      let list = this.times.get(why);
      if (!list) this.times.set(why, (list = []));
      list.push(now);
      while (list.length > 0 && now - list[0]! > t.windowSeconds) list.shift();
      if (list.length < Math.max(1, t.reducedHits)) continue;
      this.shown.add(why);
      this.times.delete(why);
      out.push(why);
    }
    return out;
  }

  /** True once `why`'s hint has been shown. */
  hasShown(why: HitReducedBy): boolean {
    return this.shown.has(why);
  }
}

/** The toast for a due hint: a shell for Shelled, deep water for Submerged. */
export function hintToast(why: HitReducedBy): ToastSpec {
  const h = reducedHints[why];
  return { kind: 'hint', icon: why === 'shelled' ? 'shell' : 'deep', title: h.title, sub: h.sub, rarity: null, amount: 1 };
}
