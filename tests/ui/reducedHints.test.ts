import { describe, expect, it } from 'vitest';
import { defaultTuning } from '../../data/tuning';
import { reducedHints } from '../../data/ui';
import { PLAYER_ID } from '../../src/sim';
import { pushToasts, type LooseEvent } from '../../src/ui/adventure/hudEvents';
import { hintToast, ReducedHitHints } from '../../src/ui/adventure/reducedHints';

/** Playtest 8: one-time hints once the player keeps landing hits a state cuts a lot. */

const T = { reducedHits: 3, windowSeconds: 4 };
const hit = (reduced?: string, sourceId = PLAYER_ID, target: number | 'player' = 7): LooseEvent => ({
  type: 'hit',
  target,
  sourceId,
  amount: 1,
  ...(reduced ? { reduced } : {}),
});

describe('reduced-hit hints', () => {
  it('is due after reducedHits reduced hits of one reason within windowSeconds, then never again', () => {
    const h = new ReducedHitHints();
    expect(h.feed([hit('shelled')], 0, T)).toEqual([]);
    expect(h.feed([hit('shelled')], 1, T)).toEqual([]);
    expect(h.feed([hit('shelled')], 2, T)).toEqual(['shelled']);
    expect(h.hasShown('shelled')).toBe(true);
    expect(h.feed([hit('shelled'), hit('shelled'), hit('shelled')], 3, T)).toEqual([]);
  });

  it('hits older than the window drop out', () => {
    const h = new ReducedHitHints();
    h.feed([hit('submerged'), hit('submerged')], 0, T);
    expect(h.feed([hit('submerged')], 5, T)).toEqual([]);
    expect(h.feed([hit('submerged')], 6, T)).toEqual([]);
    expect(h.feed([hit('submerged')], 7, T)).toEqual(['submerged']);
  });

  it('counts each reason on its own, and only the player hitting something reduced', () => {
    const h = new ReducedHitHints();
    const noise = [hit(), hit('shelled', 12), hit('shelled', PLAYER_ID, 'player'), hit('submerged')];
    expect(h.feed(noise, 0, T)).toEqual([]);
    expect(h.feed([hit('shelled'), hit('shelled'), hit('shelled')], 0.5, T)).toEqual(['shelled']);
    expect(h.hasShown('submerged')).toBe(false);
  });

  it('the shipped thresholds live in tuning.hints', () => {
    const h = new ReducedHitHints();
    const n = defaultTuning.hints.reducedHits;
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(...h.feed([hit('shelled')], i * 0.5, defaultTuning.hints));
    expect(out).toEqual(['shelled']);
  });

  it('becomes a hint toast that stays hintSeconds', () => {
    const t = hintToast('shelled');
    expect(t).toMatchObject({ kind: 'hint', icon: 'shell', title: reducedHints.shelled.title });
    expect(hintToast('submerged').icon).toBe('deep');
    const live = pushToasts([], [t], 10, {
      seconds: 3,
      levelSeconds: 5,
      hintSeconds: 7,
      mergeWindow: 1,
      max: 5,
      nextId: () => 1,
    });
    expect(live[0]!.until).toBe(17);
  });

  it('hint texts stay short', () => {
    for (const h of Object.values(reducedHints)) {
      expect(h.title.length).toBeLessThanOrEqual(32);
      expect(h.sub.length).toBeLessThanOrEqual(72);
    }
  });
});
