/**
 * Playtest 8 ("I could still hit it under water", "I couldn't figure out what to do with the
 * bells"): the Fen bosses' state line reads the sim's own flags and multipliers, so it says how
 * much less or more damage each state takes, the same numbers the sim applies.
 */
import { describe, expect, it } from 'vitest';
import { roomTexts } from '../../src/app/rooms';
import { bossStatus } from '../../src/app/bossStatus';
import { createAdventure, type Enemy, type GameState } from '../../src/sim';
import { coilTakenMult } from '../../src/sim/ai/bosses/coilState';
import { bellTakenMult } from '../../src/sim/actors/fenShells';
import { enemyDef } from '../../data/enemies';

function arena(roomId: string): { s: GameState; e: Enemy } {
  const s = createAdventure({ seed: 1, rooms: roomTexts, startRoomId: roomId });
  return { s, e: s.enemies.find((x) => x.boss)! };
}

describe('Fen boss state line', () => {
  it('names each Coil state and its damage taken from the live multipliers', () => {
    const { s, e } = arena('test/boss_coil');
    const f = e.boss!.fen!;
    expect(f.coil).toBe('submerged');
    e.boss!.phase = 1;
    expect(1 - coilTakenMult(s, e)).toBeCloseTo(0.75);
    expect(bossStatus(s, e)!.line).toBe('Submerged · 75% less damage');
    e.boss!.phase = 2;
    expect(bossStatus(s, e)!.line).toBe('Submerged · 90% less damage');
    expect(bossStatus(s, e)!.tone).toBe('guard');
    const lines: Record<string, string> = {};
    for (const m of ['surfaced', 'exposed', 'stranded', 'iced', 'overloaded'] as const) {
      f.coil = m;
      lines[m] = bossStatus(s, e)!.line;
    }
    expect(lines).toEqual({
      surfaced: 'Surfaced · full damage',
      exposed: "Exposed · full damage, can't dive",
      stranded: 'Stranded · 50% more damage',
      iced: "Iced · can't move or attack",
      overloaded: 'Overloaded · stunned',
    });
    f.coil = 'stranded';
    expect(bossStatus(s, e)!.pop).toBe('STRANDED');
    f.coil = 'surfaced';
    expect(bossStatus(s, e)!.pop).toBeNull();
  });

  it('follows tuning: a retuned dive reads its new number', () => {
    const { s, e } = arena('test/boss_coil');
    e.boss!.phase = 2;
    s.tuning.bosses.coilDiveTaken = 0.3;
    expect(bossStatus(s, e)!.does).toBe('70% less damage');
  });

  it('names the Bellwether shelled, rung open and rolling from its bell rule', () => {
    const { s, e } = arena('test/boss_bellwether');
    const bell = enemyDef('bellwether').chemistry!.bell!;
    expect(bossStatus(s, e)!.line).toBe('Shelled · 80% less damage');
    expect(bellTakenMult(e, bell)).toBeCloseTo(0.2);
    e.special.dashSpeed = 40;
    expect(bossStatus(s, e)!.line).toBe("Rolling · can't be rung");
    e.special.openLeft = 3;
    const rung = bossStatus(s, e)!;
    expect(rung.line).toBe('Rung open · 25% more damage');
    // The shared ring effect shows "RUNG!" (pt8hits); no second pop.
    expect(rung.pop).toBeNull();
    expect(rung.tone).toBe('open');
    expect(bellTakenMult(e, bell)).toBeCloseTo(1.25);
  });

  it('has no state line for bosses without Fen states', () => {
    const { s, e } = arena('kiln/k10_wardens_hearth');
    expect(e.kind).toBe('cinder_warden');
    expect(bossStatus(s, e)).toBeNull();
  });
});
