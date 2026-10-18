import { describe, expect, it } from 'vitest';
import { createGame, kiterInput, spawnGroup, step, SIM_HZ } from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';

/** BUILD_PLAN M1 acceptance: the scripted kite-and-fight bot clears a 20-enemy wave without dying. */
describe('kiter bot vs a 20-enemy wave (M1 acceptance)', () => {
  const LIMIT_SECONDS = 90;
  const SEED = 1;

  it('clears 12 Tinderlings, 5 Ember Archers and 3 Shieldbearers at area level 1 without dying', () => {
    const state = createGame({ seed: SEED, roomText: loadRoomText('test/arena'), spawnRoomEnemies: false });
    const wave = spawnGroup(state, { tinderling: 12, ember_archer: 5, shieldbearer: 3 }, 1);
    expect(wave).toHaveLength(20);
    let damageTaken = 0;
    let hitsTaken = 0;
    let deaths = 0;
    let clearedAt = -1;
    for (let i = 0; i < LIMIT_SECONDS * SIM_HZ; i++) {
      step(state, kiterInput(state));
      for (const e of state.events) {
        if (e.type === 'hit' && e.target === 'player') {
          damageTaken += e.amount;
          hitsTaken++;
        }
        if (e.type === 'playerDeath') deaths++;
      }
      if (state.enemies.length === 0) {
        clearedAt = state.tick / SIM_HZ;
        break;
      }
    }
    console.log(
      `kiter bot, seed ${SEED}: cleared in ${clearedAt.toFixed(2)} s, ` +
        `took ${damageTaken.toFixed(1)} damage in ${hitsTaken} hits, ${deaths} deaths`,
    );
    expect(deaths).toBe(0);
    expect(state.enemies).toHaveLength(0);
    expect(clearedAt).toBeGreaterThan(0);
    expect(clearedAt).toBeLessThanOrEqual(LIMIT_SECONDS);
  });
});
