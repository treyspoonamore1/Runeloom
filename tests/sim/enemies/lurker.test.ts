import { describe, expect, it } from 'vitest';
import { aggro, isWet, PLAYER_ID, type GameState } from '../../../src/sim';
import { apply } from '../terrain/helpers';
import { arena, groundAt, isWaterCode, ofType, paintRect, run, spawn } from './helpers';

/** CONTENT §5 Bog Lurker: submerged, lunges after a 1.2 s ripple, always Wet, stays in water, trapped in ice. */

/** A pool of shallow water x 20–60, y 20–60 (deep in the middle) in an open stone room. */
function pond(px: number, py: number): GameState {
  const s = arena(px, py, 3);
  paintRect(s, 20, 20, 59, 59, 'shallow_water');
  paintRect(s, 30, 30, 49, 49, 'deep_water');
  return s;
}

describe('Bog Lurker', () => {
  it('stays in its water while it drifts toward a player on land, submerged and always Wet', () => {
    const s = pond(110, 40);
    const l = spawn(s, 'bog_lurker', 40, 40);
    aggro(s, l);
    let left = false;
    for (let i = 0; i < 600; i++) {
      run(s, 1);
      if (!isWaterCode(groundAt(s, l.x, l.y))) left = true;
    }
    expect(left).toBe(false);
    // It waits at the shore nearest the player.
    expect(l.x).toBeGreaterThan(55);
    expect(l.special.submerged).toBe(true);
    expect(isWet(l)).toBe(true);
    expect(l.terrain.wetLeft).toBe(s.tuning.terrain.wetSeconds);
    // Deep water never makes it fall.
    expect(ofType(run(s, 1), 'fell')).toHaveLength(0);
  });

  it('surfaces and lunges with a 1.2 s ripple telegraph, bites on contact, never leaves the water', () => {
    const s = pond(62, 40);
    s.cheats.god = true;
    const l = spawn(s, 'bog_lurker', 56, 40);
    aggro(s, l);
    l.ai.cooldown = 0;
    const ev = run(s, 2);
    expect(ofType(ev, 'lurkerSurface')).toMatchObject([{ id: l.id }]);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ id: l.id, attack: 'lunge', windup: 1.2 }]);
    expect(l.special.submerged).toBe(false);
    expect(l.attack.shape.kind).toBe('line');
    const after = run(s, 72 + 30);
    const bites = ofType(after, 'hit').filter((h) => h.target === 'player' && h.sourceId === l.id);
    expect(bites).toHaveLength(1);
    expect(isWaterCode(groundAt(s, l.x, l.y))).toBe(true);
    // The dash ran to the water's edge (x < 60) and stopped there.
    expect(l.x).toBeGreaterThan(56);
    expect(l.x).toBeLessThan(60);
    const later = run(s, 120);
    expect(ofType(later, 'lurkerSubmerge')).toHaveLength(1);
  });

  it('does not lunge at a player standing well up the bank, out of its reach', () => {
    const s = pond(68, 40);
    const l = spawn(s, 'bog_lurker', 56, 40);
    aggro(s, l);
    const ev = run(s, 300);
    expect(ofType(ev, 'telegraph')).toHaveLength(0);
    expect(l.x).toBeGreaterThan(57);
  });

  it('a player who steps out of the line during the ripple is not bitten', () => {
    const s = pond(62, 40);
    const l = spawn(s, 'bog_lurker', 56, 40);
    aggro(s, l);
    l.ai.cooldown = 0;
    run(s, 2);
    // Walk away north for the rest of the telegraph and the lunge.
    const ev = run(s, 100, 0, undefined, [0, -1]);
    expect(ofType(ev, 'hit').filter((h) => h.target === 'player')).toHaveLength(0);
  });

  it('is trapped while its water is frozen, and free again when the ice thaws', () => {
    const s = pond(110, 40);
    const l = spawn(s, 'bog_lurker', 25, 40);
    aggro(s, l);
    apply(s, 'frost', { kind: 'circle', x: 25, y: 40, r: 4 });
    const ev = run(s, 1);
    expect(ofType(ev, 'lurkerTrapped')).toMatchObject([{ id: l.id, trapped: true }]);
    const x = l.x;
    run(s, 300);
    expect(l.x).toBe(x);
    expect(l.ai.mode).toBe('trapped');
    // Ice thaws after 15 s (rule 7).
    const thaw = run(s, 15 * 60);
    expect(ofType(thaw, 'lurkerTrapped')).toMatchObject([{ id: l.id, trapped: false }]);
    run(s, 60);
    expect(l.x).not.toBe(x);
  });

  it('takes 30% more Storm damage and is hit by electrified water (it is always in it)', () => {
    const s = pond(110, 40);
    s.cheats.noAI = true;
    const l = spawn(s, 'bog_lurker', 40, 40);
    run(s, 1);
    const life = l.life;
    apply(s, 'storm', { kind: 'circle', x: 37, y: 40, r: 1 }, { hitDamage: 10, sourceId: PLAYER_ID });
    const ev = run(s, 1);
    expect(ofType(ev, 'chargeHit').filter((c) => c.target === l.id)).toHaveLength(1);
    expect(life - l.life).toBeGreaterThan(0);
    expect(l.resist.storm).toBe(-0.3);
  });
});
