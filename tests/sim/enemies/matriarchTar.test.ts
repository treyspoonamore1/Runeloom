import { describe, expect, it } from 'vitest';
import { applyElement, PLAYER_ID, spillOil, type GameState } from '../../../src/sim';
import { OWNER, SURFACE } from '../../../data/materials';
import { spillOil as spillOilOnGrid } from '../../../src/sim/grid/oil';
import { idx, ofType, room, run } from '../terrain/helpers';

/**
 * CONTENT §5 Tar Matriarch: her oil is tar (grid.tar). Fire on tar is world-owned whoever lights
 * it, so it hurts everyone, the player who lit it included; other oil keeps DESIGN §6.3 ownership.
 */

function playerFire(s: GameState, x: number, y: number, r = 1): void {
  applyElement(s, {
    element: 'fire',
    shape: { kind: 'circle', x, y, r },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 0,
    durationMult: 1,
  });
}

describe('Tar Matriarch tar', () => {
  it('a tar splat is oil marked as tar; other oil is not', () => {
    const s = room('.');
    spillOil(s, 40, 40, 3, true);
    spillOil(s, 70, 40, 3);
    expect(s.grid.surface[idx(s, 40, 40)]).toBe(SURFACE.oil);
    expect(s.grid.tar[idx(s, 40, 40)]).toBe(1);
    expect(s.grid.surface[idx(s, 70, 40)]).toBe(SURFACE.oil);
    expect(s.grid.tar[idx(s, 70, 40)]).toBe(0);
  });

  it('player fire on tar burns world-owned (tarIgnited) and hurts the player standing in it', () => {
    const s = room('.', 30, 20, 40, 40);
    spillOil(s, 40, 40, 3, true);
    run(s, 1); // standing in it: Oiled
    const life = s.player.life;
    playerFire(s, 40, 40);
    const ev = run(s, 30);
    expect(s.grid.owner[idx(s, 40, 40)]).toBe(OWNER.world);
    expect(ofType(ev, 'tarIgnited').length).toBeGreaterThan(0);
    expect(s.player.ailments.ignite.timeLeft).toBeGreaterThan(0);
    expect(s.player.life).toBeLessThan(life);
  });

  it('player fire on other oil stays player-owned and never hurts the player (earlier rooms unchanged)', () => {
    const s = room('.', 30, 20, 40, 40);
    spillOil(s, 40, 40, 3);
    run(s, 1);
    const life = s.player.life;
    playerFire(s, 40, 40);
    const ev = run(s, 30);
    expect(s.grid.owner[idx(s, 40, 40)]).toBe(OWNER.player);
    expect(ofType(ev, 'tarIgnited')).toHaveLength(0);
    expect(s.player.life).toBe(life);
  });

  it('player fire spreading from oil into tar turns world-owned there and keeps spreading as world fire', () => {
    const s = room('.', 30, 20, 100, 60);
    spillOil(s, 30, 40, 3);
    spillOil(s, 36, 40, 3, true); // touches the oil
    playerFire(s, 30, 40);
    run(s, 60);
    // The tar cells caught from the player's fire and burned world-owned (or already burned out).
    const lit = [...Array(9).keys()].map((k) => idx(s, 35 + (k % 3), 39 + Math.floor(k / 3)));
    for (const i of lit) expect(s.grid.fire[i]! > 0 ? s.grid.owner[i] : OWNER.world).toBe(OWNER.world);
    expect(s.grid.owner[idx(s, 30, 40)]).toBe(OWNER.player);
  });

  it('tar spilled into fire catches world-owned at once', () => {
    const s = room('.');
    playerFire(s, 40, 40, 2);
    spillOil(s, 40, 40, 2, true);
    expect(s.grid.fire[idx(s, 40, 40)]).toBeGreaterThan(0);
    expect(s.grid.owner[idx(s, 40, 40)]).toBe(OWNER.world);
  });

  it('burnt-out tar leaves no tar mark; plain oil spilled over tar replaces it', () => {
    const s = room('.', 30, 20, 100, 60);
    spillOil(s, 40, 40, 2, true);
    playerFire(s, 40, 40);
    run(s, 4 * 60);
    expect(s.grid.surface[idx(s, 40, 40)]).toBe(SURFACE.none);
    expect(s.grid.tar[idx(s, 40, 40)]).toBe(0);
    spillOil(s, 60, 40, 2, true);
    // Enemy oil (a Hulk's trail) leaves tar alone; an oil barrel's spill replaces it with plain oil.
    spillOil(s, 60, 40, 2);
    expect(s.grid.tar[idx(s, 60, 40)]).toBe(1);
    spillOilOnGrid(s, 60, 40, 2);
    expect(s.grid.surface[idx(s, 60, 40)]).toBe(SURFACE.oil);
    expect(s.grid.tar[idx(s, 60, 40)]).toBe(0);
  });
});
