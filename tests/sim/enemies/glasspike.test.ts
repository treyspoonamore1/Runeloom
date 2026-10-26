import { describe, expect, it } from 'vitest';
import { aggro, isStranded, isWet, landingPoint, setGround, type GameState } from '../../../src/sim';
import { arena, groundAt, idx, isWaterCode, MAT, ofType, paintRect, run, spawn } from './helpers';

/**
 * CONTENT §5 Glasspike: hides in water; within 16 cells of its water and in sight it flashes 0.8 s
 * with a 3-cell landing circle, leaps 0.5 s to the water nearest the player within 4 cells (else the
 * player's spot) and bites 16 on landing. Dry ground or ice strands it (rule 31).
 */

/** A deep pool x 20–39, y 30–49 with a shallow rim; the player on the bank to the east. */
function pond(px: number, py = 40): GameState {
  const s = arena(px, py, 1);
  paintRect(s, 20, 30, 39, 49, 'shallow_water');
  paintRect(s, 22, 32, 37, 47, 'deep_water');
  return s;
}

describe('Glasspike', () => {
  it('hides submerged and swims to the shore nearest the player, always Wet', () => {
    const s = pond(80);
    const g = spawn(s, 'glasspike', 25, 40);
    aggro(s, g);
    run(s, 120);
    expect(g.special.submerged).toBe(true);
    expect(isWet(g)).toBe(true);
    expect(g.x).toBeGreaterThan(37);
    expect(isWaterCode(groundAt(s, g.x, g.y))).toBe(true);
  });

  it('flashes 0.8 s with a 3-cell landing circle on the player, leaps in 0.5 s and bites 16 on landing', () => {
    const s = pond(50);
    s.cheats.god = true;
    const g = spawn(s, 'glasspike', 38.5, 40.5);
    aggro(s, g);
    g.ai.cooldown = 0;
    const ev = run(s, 2);
    expect(ofType(ev, 'telegraph')).toMatchObject([{ id: g.id, attack: 'pike_leap', windup: 0.8 }]);
    expect(g.attack.shape).toEqual({ kind: 'circle', r: 3 });
    // No water within 4 cells of the player: it aims at the player's spot.
    expect([g.attack.originX, g.attack.originY]).toEqual([50, 40]);
    const flight = run(s, 48);
    const leap = ofType(flight, 'pikeLeap');
    expect(leap).toMatchObject([{ id: g.id, toX: 50, toY: 40, seconds: 0.5 }]);
    // In the air halfway through.
    run(s, 15);
    expect(g.x).toBeGreaterThan(41);
    expect(g.x).toBeLessThan(48);
    const landing = run(s, 20);
    expect(ofType(landing, 'pikeLand')).toMatchObject([{ id: g.id, x: 50, y: 40, onWater: false }]);
    const bites = ofType(landing, 'hit').filter((h) => h.target === 'player' && h.sourceId === g.id);
    expect(bites).toHaveLength(1);
    expect(bites[0]!.amount).toBeCloseTo(16);
  });

  it('strands itself on dry ground (stand well back from the water), then crawls back and submerges', () => {
    const s = pond(48);
    s.cheats.god = true;
    const g = spawn(s, 'glasspike', 38.5, 40.5);
    aggro(s, g);
    g.ai.cooldown = 0;
    const ev = run(s, 90);
    expect(ofType(ev, 'swimmerStranded')).toMatchObject([{ id: g.id, stranded: true }]);
    expect(isStranded(g)).toBe(true);
    // Stranded: 50% more damage taken and no attacks while it lies there.
    s.player.x = g.x + 2;
    g.ai.cooldown = 0;
    const lying = run(s, 100);
    expect(ofType(lying, 'telegraph').filter((t) => t.id === g.id)).toHaveLength(0);
    // The player steps far away, so it doesn't leap again once it is back.
    s.player.x = 150;
    const back = run(s, 300);
    expect(ofType(back, 'swimmerStranded')).toMatchObject([{ id: g.id, stranded: false }]);
    expect(ofType(back, 'lurkerSubmerge').filter((x) => x.id === g.id)).toHaveLength(1);
    expect(isWaterCode(groundAt(s, g.x, g.y))).toBe(true);
  });

  it('lands in water near a player who stands by it, and does not strand', () => {
    const s = pond(43);
    s.cheats.god = true;
    const g = spawn(s, 'glasspike', 30.5, 40.5);
    aggro(s, g);
    g.ai.cooldown = 0;
    expect(landingPoint(s, 4)).toEqual({ x: 39.5, y: 39.5 });
    const ev = run(s, 2 + 48 + 35);
    expect(ofType(ev, 'pikeLand')).toMatchObject([{ id: g.id, onWater: true }]);
    expect(isStranded(g)).toBe(false);
  });

  it('landing on ice strands it (CONTENT §5); its water freezing traps it like a Bog Lurker', () => {
    const s = pond(50);
    s.cheats.god = true;
    paintRect(s, 46, 36, 54, 44, 'ice');
    const g = spawn(s, 'glasspike', 38.5, 40.5);
    aggro(s, g);
    g.ai.cooldown = 0;
    run(s, 90);
    expect(groundAt(s, g.x, g.y)).toBe(MAT.ice);
    expect(isStranded(g)).toBe(true);

    const t = pond(80);
    const h = spawn(t, 'glasspike', 30.5, 40.5);
    run(t, 1);
    setGround(t, idx(t, h.x, h.y), MAT.ice);
    const ev = run(t, 1);
    expect(ofType(ev, 'lurkerTrapped')).toMatchObject([{ id: h.id, trapped: true }]);
    expect(isStranded(h)).toBe(false);
  });

  it('only leaps when the player is within about 16 cells', () => {
    const s = pond(60);
    const g = spawn(s, 'glasspike', 38.5, 40.5);
    aggro(s, g);
    g.ai.cooldown = 0;
    const ev = run(s, 60);
    expect(ofType(ev, 'telegraph').filter((x) => x.id === g.id)).toHaveLength(0);
  });
});
