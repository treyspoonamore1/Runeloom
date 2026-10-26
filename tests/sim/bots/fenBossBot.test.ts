/**
 * M8 phase 1 acceptance (BUILD_PLAN): the tier 8 reference character (bots/fenBossBot.ts) kills the
 * Old Bellwether in 60–100 s and the Glasswater Coil in 120–180 s using Tide strands, and without
 * Tide clearly slower. Deterministic per seed.
 */
import { describe, expect, it } from 'vitest';
import { runFenBossFight, type FenTide } from '../../../src/sim/bots/fenBossBot';
import { loadAllRooms } from '../../../tools/lib/rooms';

const rooms = loadAllRooms();

const bell = (seed: number) =>
  runFenBossFight({ rooms, roomId: 'test/boss_bellwether', seed, tide: 'none', start: { x: 52, y: 74 } });
const coil = (seed: number, tide: FenTide, maxSeconds = 300) =>
  runFenBossFight({ rooms, roomId: 'test/boss_coil', seed, tide, start: { x: 62, y: 88 }, maxSeconds });

describe('Fen boss bot', () => {
  it('kills the Old Bellwether in 60–100 s, ringing it through the ring', () => {
    for (const seed of [1, 2]) {
      const log = bell(seed);
      console.log(`Bellwether seed ${seed}: ${log.seconds.toFixed(1)} s, ${log.rings} rings, took ${log.damageTaken.toFixed(0)}`);
      expect(log.killed).toBe(true);
      expect(log.died).toBe(false);
      expect(log.seconds).toBeGreaterThanOrEqual(60);
      expect(log.seconds).toBeLessThanOrEqual(100);
      expect(log.rings).toBeGreaterThanOrEqual(4);
      expect(log.phaseAt[0]).not.toBeNull();
    }
  });

  it('kills the Glasswater Coil in 120–180 s with Tide strands, the same way every time', () => {
    const a = coil(1, 'tide');
    const b = coil(1, 'tide');
    console.log(`Coil with Tide: ${a.seconds.toFixed(1)} s, ${a.lures} lures, ${a.strands} strands, ${a.overloads} Overloads`);
    expect(a.killed).toBe(true);
    expect(a.died).toBe(false);
    expect(a.seconds).toBeGreaterThanOrEqual(120);
    expect(a.seconds).toBeLessThanOrEqual(180);
    expect(a.strands).toBeGreaterThanOrEqual(2);
    expect(a.phaseAt.every((t) => t !== null)).toBe(true);
    expect(b).toEqual(a);
  });

  it('without Tide the Coil takes far longer', () => {
    const tide = coil(2, 'tide');
    const none = coil(2, 'none', 2 * tide.seconds);
    console.log(`Coil seed 2: Tide ${tide.seconds.toFixed(1)} s; without, ${none.killed ? '' : 'not dead after '}${none.seconds.toFixed(1)} s`);
    expect(tide.killed).toBe(true);
    expect(none.strands).toBe(0);
    expect(none.seconds).toBeGreaterThanOrEqual(2 * tide.seconds - 1);
  });
});
