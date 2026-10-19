/** CONTENT §2 reference weaves 1, 2, 3, 5, 6, 7 and 9: their terrain assertions (BUILD_PLAN M3 acceptance). */
import { describe, expect, it } from 'vitest';
import { AIR } from '../../../data/materials';
import {
  Button,
  DT,
  freezeTarget,
  referenceWeaves,
  spawnEnemy,
  type GameState,
  type SimEvent,
} from '../../../src/sim';
import { refreshSight } from '../../../src/sim/ai/common';
import { hitWith } from '../combat/helpers';
import { burning, dummy, idx, inCircle, MAT, ofType, paintRect, room, run, weaves } from './helpers';

const REF = (n: number) => referenceWeaves.find((w) => w.n === n)!.notation;
const LMB = Button.Cast1;

/** Presses slot 0 until its spell releases, aiming at `aim`; returns the events. */
function cast(s: GameState, aim: [number, number]): SimEvent[] {
  const t = s.weaves.slots[0]!.program!.castTime;
  const n = Math.ceil((t * 0.25 - 1e-9) / DT);
  return [...run(s, n, LMB, aim), ...run(s, 1, 0, aim)];
}

describe('reference weave terrain (CONTENT §2, M3)', () => {
  it('#1 Starter Spark: the hit enemy is Ignited and the impact ignites the grass', () => {
    const s = room('"');
    weaves(s, [REF(1)]);
    const d = dummy(s, 40, 40);
    const ev = [...cast(s, [40, 40]), ...run(s, 20)];
    const end = ofType(ev, 'spellEnd')[0]!;
    expect(d.ailments.ignite.timeLeft).toBeGreaterThan(0);
    const [lit, all] = inCircle(s, end.x, end.y, 2, burning(s));
    expect(lit).toBe(all);
  });

  it('#2 Fireline: the strip of grass ignites and its fire lasts 50% longer', () => {
    const ling = room('"', 30, 20, 20, 40);
    const plain = room('"', 30, 20, 20, 40);
    weaves(ling, [REF(2)]);
    weaves(plain, ['Cast > Swath[Fire]']);
    cast(ling, [60, 40]);
    cast(plain, [60, 40]);
    for (const x of [22, 26, 30, 33]) {
      expect(ling.grid.fire[idx(ling, x, 40)], `x ${x}`).toBeGreaterThan(0);
      expect(ling.grid.fuel[idx(ling, x, 40)]! / plain.grid.fuel[idx(plain, x, 40)]!).toBeCloseTo(1.5, 1);
    }
    // Grass burns 2 s: the plain strip is ash after 2.1 s, the Lingering one still burns.
    run(ling, 126);
    run(plain, 126);
    expect(plain.grid.ground[idx(plain, 28, 40)]).toBe(MAT.ash);
    expect(ling.grid.fire[idx(ling, 28, 40)]).toBeGreaterThan(0);
  });

  it('#3 Wildfire Seed: on a grass field, fire spreads past the nova radius within 3 s', () => {
    const s = room('"', 40, 30, 30, 60);
    weaves(s, [REF(3)]);
    const ev = cast(s, [70, 60]);
    const castTick = s.tick;
    const nova = () => s.spells.find((x) => x.form === 'nova');
    let land: { x: number; y: number } | null = null;
    const all = [...ev];
    while (s.tick - castTick < 3 * 60) {
      all.push(...run(s, 1));
      const n = nova();
      if (n && !land) land = { x: n.cx, y: n.cy };
    }
    expect(land).not.toBeNull();
    const radius = 10 * Math.sqrt(1.4);
    let beyond = 0;
    for (let y = 4; y < 116; y++)
      for (let x = 4; x < 156; x++) {
        const i = idx(s, x, y);
        const d = Math.hypot(x + 0.5 - land!.x, y + 0.5 - land!.y);
        if (d > radius + 1 && (s.grid.fire[i]! > 0 || s.grid.ground[i] === MAT.ash)) beyond++;
      }
    expect(beyond).toBeGreaterThan(20);
  });

  it('#5 Glacier Step: dodging at deep water freezes an ice bridge across the 12-cell dodge path', () => {
    const s = room('.', 30, 20, 40, 40);
    paintRect(s, 42, 4, 115, 75, 'deep_water');
    weaves(s, [REF(5)]);
    run(s, 2);
    run(s, 1, Button.Dodge, undefined, [1, 0]);
    run(s, 20);
    for (let x = 42; x <= 40 + 12; x++)
      for (const y of [39, 40, 41]) expect(s.grid.ground[idx(s, x, y)], `${x}, ${y}`).toBe(MAT.ice_bridge);
    // And it holds the player: walking onto it doesn't fall.
    const ev = run(s, 30, 0, undefined, [1, 0]);
    expect(s.player.x).toBeGreaterThan(45);
    expect(ofType(ev, 'fell')).toHaveLength(0);
  });

  it('#6 Shatter Lance: Frozen kills shatter and the nova freezes nearby water', () => {
    const s = room('.', 30, 20, 20, 40);
    paintRect(s, 30, 44, 70, 60, 'shallow_water');
    weaves(s, [REF(6)]);
    const a = spawnEnemy(s, 'tinderling', 40, 40);
    a.life = 1;
    freezeTarget(s, a, 5, 0);
    const ev = [...cast(s, [60, 40]), ...run(s, 20)];
    expect(ofType(ev, 'death').map((d) => d.shattered)).toEqual([true]);
    // The shatter burst (4 cells) and the wide nova (~11.8 cells) both freeze water south of it.
    expect(s.grid.ground[idx(s, 40, 44)]).toBe(MAT.ice);
    expect(s.grid.ground[idx(s, 40, 50)]).toBe(MAT.ice);
    expect(s.grid.ground[idx(s, 40, 58)]).toBe(MAT.shallow_water);
  });

  it('#7 Conductor: a bolt into water electrifies the connected body and Wet enemies arc', () => {
    const s = room('.', 30, 20, 20, 40);
    paintRect(s, 30, 36, 80, 44, 'shallow_water'); // 459 cells: under the 600-cell fill cap
    weaves(s, [REF(7)]);
    const first = dummy(s, 40, 40);
    const near = dummy(s, 44, 43);
    const far = dummy(s, 75, 40);
    run(s, 1);
    const ev = [...cast(s, [40, 40]), ...run(s, 20)];
    expect(ofType(ev, 'waterElectrified')).toHaveLength(1);
    expect(ofType(ev, 'arc').some((e) => e.from === first.id && e.to === near.id)).toBe(true);
    const charged = new Set(ofType(ev, 'chargeHit').map((e) => e.target));
    expect(charged.has(far.id)).toBe(true);
  });

  it('#9 Steam Veil: hurt while standing in water makes steam, and enemies inside it are Blind', () => {
    const s = room('~', 30, 20, 60, 40);
    weaves(s, [REF(9)]);
    const archer = spawnEnemy(s, 'ember_archer', 70, 40);
    run(s, 1);
    refreshSight(s, archer);
    expect(archer.ai.los).toBe(true);
    hitWith(s, s.player, 8, 'physical', { sourceId: archer.id });
    run(s, 20);
    expect(s.grid.air[idx(s, 60, 40)]).toBe(AIR.steam);
    expect(s.grid.air[idx(s, 70, 40)]).toBe(AIR.steam);
    expect(archer.terrain.blind).toBe(true);
    refreshSight(s, archer);
    expect(archer.ai.los).toBe(false);
    // Fire on water: steam, not burning.
    expect(s.grid.fire.every((f) => f === 0)).toBe(true);
  });
});
