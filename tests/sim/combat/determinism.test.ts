import { describe, expect, it } from 'vitest';
import { createGame, findScenario, hashState, runScenario, step } from '../../../src/sim';
import { loadRoomText } from '../../../tools/lib/rooms';

describe('combat determinism', () => {
  const sc = findScenario('combat')!;
  const room = loadRoomText(sc.roomId);

  it('the combat scenario fights: casts, hits, kills and shield blocks', () => {
    const state = createGame({ seed: 1, roomText: room });
    const seen = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      step(state, sc.input(state.tick, state));
      for (const e of state.events) seen.set(e.type, (seen.get(e.type) ?? 0) + 1);
    }
    for (const t of [
      'cast',
      'projectileSpawn',
      'hit',
      'death',
      'dodge',
      'hitstop',
      'shieldBlock',
      'ailmentApplied',
      'dot',
    ])
      expect(seen.get(t) ?? 0, t).toBeGreaterThan(0);
  });

  it('gives the same hash for the same seed, and a different one for another seed', () => {
    const a = runScenario(sc, room, { seed: 5, ticks: 3000 });
    const b = runScenario(sc, room, { seed: 5, ticks: 3000 });
    expect(a.hash).toBe(b.hash);
    expect(hashState(a.state)).toBe(a.hash);
  });

  it('hashes enemy, projectile, combat and RNG state', () => {
    const base = () => {
      const s = createGame({ seed: 1, roomText: room });
      for (let i = 0; i < 200; i++) step(s, sc.input(s.tick, s));
      return s;
    };
    const h0 = hashState(base());
    const mutations: Array<(s: ReturnType<typeof base>) => void> = [
      (s) => (s.enemies[0]!.life -= 1),
      (s) => (s.enemies[0]!.attack.phase = 'windup'),
      (s) => (s.enemies[0]!.ai.mode = 'aggro'),
      (s) => (s.enemies[0]!.kbX += 1),
      (s) => (s.player.mana -= 1),
      (s) => (s.player.castLeft += 0.1),
      (s) => (s.hitstopLeft = 0.03),
      (s) => s.combatRng.nextU32(),
      (s) => (s.loadout[2] = 'strike'),
      (s) => s.nextId++,
      (s) => (s.enemies[0]!.ailments.ignite.dps += 1),
      (s) => (s.enemies[0]!.ailments.ignite.sourceId = 9),
      (s) => (s.enemies[0]!.ailments.chill += 1),
      (s) => (s.enemies[0]!.ailments.freeze.timeLeft += 0.1),
      (s) => (s.enemies[0]!.ailments.freeze.immuneLeft += 0.1),
      (s) => (s.enemies[0]!.ailments.shock.effect += 0.1),
      (s) => (s.enemies[0]!.ailments.dotPending += 1),
      (s) => (s.player.ailments.shock.timeLeft += 0.1),
      (s) => (s.player.ailments.dotReportLeft += 0.1),
    ];
    for (const m of mutations) {
      const s = base();
      m(s);
      expect(hashState(s)).not.toBe(h0);
    }
  });

  it('events are cleared at the start of every step', () => {
    const state = createGame({ seed: 1, roomText: room });
    step(state, { moveX: 0, moveY: 0, aimX: 200, aimY: 70, buttons: 1 });
    expect(state.events.length).toBeGreaterThan(0);
    step(state, { moveX: 0, moveY: 0, aimX: 200, aimY: 70, buttons: 0 });
    expect(state.events.some((e) => e.type === 'castStart')).toBe(false);
  });
});
