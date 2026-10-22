import { describe, expect, it } from 'vitest';
import { step, type GameState } from '../../../src/sim';
import { BOLT, prepare, STRIKE, T } from './regionSolve';

/**
 * Regression (M5 playtest): the Tinderlings used to start inside E2's maze on grass and burn it
 * down before the player arrived. They now wait in the east clearing and the maze paths are dirt,
 * so only the bramble walls burn, and only when someone lights them.
 */
function burningMazeCells(s: GameState): number {
  const g = s.grid;
  let n = 0;
  for (let y = 0; y < g.height; y++)
    for (let x = T(7) - 2; x < T(46) + 2; x++) if (g.fire[y * g.width + x]! > 0) n++;
  return n;
}

describe('E2 Thicket', () => {
  it('the maze is still unburnt 20 s after walking in from the west, AI on', () => {
    const { state } = prepare('e2', { arrive: 'w', weaves: [BOLT, STRIKE, null, null] });
    for (let i = 0; i < 20 * 60; i++)
      step(state, { moveX: 0, moveY: 0, aimX: state.player.x + 1, aimY: state.player.y, buttons: 0 });
    expect(burningMazeCells(state)).toBe(0);
    expect(state.enemies.filter((e) => e.kind === 'tinderling' && !e.dead)).toHaveLength(8);
    for (const e of state.enemies) if (e.kind === 'tinderling') expect(e.x).toBeGreaterThan(T(47));
  });

  it('a Fire Bolt into a bramble wall still sets the walls burning', () => {
    const { state } = prepare('e2', { arrive: 'w', weaves: [BOLT, STRIKE, null, null], noAI: true });
    const p = state.player;
    // Wall column 7 runs north–south at the maze's west edge; aim along the entrance row into it.
    for (let i = 0; i < 60; i++)
      step(state, { moveX: 0, moveY: 0, aimX: T(20), aimY: p.y, buttons: i < 30 ? 1 : 0 });
    for (let i = 0; i < 120; i++) step(state, { moveX: 0, moveY: 0, aimX: T(20), aimY: p.y, buttons: 0 });
    expect(burningMazeCells(state)).toBeGreaterThan(0);
  });
});
