import { describe, expect, it } from 'vitest';
import { hashState, runScenario, scenarios } from '../../src/sim';
import { loadRoomText } from '../../tools/lib/rooms';

describe('determinism', () => {
  for (const sc of scenarios) {
    it(`scenario "${sc.id}" gives the same hash on every run`, () => {
      const room = loadRoomText(sc.roomId);
      const a = runScenario(sc, room, { seed: 1, ticks: 10_000 });
      const b = runScenario(sc, room, { seed: 1, ticks: 10_000 });
      expect(a.hash).toBe(b.hash);
      expect(hashState(a.state)).toBe(a.hash);
    });
  }
});
