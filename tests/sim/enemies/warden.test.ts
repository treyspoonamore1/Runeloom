import { describe, expect, it } from 'vitest';
import { addChill, aggro, freezeTarget, PLAYER_ID, type Enemy, type GameState } from '../../../src/sim';
import { MAT, OWNER, materialByCode } from '../../../data/materials';
import { hitWith } from '../combat/helpers';
import { fromFile, groundAt, idx, ofType, place, run } from './helpers';

/** DESIGN §10.3 / CONTENT §5 Cinder Warden (K10): three phases, flood, Superheat, brazier storm, boss chill. */

function hearth(px = 60, py = 72): { s: GameState; w: Enemy } {
  const s = fromFile('kiln/k10_wardens_hearth');
  place(s, px, py);
  s.cheats.god = true;
  const w = s.enemies.find((e) => e.kind === 'cinder_warden')!;
  aggro(s, w);
  return { s, w };
}

function waterFraction(s: GameState): number {
  let water = 0;
  let floor = 0;
  for (let i = 0; i < s.grid.width * s.grid.height; i++) {
    const d = materialByCode[s.grid.ground[i]!]!;
    if (d.water !== null) water++;
    if (d.water !== null || d.walk) floor++;
  }
  return water / floor;
}

/** Drops the Warden to `fraction` of his life and runs until the phase he enters starts. */
function toPhase(s: GameState, w: Enemy, fraction: number, phase: number) {
  w.life = w.maxLife * fraction;
  const ev = [];
  for (let i = 0; i < 600 && w.boss!.phase < phase; i++) ev.push(...run(s, 1));
  return ev;
}

describe('Cinder Warden', () => {
  it('K10 is a 120×80 arena with grass, stone, two water channels and four braziers', () => {
    const { s, w } = hearth();
    expect([s.room.width, s.room.height]).toEqual([120, 80]);
    expect([w.maxLife, w.areaLevel]).toEqual([3500, 10]);
    expect(groundAt(s, 6, 6)).toBe(MAT.grass);
    expect(groundAt(s, 60, 40)).toBe(MAT.stone);
    expect(groundAt(s, 34, 40)).toBe(MAT.shallow_water);
    expect(groundAt(s, 82, 40)).toBe(MAT.shallow_water);
    let braziers = 0;
    for (const t of s.room.tiles) if (t === 'B'.charCodeAt(0)) braziers++;
    expect(braziers).toBe(4);
  });

  it('phase 1: charges along a 1.0 s line, leaving placed fire that lights the grass ring', () => {
    const { s, w } = hearth(60, 70);
    w.ai.cooldowns[0] = 99;
    const ev = run(s, 30);
    const tel = ofType(ev, 'telegraph').filter((t) => t.attack === 'charge');
    expect(tel).toMatchObject([{ windup: 1 }]);
    expect(w.attack.shape.kind).toBe('line');
    const y0 = w.y;
    const after = run(s, 90);
    expect(w.y).toBeGreaterThan(y0 + 20);
    expect(ofType(after, 'cellIgnited').length).toBeGreaterThan(0);
    // Fire behind him on the stone, owned by the enemy team, and the grass ring catching.
    let enemyFire = 0;
    for (let y = Math.floor(y0); y < w.y; y++)
      if (s.grid.owner[idx(s, 60, y)] === OWNER.enemy && s.grid.fire[idx(s, 60, y)]! > 0) enemyFire++;
    expect(enemyFire).toBeGreaterThan(5);
    const hits = ofType(after, 'hit').filter((h) => h.target === 'player' && h.sourceId === w.id);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.amount).toBe(30);
  });

  it('phase 1: fire slam for 40 in a 6-cell circle after 0.8 s, leaving placed fire', () => {
    const { s, w } = hearth();
    place(s, w.x + 7, w.y);
    w.ai.cooldowns[1] = 99;
    const ev = run(s, 80);
    expect(ofType(ev, 'telegraph').find((t) => t.attack === 'fire_slam')).toMatchObject({ windup: 0.8 });
    const hit = ofType(ev, 'hit').find((h) => h.target === 'player' && h.sourceId === w.id)!;
    expect(hit.amount).toBe(40);
    expect(s.grid.fire[idx(s, w.x + 3, w.y)]).toBeGreaterThan(0);
  });

  it('phase 2 at 66%: floods about half the floor and becomes Superheated (70% less damage taken)', () => {
    const { s, w } = hearth();
    expect(waterFraction(s)).toBeLessThan(0.15);
    const ev = toPhase(s, w, 0.65, 2);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'flood')).toMatchObject([{ windup: 1.5 }]);
    expect(ofType(ev, 'flood')).toHaveLength(1);
    expect(ofType(ev, 'bossPhase')).toMatchObject([{ id: w.id, phase: 2 }]);
    expect(ofType(ev, 'superheatChanged')).toMatchObject([{ superheated: true }]);
    const f = waterFraction(s);
    expect(f).toBeGreaterThan(0.45);
    expect(f).toBeLessThan(0.6);
    // The flood is permanent shallow water over the old ground.
    expect(groundAt(s, 33, 9)).toBe(MAT.shallow_water);
    // (Grass his charges may have burnt to ash first.)
    expect([MAT.grass, MAT.ash]).toContain(s.grid.under[idx(s, 33, 9)]);
    const life = w.life;
    hitWith(s, w, 100, 'physical');
    expect(life - w.life).toBeCloseTo(30, 9);
  });

  it('Superheated, he builds chill only while standing in water (boss chill rule: flat 12 per hit, ×1.5 Wet)', () => {
    const { s, w } = hearth();
    toPhase(s, w, 0.65, 2);
    s.cheats.noAI = true;
    w.x = 60;
    w.y = 40; // stone
    run(s, 1);
    addChill(s, w, 12, 1, PLAYER_ID);
    expect(w.ailments.chill).toBe(0);
    w.x = 34;
    w.y = 40; // a channel
    run(s, 1);
    expect(w.boss!.inWater).toBe(true);
    hitWith(s, w, 10, 'frost');
    expect(w.ailments.chill).toBeCloseTo(18, 9);
  });

  it('freezing him breaks Superheat for 4 s, then it comes back', () => {
    const { s, w } = hearth();
    toPhase(s, w, 0.65, 2);
    s.cheats.noAI = true;
    freezeTarget(s, w, 0.8, PLAYER_ID);
    const ev = run(s, 1);
    expect(ofType(ev, 'superheatChanged')).toMatchObject([{ superheated: false, seconds: 4 }]);
    const life = w.life;
    hitWith(s, w, 100, 'physical');
    expect(life - w.life).toBeCloseTo(100, 9);
    const back = run(s, 4 * 60);
    expect(ofType(back, 'superheatChanged')).toMatchObject([{ superheated: true }]);
    expect(w.boss!.superheated).toBe(true);
  });

  it('phase 2 fire breath: a 12-cell cone for 18 + Ignite that steams the water', () => {
    const { s, w } = hearth();
    toPhase(s, w, 0.65, 2);
    w.ai.cooldowns[0] = 99;
    w.ai.cooldowns[1] = 99;
    w.ai.cooldowns[2] = 0;
    place(s, 34, 40);
    w.x = 44;
    w.y = 40;
    const ev = run(s, 180);
    expect(ofType(ev, 'telegraph').find((t) => t.attack === 'fire_breath')).toMatchObject({ windup: 0.6 });
    expect(ofType(ev, 'steam').length).toBeGreaterThan(0);
    const hit = ofType(ev, 'hit').find((h) => h.target === 'player' && h.sourceId === w.id);
    expect(hit?.amount).toBe(18);
  });

  it('phase 3 at 33%: braziers glow 1.2 s, then electrify the connected water, every 5 s', () => {
    const { s, w } = hearth();
    toPhase(s, w, 0.65, 2);
    const ev = toPhase(s, w, 0.32, 3);
    expect(ofType(ev, 'telegraph').filter((t) => t.attack === 'call_storm')).toHaveLength(1);
    expect(ofType(ev, 'bossPhase')).toMatchObject([{ phase: 3 }]);
    // Stand in the flood near a brazier.
    place(s, 36, 26);
    s.cheats.god = true;
    const log: { t: number; type: string }[] = [];
    let charged = 0;
    for (let i = 0; i < 12 * 60; i++) {
      const tick = run(s, 1);
      for (const e of tick) {
        if (e.type === 'brazierStormCharge' || e.type === 'brazierStorm')
          log.push({ t: s.tick, type: e.type });
        if (e.type === 'chargeHit' && e.target === 'player') charged++;
        if (e.type === 'brazierStormCharge') expect(e.braziers).toHaveLength(4);
      }
    }
    const glows = log.filter((l) => l.type === 'brazierStormCharge').map((l) => l.t);
    const strikes = log.filter((l) => l.type === 'brazierStorm').map((l) => l.t);
    expect(glows.length).toBeGreaterThanOrEqual(2);
    expect(strikes.length).toBeGreaterThanOrEqual(2);
    expect(strikes[0]! - glows[0]!).toBe(72); // 1.2 s
    expect(strikes[1]! - strikes[0]!).toBe(300); // 5 s
    expect(glows[1]! - glows[0]!).toBe(300);
    expect(charged).toBeGreaterThanOrEqual(2);
  });
});
