import { describe, expect, it } from 'vitest';
import { labStations } from '../../data/lab';
import { createGame, type GameState } from '../../src/sim';
import { CommandRegistry } from '../../src/ui/console/commands';
import { findLabStations, labListLines, registerLabCommands, type LabEnv } from '../../src/ui/console/lab';
import labText from '../../data/rooms/test/lab.txt?raw';
import arenaText from '../../data/rooms/test/arena.txt?raw';

function fake(roomText = labText) {
  const state: GameState = createGame({ seed: 1, roomText });
  let edited = 0;
  const env: LabEnv = { session: { state, markEdited: () => void edited++ } };
  const reg = new CommandRegistry<LabEnv>();
  registerLabCommands(reg);
  return { state, env, reg, edits: () => edited };
}

describe('findLabStations', () => {
  const state = fake().state;
  it('finds by rule number, listing every station of that rule', () => {
    expect(findLabStations('7', state)).toEqual([labStations.findIndex((s) => s.rule === 7)]);
    expect(findLabStations('3', state)).toHaveLength(3);
    expect(findLabStations('99', state)).toEqual([]);
  });
  it('finds by #index, name, all and nearest', () => {
    expect(findLabStations('#4', state)).toEqual([4]);
    expect(findLabStations('#999', state)).toEqual([]);
    expect(findLabStations('wildfire', state)).toEqual([
      labStations.findIndex((s) => s.label.includes('Wildfire')),
    ]);
    expect(findLabStations('all', state)).toHaveLength(labStations.length);
    expect(findLabStations('nearest', state)).toHaveLength(1);
  });
});

describe('lab command', () => {
  it('runs a station, marks the session edited and names it', () => {
    const f = fake();
    const r = f.reg.execute('lab 11', f.env);
    expect(r.ok).toBe(true);
    expect(r.lines[0]).toContain('11 ·');
    expect(f.edits()).toBe(1);
    expect(f.state.lab.runs).toBe(1);
    expect(f.state.enemies.length).toBeGreaterThan(0);
  });

  it('runs all stations', () => {
    const f = fake();
    expect(f.reg.execute('lab all', f.env).ok).toBe(true);
    expect(f.state.lab.runs).toBe(labStations.length);
    expect(f.edits()).toBe(1);
  });

  it('lists the stations', () => {
    const f = fake();
    const r = f.reg.execute('lab list', f.env);
    expect(r.lines).toEqual(labListLines());
    expect(r.lines).toHaveLength(labStations.length);
    expect(f.edits()).toBe(0);
  });

  it('rejects bad input without touching the state', () => {
    const f = fake();
    for (const bad of ['lab', 'lab 99', 'lab #99', 'lab nonsense']) {
      expect(f.reg.execute(bad, f.env).ok, bad).toBe(false);
    }
    expect(f.edits()).toBe(0);
    expect(f.state.lab.runs).toBe(0);
  });

  it('refuses outside the lab room', () => {
    const f = fake(arenaText);
    const r = f.reg.execute('lab 1', f.env);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toMatch(/lab scene/);
    expect(f.edits()).toBe(0);
  });
});
