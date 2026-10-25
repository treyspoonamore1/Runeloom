/**
 * M7 progression sim (bots/progression.ts) smoke test: a new game to the Warden, then rifts with
 * the Hearth until the first tier 2 clear, on one seed (the campaign takes most of the time). The
 * full report (`npm run sim -- --progression --seeds 3`) takes minutes; it runs here only with
 * RUNELOOM_BALANCE=1 and checks the M7 target: the first Rekindle in 6 to 10 hours of play.
 */
import { describe, expect, it } from 'vitest';
import { hearthRoom } from '../../../data/hearth';
import { runProgression } from '../../../src/sim/bots/progression';
import { loadAllRooms } from '../../../tools/lib/rooms';

const LONG = process.env.RUNELOOM_BALANCE === '1';
const rooms = loadAllRooms();

describe('progression sim', () => {
  it('plays the campaign, moves into the Hearth and climbs with it', { timeout: 240_000 }, () => {
    const r = runProgression({ seed: 1, rooms, stopAtTier: 2, rekindles: 0, maxRifts: 12 });
    expect(r.campaignHours).toBeGreaterThan(0.5);
    expect(r.firstClear[0]?.[2]).toBeGreaterThan(r.campaignHours);
    expect(r.tally.upgrades).toBeGreaterThan(0);
    expect(r.tally.embersSpent).toBeGreaterThan(0);
    expect(r.rifts.every((x) => x.hours > r.campaignHours)).toBe(true);
    // Hearth time follows play time: the pit's Scrap covers the whole span after its first level.
    expect(r.pitScrap).toBeGreaterThan(0);
    expect(rooms[hearthRoom]).toBeDefined();
  });

  it.runIf(LONG)(
    'reaches the first Rekindle in 6 to 10 hours of play (M7 acceptance)',
    { timeout: 1_800_000 },
    () => {
      for (const seed of [1, 2, 3]) {
        const r = runProgression({ seed, rooms, rekindles: 1, maxHours: 14 });
        expect(r.rekindles.length).toBe(1);
        expect(r.rekindles[0]!.hours).toBeGreaterThanOrEqual(6);
        expect(r.rekindles[0]!.hours).toBeLessThanOrEqual(10);
      }
    },
  );
});
