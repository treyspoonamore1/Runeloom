import { describe, expect, it } from 'vitest';
import { campaignOrder, runCampaign } from '../../../src/sim/bots/campaign';
import { expectedCharacters, runEncounter } from '../../../src/sim/bots/campaignEncounter';
import { loadAllRooms } from '../../../tools/lib/rooms';

/**
 * M4 balance (BUILD_PLAN M4 task 11 and acceptance). Every encounter, bosses included, played by
 * the campaign bot with the reference character at its expected level (campaignEncounter.ts)
 * finishes without the bot dying, on 2 seeds (about 18 s). The full campaigns' targets (level 12
 * at the Warden, his kill in 90 to 150 s, no deaths) take longer and run only with
 * RUNELOOM_BALANCE=1, which also plays 10 seeds per encounter (about 1.5 minutes):
 *   RUNELOOM_BALANCE=1 npx vitest run tests/sim/bots/campaign.test.ts
 * `npm run sim -- --encounters --seeds 10` and `npm run sim -- --campaign --seeds 3` print the
 * same as tables.
 */
const LONG = process.env.RUNELOOM_BALANCE === '1';
const SEEDS = LONG ? 10 : 2;
const rooms = loadAllRooms();

describe('per-encounter combat sims at the expected level', () => {
  for (const key of campaignOrder) {
    it(`${key} (level ${expectedCharacters[key].level}): the bot finishes it without dying`, () => {
      for (let seed = 1; seed <= SEEDS; seed++) {
        const log = runEncounter({ rooms, key, seed });
        expect({ seed, deaths: log.deaths, causes: log.deathCauses }).toEqual({
          seed,
          deaths: 0,
          causes: [],
        });
        expect(log.done).toBe(true);
        if (key === 'k5' || key === 'k10') expect(log.bossSeconds).toBeGreaterThan(0);
      }
    });
  }
});

describe('the campaign', () => {
  it.runIf(LONG)(
    'reaches the Cinder Warden at about level 12 and kills him in 90 to 150 s without dying',
    () => {
      for (const seed of [1, 2, 3]) {
        const r = runCampaign({ seed, rooms });
        const warden = r.logs.find((l) => l.key === 'k10')!;
        expect(r.deaths).toBe(0);
        expect(r.logs.every((l) => l.done)).toBe(true);
        expect(warden.entryLevel).toBeGreaterThanOrEqual(11);
        expect(warden.entryLevel).toBeLessThanOrEqual(13);
        expect(warden.bossSeconds).toBeGreaterThanOrEqual(90);
        expect(warden.bossSeconds).toBeLessThanOrEqual(150);
      }
    },
  );

  it('is deterministic', () => {
    const a = runCampaign({ seed: 7, rooms, until: 'e2' });
    const b = runCampaign({ seed: 7, rooms, until: 'e2' });
    expect(JSON.stringify(a.logs)).toBe(JSON.stringify(b.logs));
    expect(a.hero).toEqual(b.hero);
  });
});
