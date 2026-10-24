/**
 * Kindred Flame (M7 mutation, CONTENT §11): fire you create also spreads to adjacent Oiled or
 * Ignited enemies. When the player's fire newly ignites an enemy, every other live enemy within
 * mutationEffects.kindredFlame.reach cells of its body (edge to edge) that is Oiled or Ignited
 * is ignited by the player too, one hop, at the same strength before fire resistance.
 */
import { describe, expect, it } from 'vitest';
import { mutationEffects } from '../../../data/hearth';
import { OWNER } from '../../../data/materials';
import { applyIgnite, hashState, PLAYER_ID, refreshHero, type Enemy, type GameState } from '../../../src/sim';
import { addEnemy, arena, hitWith } from './helpers';
import { apply, room, run } from '../terrain/helpers';
import { circle } from '../grid/helpers';

const REACH = mutationEffects.kindredFlame.reach;

function kindred(s: GameState, owned = true): GameState {
  if (owned) s.hero.hearth.mutations.kindred_flame = 1;
  refreshHero(s);
  return s;
}

const oil = (e: Enemy) => ((e.terrain.oiledLeft = 5), e);
const wet = (e: Enemy) => ((e.terrain.wetLeft = 5), e);
const burning = (e: Enemy) => e.ailments.ignite.timeLeft > 0;

type Dir = 'e' | 'w' | 'n' | 's';
const DIRS: Record<Dir, [number, number]> = { e: [1, 0], w: [-1, 0], n: [0, -1], s: [0, 1] };

/** An enemy whose body is `gap` cells (edge to edge) from `e`'s, toward `dir`. */
function beside(s: GameState, e: Enemy, gap: number, dir: Dir = 'e'): Enemy {
  const n = addEnemy(s, 'dummy', e.x, e.y);
  const d = e.radius + n.radius + gap;
  n.x = e.x + DIRS[dir][0] * d;
  n.y = e.y + DIRS[dir][1] * d;
  return n;
}

/** The player's fire hit on `a` and the neighbours around it. */
function scene(owned: boolean) {
  const s = kindred(arena(), owned);
  const a = addEnemy(s, 'dummy', 100, 60);
  const oiled = oil(beside(s, a, REACH * 0.9));
  const ignited = beside(s, a, REACH * 0.5, 'w');
  applyIgnite(s, ignited, 0.5, 1, -1); // world fire, weak
  const dry = beside(s, a, 0.2, 'n');
  const far = oil(beside(s, a, REACH + 0.3, 's'));
  return { s, a, oiled, ignited, dry, far };
}

describe('Kindred Flame', () => {
  it('adds its reach to HeroMods only when owned', () => {
    expect(kindred(arena(), false).heroMods.effects.kindred_flame).toBeUndefined();
    expect(kindred(arena()).heroMods.effects.kindred_flame).toBe(REACH);
  });

  it("the player's fire hit spreads to adjacent Oiled and Ignited enemies, not dry or distant ones", () => {
    const { s, a, oiled, ignited, dry, far } = scene(true);
    hitWith(s, a, 40, 'fire');
    const ig = a.ailments.ignite;
    expect(ig.timeLeft).toBeGreaterThan(0);
    for (const n of [oiled, ignited]) {
      expect(n.ailments.ignite).toMatchObject({ dps: ig.dps, timeLeft: ig.timeLeft, sourceId: PLAYER_ID });
      expect(n.ailments.ignite.owner).toBe(OWNER.player);
    }
    expect(burning(dry)).toBe(false);
    expect(burning(far)).toBe(false);
  });

  it('does nothing without the mutation', () => {
    const { s, a, oiled, ignited } = scene(false);
    hitWith(s, a, 40, 'fire');
    expect(burning(a)).toBe(true);
    expect(burning(oiled)).toBe(false);
    expect(ignited.ailments.ignite.dps).toBe(0.5);
  });

  it('never spreads monster-made or world fire', () => {
    const { s, a, oiled } = scene(true);
    hitWith(s, a, 40, 'fire', { sourceId: oiled.id + 100 });
    expect(burning(a)).toBe(true);
    expect(burning(oiled)).toBe(false);
    applyIgnite(s, a, 99, 4, -1);
    expect(burning(oiled)).toBe(false);
  });

  it('spreads one hop only, skips Wet neighbours, and scales by each one’s fire resistance', () => {
    const s = kindred(arena());
    const a = addEnemy(s, 'dummy', 100, 60);
    const b = oil(beside(s, a, 0.1));
    const c = oil(beside(s, b, 0.1)); // next to b, out of a's reach
    const d = wet(oil(beside(s, a, 0.1, 'n')));
    b.resist.fire = 0.5;
    hitWith(s, a, 40, 'fire');
    expect(b.ailments.ignite.dps).toBeCloseTo(a.ailments.ignite.dps * 0.5, 9);
    expect(burning(c)).toBe(false);
    expect(burning(d)).toBe(false);
  });

  it('a refresh (standing in the fire) does not spread again; a new ignite does', () => {
    const { s, a, oiled } = scene(true);
    applyIgnite(s, a, 5, 4, PLAYER_ID, OWNER.player, true);
    expect(burning(oiled)).toBe(true);
    oiled.ailments.ignite.timeLeft = oiled.ailments.ignite.dps = 0;
    applyIgnite(s, a, 5, 4, PLAYER_ID, OWNER.player, true);
    expect(burning(oiled)).toBe(false);
  });

  it("the player's burning ground spreads it too (rule 16)", () => {
    for (const owned of [false, true]) {
      const s = kindred(room('.', 30, 20, 40, 40), owned);
      s.cheats.noAI = true;
      const a = addEnemy(s, 'dummy', 80, 40);
      const n = oil(beside(s, a, 0.3));
      apply(s, 'fire', circle(80, 40, 1), { durationMult: 4 });
      run(s, 1);
      expect(burning(a)).toBe(true);
      expect(burning(n)).toBe(owned);
      if (owned) expect(n.ailments.ignite.owner).toBe(OWNER.player);
    }
  });

  it('is deterministic', () => {
    const go = () => {
      const { s, a } = scene(true);
      hitWith(s, a, 40, 'fire');
      run(s, 90);
      return hashState(s);
    };
    expect(go()).toBe(go());
  });
});
