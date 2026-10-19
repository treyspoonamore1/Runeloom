import { describe, expect, it } from 'vitest';
import { freezeTarget, PLAYER_ID, type GameState } from '../../../src/sim';
import { hitWith } from '../combat/helpers';
import { fromFile, ofType, place, run } from './helpers';

/** CONTENT §5 Brood Kiln (`&`): 200 life, spawns 3 Kiln Mites every 5 s, stops while Frozen. */

function kilnRoom(): GameState {
  // test/enemies_kiln: a kiln on tile (20, 6), center (82, 26); the Loom Stone far away.
  const s = fromFile('test/enemies_kiln');
  s.cheats.god = true;
  return s;
}

describe('Brood Kiln', () => {
  it('spawns on every & tile, at the tile center, with 200 life scaled to the room level', () => {
    const s = kilnRoom();
    const kilns = s.enemies.filter((e) => e.kind === 'brood_kiln');
    expect(kilns).toHaveLength(1);
    expect([kilns[0]!.x, kilns[0]!.y]).toEqual([82, 26]);
    expect(kilns[0]!.maxLife).toBeCloseTo(200 * 1.12 ** 6, 6);
    expect(kilns[0]!.resist.fire).toBe(0.5);
    // Its tile stays solid: the player can't walk into it.
    expect(s.room.solid[26 * s.room.width + 82]).toBe(1);
  });

  it('wakes when the player comes near and spawns 3 aggroed mites at once, then 3 every 5 s, up to 9 alive', () => {
    const s = kilnRoom();
    const kiln = s.enemies.find((e) => e.kind === 'brood_kiln')!;
    expect(ofType(run(s, 60), 'kilnSpawn')).toHaveLength(0);
    place(s, 82, 60);
    const first = run(s, 2);
    const sp = ofType(first, 'kilnSpawn');
    expect(sp).toHaveLength(1);
    expect(sp[0]!.spawned).toHaveLength(3);
    const mites = s.enemies.filter((e) => e.kind === 'kiln_mite');
    expect(mites).toHaveLength(3);
    for (const m of mites) {
      expect(m.special.parentId).toBe(kiln.id);
      expect(m.ai.mode).not.toBe('idle');
      expect(m.areaLevel).toBe(7);
    }
    const next = run(s, 5 * 60);
    expect(ofType(next, 'kilnSpawn')).toHaveLength(1);
    run(s, 10 * 60 + 5);
    expect(s.enemies.filter((e) => e.kind === 'kiln_mite')).toHaveLength(9);
    // Full: no more until some die.
    expect(ofType(run(s, 5 * 60), 'kilnSpawn')).toHaveLength(0);
  });

  it('stops spawning while Frozen', () => {
    const s = kilnRoom();
    const kiln = s.enemies.find((e) => e.kind === 'brood_kiln')!;
    place(s, 82, 60);
    run(s, 2);
    for (const m of s.enemies) if (m.kind === 'kiln_mite') hitWith(s, m, 999, 'physical');
    run(s, 1);
    // Freeze it just before its next batch, for longer than one spawn interval.
    run(s, 4 * 60);
    freezeTarget(s, kiln, 6, PLAYER_ID);
    const frozen = run(s, 6 * 60 - 5);
    expect(ofType(frozen, 'kilnSpawn')).toHaveLength(0);
    // Thawed, the timer resumes where it stopped.
    const thawed = run(s, 2 * 60);
    expect(ofType(thawed, 'kilnSpawn')).toHaveLength(1);
  });

  it('mites swarm the player and nip for 3 (× 1.09^(L − 1))', () => {
    const s = kilnRoom();
    s.cheats.god = true;
    place(s, 82, 50);
    const ev = run(s, 180);
    const nips = ofType(ev, 'hit').filter((h) => h.target === 'player');
    expect(nips.length).toBeGreaterThan(0);
    expect(nips[0]!.amount).toBeCloseTo(3 * 1.09 ** 6, 6);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'mite_nip').length).toBeGreaterThan(0);
  });

  it('dies like any enemy; its mites live on', () => {
    const s = kilnRoom();
    const kiln = s.enemies.find((e) => e.kind === 'brood_kiln')!;
    place(s, 82, 60);
    run(s, 2);
    hitWith(s, kiln, 10_000, 'physical');
    const ev = run(s, 1);
    expect(ofType(ev, 'death').length + (kiln.dead ? 1 : 0)).toBeGreaterThan(0);
    expect(s.enemies.filter((e) => e.kind === 'kiln_mite')).toHaveLength(3);
    expect(ofType(run(s, 6 * 60), 'kilnSpawn')).toHaveLength(0);
  });
});
