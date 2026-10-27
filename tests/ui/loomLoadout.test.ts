import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Session } from '../../src/app/session';
import { getLoadout } from '../../src/app/loadout';
import { CommandRegistry } from '../../src/ui/console/commands';
import { registerM2Commands, resolveSpindle, type M2Env } from '../../src/ui/console/m2';
import {
  applySpindle,
  applyWeave,
  differsFromSaved,
  restoreLoadout,
  setLoadoutStorage,
} from '../../src/ui/loom/loadoutStore';
import {
  LOADOUT_KEY,
  loadSaved,
  parseSaved,
  saveLoadout,
  type KeyValueStore,
} from '../../src/ui/loom/persist';
import { referenceWeaves } from '../../src/sim/weave/referenceWeaves';

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}
const blocked: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceeded');
  },
};
const session = () => new Session({ seed: 1, roomId: 'test/arena', sceneId: 'arena', mode: 'arena' });

let store = memStore();
beforeEach(() => {
  store = memStore();
  setLoadoutStorage(store);
});
afterEach(() => setLoadoutStorage(null));

describe('persistence', () => {
  it('validates saved data', () => {
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved('{')).toBeNull();
    expect(parseSaved('{"spindleId":"test_spindle","slots":[]}')).toBeNull();
    expect(parseSaved('{"spindleId":"ashwood","slots":["Cast > Bolt[Fire]", 3]}')).toEqual({
      spindleId: 'ashwood',
      slots: ['Cast > Bolt[Fire]', ...Array<null>(8).fill(null)],
    });
  });

  it('survives blocked storage', () => {
    expect(loadSaved(blocked)).toBeNull();
    expect(saveLoadout(blocked, { spindleId: 'twig', slots: [] })).toBe(false);
    expect(loadSaved(null)).toBeNull();
    setLoadoutStorage(blocked);
    const s = session();
    expect(applyWeave(s, 2, 'Cast > Lob[Fire]').applied).toBe(true);
    expect(restoreLoadout(s)).toEqual({ restored: false, failed: [] });
  });

  it('saves applied weaves and the spindle, and restores them into a new session', () => {
    const a = session();
    applySpindle(a, 'heartwood');
    applyWeave(a, 1, referenceWeaves[12]!.notation);
    applyWeave(a, 0, null);
    expect(applyWeave(a, 2, 'Cast > Nova[Fire, Pierce]').applied).toBe(false);
    const saved = JSON.parse(store.data.get(LOADOUT_KEY)!);
    expect(saved.spindleId).toBe('heartwood');
    // Every slot by index: bar 1, R (always empty in the sandbox), bar 2.
    expect(saved.slots).toEqual([null, referenceWeaves[12]!.notation, ...Array<null>(7).fill(null)]);

    const b = session();
    expect(differsFromSaved(b)).toBe(true);
    expect(restoreLoadout(b)).toEqual({ restored: true, failed: [] });
    const l = getLoadout(b);
    expect(l.spindleId).toBe('heartwood');
    expect(l.slots.map((x) => x.notation)).toEqual(saved.slots.filter((_: unknown, i: number) => i !== 4));
    expect(differsFromSaved(b)).toBe(false);
  });

  it('keeps the current weave when a saved one no longer applies', () => {
    store.data.set(LOADOUT_KEY, JSON.stringify({ spindleId: 'twig', slots: ['Cast > Bolt[Fireball]'] }));
    const s = session();
    const before = getLoadout(s).slots[0]!.notation;
    expect(restoreLoadout(s).failed).toEqual(['LMB']);
    expect(getLoadout(s).slots[0]!.notation).toBe(before);
  });
});

describe('console: weave, weaves, spindle', () => {
  const setup = () => {
    const reg = new CommandRegistry<M2Env>();
    registerM2Commands(reg);
    const env: M2Env = { session: session() };
    return { reg, env, run: (line: string) => reg.execute(line, env) };
  };

  it('weave puts a weave in a slot by number or label', () => {
    const { run, env } = setup();
    const r = run('weave q Cast > lob[fire] > onexpire > nova[fire, wide]');
    expect(r.ok).toBe(true);
    expect(r.lines[0]).toBe(`Q: ${referenceWeaves[2]!.notation}  [cx 8/8, 14.3 mana]`);
    expect(run('weave 4 OnDodge > Nova[Frost, Saturate]').ok).toBe(true);
    expect(getLoadout(env.session).slots.map((s) => s.notation)[3]).toBe('OnDodge > Nova[Frost, Saturate]');
    expect(run('weave 2').lines[0]).toBe('RMB: Cast > Strike[]  [cx 1/8, 4 mana]');
    expect(run('weave rmb clear').lines[0]).toBe('RMB emptied.');
    expect(getLoadout(env.session).slots[1]!.notation).toBeNull();
  });

  it('prints compile and parse errors and leaves the slot alone', () => {
    const { run, env } = setup();
    const c = run('weave 1 Cast > Nova[Fire, Pierce]');
    expect(c.ok).toBe(false);
    expect(c.lines[0]).toBe("LMB unchanged: Nova can't take Pierce.");
    const p = run('weave 1 Cast > Bolt[Fire, Fireball]');
    expect(p.ok).toBe(false);
    expect(p.lines[0]).toContain("Unknown rune 'Fireball' at 18");
    expect(p.lines[0]).toContain('\n                    ^^^^^^^^');
    expect(getLoadout(env.session).slots[0]!.notation).toBe('Cast > Bolt[Fire]');
    expect(run('weave 10 Cast > Bolt[Fire]').ok).toBe(false);
    expect(run('weave').lines[0]).toMatch(/^Usage: weave/);
  });

  it('weaves lists slots; spindle switches and reports weaves that stop fitting', () => {
    const { run } = setup();
    run('spindle heart');
    run(`weave 3 ${referenceWeaves[12]!.notation}`);
    const list = run('weaves').lines;
    expect(list[0]).toBe('Spindle: Heartwood Spindle (Capacity 13)');
    expect(list[3]).toMatch(/^3 Q +Cast > Bolt\[Storm\] {/);
    const sw = run('spindle twig');
    expect(sw.lines).toEqual([
      'Spindle: Twig Spindle (Capacity 8).',
      "  Q doesn't fire until fixed: Needs 11 Capacity; this spindle has 8",
    ]);
    expect(run('spindle').lines.some((l) => l.startsWith('* twig'))).toBe(true);
    expect(run('spindle loomsteel').ok).toBe(true); // M5: Loomsteel joins the sandbox
    expect(run('spindle test_spindle').ok).toBe(false);
  });

  it('resolves spindle names', () => {
    expect(resolveSpindle('Ashwood Spindle')).toBe('ashwood');
    expect(resolveSpindle('RIME')).toBe('rimeglass');
    expect(() => resolveSpindle('test_spindle')).toThrow(/Unknown spindle/);
  });
});
