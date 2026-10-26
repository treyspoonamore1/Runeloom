/**
 * BUILD_PLAN M8 phase 1 "Progression with the Fen": the progression sim plays the Fen when it
 * reaches the tier 8 gate (bots/progressionFen.ts). From the Fen start save (tier 8 done, the Coil
 * alive, at K10's Loom Stone) the splice opens the storm door, plays G1 to F10, and comes home to
 * the Hearth with the deep rifts open and the Coil's tier 9 sigil. The full curve is
 * `npm run sim -- --progression --seeds 6`.
 */
import { describe, expect, it } from 'vitest';
import { hearthRoom } from '../../../data/hearth';
import { riftGate } from '../../../data/riftGate';
import { fenDue, playFenFromHome } from '../../../src/sim/bots/progressionFen';
import { pickSigil } from '../../../src/sim/bots/riftLadder';
import { riftOpenCap } from '../../../src/sim/meta/view';
import { loadFenStart } from '../../../tools/lib/fenCli';
import { loadAllRooms } from '../../../tools/lib/rooms';

describe('the Fen in the progression route', () => {
  it(
    'at the tier 8 gate the model player plays the Fen and comes home with tier 9 open',
    { timeout: 300_000 },
    () => {
      const s = loadFenStart(loadAllRooms(), 1, 'save');
      expect(fenDue(s)).toBe(true);
      // The gate holds before: tier 9 can't open, so the ladder never picks a tier 9 sigil.
      expect(riftOpenCap(s.hero, s.world)).toBe(riftGate.openTier);
      const { fen, seconds } = playFenFromHome(s, 7, 'hearth');
      expect(fen.coilDead).toBe(true);
      expect(fen.deaths).toBe(0);
      expect(fen.failedSteps).toEqual([]);
      expect(seconds / 60).toBeGreaterThan(50);
      expect(fen.endHours).toBeCloseTo(7 + seconds / 3600, 6);
      expect(s.room.id).toBe(hearthRoom);
      expect(fenDue(s)).toBe(false);
      expect(riftOpenCap(s.hero, s.world)).toBeGreaterThan(riftGate.openTier);
      expect(s.hero.sigils.some((g) => g.tier === riftGate.firstKillSigilTier)).toBe(true);
      expect(pickSigil(s.hero.sigils, s.hero.riftTier)?.tier).toBe(riftGate.firstKillSigilTier);
    },
  );
});
