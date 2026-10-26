import { describe, expect, it } from 'vitest';
import { MAT, OWNER } from '../../../data/materials';
import { PLAYER_ID, type Enemy, type GameState, type SimEvent } from '../../../src/sim';
import { apply } from '../terrain/helpers';
import { eye, hit, put } from './coilHelpers';
import { groundAt, idx, ofType, run } from './helpers';

/**
 * DESIGN §10.5 Glasswater Coil phases: the Eye pulse (phases 1–2), the dive at 66%, the pylons at
 * 33% (pylon storm every 6 s, Body pulse every 4 s, Overload by the player's charge during its
 * glow), and Iced.
 */

/** Drops the Coil to `fraction` of its life and runs until phase `phase` starts. */
function toPhase(s: GameState, c: Enemy, fraction: number, phase: number): SimEvent[] {
  c.life = c.maxLife * fraction;
  const ev: SimEvent[] = [];
  for (let i = 0; i < 600 && c.boss!.phase < phase; i++) ev.push(...run(s, 1));
  return ev;
}

/** Ticks (sim) at which events of `type` happened over `n` ticks. */
function times(s: GameState, n: number, pred: (e: SimEvent) => boolean): { at: number[]; ev: SimEvent[] } {
  const at: number[] = [];
  const all: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    const ev = run(s, 1);
    all.push(...ev);
    if (ev.some(pred)) at.push(s.tick);
  }
  return { at, ev: all };
}

/** Ticks between the first two times are `seconds` (within a tick of float timer rounding). */
function expectPeriod(at: number[], seconds: number): void {
  expect(Math.abs(at[1]! - at[0]! - seconds * 60)).toBeLessThanOrEqual(1);
}

const isPulse = (kind: 'eye' | 'body') => (e: SimEvent) => e.type === 'coilPulse' && e.pulse === kind;
const isGlow = (kind: 'eye' | 'body') => (e: SimEvent) => e.type === 'coilPulseGlow' && e.pulse === kind;

describe('Glasswater Coil phases', () => {
  it('phase 1: the Eye pulse glows 1.2 s, then electrifies all of its water as enemy charge, every 7 s', () => {
    const { s, c } = eye(62, 84);
    const glows = times(s, 20 * 60, isGlow('eye'));
    const p = glows.ev.filter(isPulse('eye'));
    expect(glows.at.length).toBeGreaterThanOrEqual(2);
    expectPeriod(glows.at, 7);
    const glow = ofType(glows.ev, 'coilPulseGlow')[0]!;
    expect(glow).toMatchObject({ id: c.id, pulse: 'eye', seconds: 1.2, reach: 80 });
    expect(p[0]).toMatchObject({ type: 'coilPulse', damage: 120, reach: 80 });
    const water = ofType(glows.ev, 'waterElectrified').filter((w) => w.sourceId === c.id && !w.handoff);
    expect(water[0]!.owner).toBe(OWNER.enemy);
    // The whole Eye, rim and channels: thousands of cells, not rule 11's 600.
    expect(water[0]!.cells).toBeGreaterThan(2000);
  });

  it('at 66% it dives (coil_dive): phase 2, 90% less while Submerged, and the Eye pulse every 5 s', () => {
    const { s, c } = eye(62, 84);
    const ev = toPhase(s, c, 0.65, 2);
    expect(ofType(ev, 'telegraph').some((t) => t.attack === 'coil_dive')).toBe(true);
    expect(ofType(ev, 'bossPhase')).toMatchObject([{ id: c.id, phase: 2 }]);
    const glows = times(s, 12 * 60, isGlow('eye'));
    expect(glows.at.length).toBeGreaterThanOrEqual(2);
    expectPeriod(glows.at, 5);
  });

  it('phases 2–3: it chases the player through any water, so borrowed water lures it out of the Eye', () => {
    const { s, c } = eye(62, 90);
    c.boss!.phase = 2;
    for (let y = 72; y <= 82; y++) apply(s, 'tide', { kind: 'circle', x: 62, y, r: 2 });
    expect(groundAt(s, 62, 80)).toBe(MAT.shallow_water);
    let out = false;
    for (let i = 0; i < 8 * 60 && !out; i++) {
      run(s, 1);
      out = c.y > 74;
    }
    expect(out).toBe(true);
    expect(c.boss!.fen!.coil).toBe('exposed');
  });

  it('it keeps to deep water rather than its own rim', () => {
    const { s, c } = eye(62, 84);
    c.boss!.phase = 2;
    run(s, 8 * 60);
    expect(groundAt(s, c.x, c.y)).toBe(MAT.deep_water);
  });

  it('at 33% it calls the pylons: the Eye pulse stops; every 6 s the four pylons glow 1.2 s (pylonGlow) and electrify their pads and the rim', () => {
    const { s, c } = eye(62, 84);
    toPhase(s, c, 0.65, 2);
    const ev = toPhase(s, c, 0.32, 3);
    expect(ofType(ev, 'telegraph').some((t) => t.attack === 'call_pylons')).toBe(true);
    const storm = times(s, 14 * 60, (e) => e.type === 'coilPylonStorm');
    expect(storm.at.length).toBeGreaterThanOrEqual(2);
    expectPeriod(storm.at, 6);
    expect(ofType(storm.ev, 'pylonGlow').length).toBeGreaterThanOrEqual(8);
    expect(ofType(storm.ev, 'pylonGlow')[0]!.seconds).toBe(1.2);
    expect(ofType(storm.ev, 'coilPylonStorm')[0]!).toMatchObject({ damage: 90 });
    expect(ofType(storm.ev, 'coilPylonStorm')[0]!.pylons).toHaveLength(4);
    const metal = ofType(storm.ev, 'metalElectrified').filter((m) => m.sourceId === c.id);
    expect(metal.length).toBeGreaterThanOrEqual(4);
    // The pads hand the charge to the rim (rule 13).
    expect(ofType(storm.ev, 'waterElectrified').some((w) => w.sourceId === c.id && w.handoff)).toBe(true);
    expect(storm.ev.filter(isPulse('eye'))).toHaveLength(0);
  });

  it('phase 3: the Body pulse glows 1.0 s, then electrifies its water within 20 cells, every 4 s', () => {
    const { s, c } = eye(62, 84);
    toPhase(s, c, 0.65, 2);
    toPhase(s, c, 0.32, 3);
    const glows = times(s, 12 * 60, isGlow('body'));
    expect(glows.at.length).toBeGreaterThanOrEqual(2);
    expectPeriod(glows.at, 4);
    expect(ofType(glows.ev, 'coilPulseGlow').find((g) => g.pulse === 'body')).toMatchObject({ seconds: 1, reach: 20 });
    const pulse = glows.ev.find(isPulse('body'));
    expect(pulse).toMatchObject({ damage: 110, reach: 20 });
  });

  it('phase 3: the player\'s charge in its water during the glow Overloads it: no pulse, stunned 2 s, the next glow 6 s later', () => {
    const { s, c } = eye(62, 84);
    toPhase(s, c, 0.65, 2);
    toPhase(s, c, 0.32, 3);
    let ev: SimEvent[] = [];
    for (let i = 0; i < 10 * 60 && !ev.some(isGlow('body')); i++) ev = run(s, 1);
    expect(ev.some(isGlow('body'))).toBe(true);
    apply(s, 'storm', { kind: 'circle', x: c.x, y: c.y + 6, r: 1 }, { hitDamage: 30, owner: OWNER.player, sourceId: PLAYER_ID });
    const t0 = s.tick;
    const after = times(s, 8 * 60, isGlow('body'));
    expect(ofType(after.ev, 'coilOverloaded')).toMatchObject([{ id: c.id, stun: 2, delay: 6 }]);
    // No Body pulse lands until the next glow, which comes 6 s after the Overload.
    expect(after.at[0]! - t0).toBeGreaterThanOrEqual(6 * 60 - 2);
    expect(after.at[0]! - t0).toBeLessThanOrEqual(6 * 60 + 2);
    const firstPulse = after.ev.findIndex(isPulse('body'));
    const firstGlow = after.ev.findIndex(isGlow('body'));
    expect(firstPulse === -1 || firstPulse > firstGlow).toBe(true);
    expect(c.terrain.stunLeft).toBe(0);
  });

  it('Overloaded, it is stunned and takes normal damage', () => {
    const { s, c } = eye(62, 84);
    toPhase(s, c, 0.65, 2);
    toPhase(s, c, 0.32, 3);
    let ev: SimEvent[] = [];
    for (let i = 0; i < 10 * 60 && !ev.some(isGlow('body')); i++) ev = run(s, 1);
    apply(s, 'storm', { kind: 'circle', x: c.x, y: c.y + 6, r: 1 }, { hitDamage: 30, owner: OWNER.player, sourceId: PLAYER_ID });
    run(s, 2);
    expect(c.boss!.fen!.coil).toBe('overloaded');
    expect(c.terrain.stunLeft).toBeGreaterThan(1.9);
    expect(hit(s, c)).toBeCloseTo(100 * (1 + c.ailments.shock.effect), 3);
  });

  it('Iced: freezing the water under it holds it 2.5 s; then the ice within 6 cells breaks and for 10 s freezing does not hold it', () => {
    const { s, c } = eye(62, 84);
    put(s, c, 62, 46);
    apply(s, 'frost', { kind: 'circle', x: 62, y: 46, r: 8 });
    expect(groundAt(s, 62, 46)).toBe(MAT.ice_bridge);
    run(s, 2);
    expect(c.boss!.fen!.coil).toBe('iced');
    expect(hit(s, c)).toBeCloseTo(100);
    const ev = run(s, 150);
    expect(ofType(ev, 'coilIceBreak')).toMatchObject([{ id: c.id, radius: 6 }]);
    expect(groundAt(s, 62, 46)).toBe(MAT.deep_water);
    expect(groundAt(s, 62, 51)).toBe(MAT.deep_water);
    expect(groundAt(s, 62, 53.5)).toBe(MAT.ice_bridge); // beyond 6 cells
    run(s, 2);
    expect(c.boss!.fen!.coil).toBe('submerged');
    // Frozen again within 10 s: it breaks the ice at once.
    apply(s, 'frost', { kind: 'circle', x: 62, y: 46, r: 3 });
    run(s, 2);
    expect(c.special.trapped).toBe(false);
    expect(groundAt(s, 62, 46)).toBe(MAT.deep_water);
    expect(s.grid.ground[idx(s, 62, 46)]).toBe(MAT.deep_water);
  });
});
