import { beforeEach, describe, expect, it, vi } from 'vitest';

// The sim helpers are the meta agent's (stubs until merged): record what the commands ask of them.
const calls: Array<[string, ...unknown[]]> = [];
vi.mock('../../src/sim/meta/debug', () => ({
  debugSetEmbers: (_s: unknown, n: number) => calls.push(['embers', n]),
  debugSetAsh: (_s: unknown, n: number) => calls.push(['ash', n]),
  debugSetBuilding: (_s: unknown, b: string, l: number) => calls.push(['building', b, l]),
  debugSetRiftTier: (_s: unknown, n: number) => calls.push(['rifttier', n]),
  debugOffline: (_s: unknown, sec: number) => calls.push(['offline', sec]),
}));
vi.mock('../../src/sim/world/transition', () => ({
  enterRoom: (_s: unknown, room: string, arrival: unknown) => calls.push(['enterRoom', room, arrival]),
}));

import { hearthRoom, hearthStone } from '../../data/hearth';
import { CommandRegistry } from '../../src/ui/console/commands';
import {
  buildingArg,
  goToHearth,
  hoursArg,
  MAX_ASH,
  MAX_EMBERS,
  registerHearthCommands,
  wholeArg,
  type HearthEnv,
} from '../../src/ui/console/hearth';

function fake(opts: { mode?: string; lit?: boolean; rooms?: string[] } = {}) {
  let edited = 0;
  let synced = 0;
  const state = {
    mode: opts.mode ?? 'adventure',
    hero: { hearth: { lit: opts.lit ?? true, embers: 12 } },
    rooms: Object.fromEntries((opts.rooms ?? [hearthRoom]).map((r) => [r, 'room text'])),
    world: { respawn: null as unknown },
  };
  const env = {
    session: { state, markEdited: () => void edited++, syncRoom: () => void synced++ },
  } as unknown as HearthEnv;
  const reg = new CommandRegistry<HearthEnv>();
  registerHearthCommands(reg);
  return { state, env, reg, edits: () => edited, synced: () => synced };
}

beforeEach(() => void (calls.length = 0));

describe('argument parsing', () => {
  it('takes whole numbers in range only', () => {
    expect(wholeArg('5', 0, 10, 'u')).toBe(5);
    expect(wholeArg('0', 0, 10, 'u')).toBe(0);
    for (const bad of [undefined, '', 'x', '2.5', '-1', '11', 'NaN', 'Infinity'])
      expect(() => wholeArg(bad, 0, 10, 'u')).toThrow(/Usage: u/);
  });

  it('resolves buildings by id or unique prefix', () => {
    expect(buildingArg('kindling_pit', 'u')).toBe('kindling_pit');
    expect(buildingArg('kin', 'u')).toBe('kindling_pit');
    expect(buildingArg('SALVAGE', 'u')).toBe('salvage_loom');
    expect(buildingArg('expedition', 'u')).toBe('expedition_board');
    expect(() => buildingArg('moat', 'u')).toThrow(/Unknown building "moat"/);
    expect(() => buildingArg(undefined, 'u')).toThrow(/Usage/);
    expect(() => buildingArg('', 'u')).toThrow(/Usage/);
  });

  it('turns hours into whole seconds', () => {
    expect(hoursArg('1', 'u')).toBe(3600);
    expect(hoursArg('2.5', 'u')).toBe(9000);
    expect(hoursArg('0.0001', 'u')).toBe(1);
    for (const bad of [undefined, '0', '-2', 'abc', '100000', 'Infinity'])
      expect(() => hoursArg(bad, 'u')).toThrow(/Usage/);
  });
});

describe('Hearth console commands', () => {
  it('embers and ash set the amounts and mark the session edited', () => {
    const f = fake();
    expect(f.reg.execute('embers 5000', f.env)).toMatchObject({ ok: true });
    expect(f.reg.execute('ash 12', f.env)).toMatchObject({ ok: true });
    expect(calls).toEqual([
      ['embers', 5000],
      ['ash', 12],
    ]);
    expect(f.edits()).toBe(2);
  });

  it('rejects bad amounts without touching anything', () => {
    const f = fake();
    for (const line of [
      'embers',
      'embers -1',
      'embers 1.5',
      'embers lots',
      `embers ${MAX_EMBERS + 1}`,
      'ash',
      `ash ${MAX_ASH + 1}`,
    ]) {
      const r = f.reg.execute(line, f.env);
      expect(r.ok, line).toBe(false);
      expect(r.lines[0]).toMatch(/Usage/);
    }
    expect(calls).toEqual([]);
    expect(f.edits()).toBe(0);
  });

  it("building sets a level within the building's maximum", () => {
    const f = fake();
    expect(f.reg.execute('building kindling_pit 10', f.env).ok).toBe(true);
    expect(f.reg.execute('building salv 0', f.env).ok).toBe(true);
    expect(calls).toEqual([
      ['building', 'kindling_pit', 10],
      ['building', 'salvage_loom', 0],
    ]);
    // Salvage Loom tops out at level 10.
    expect(f.reg.execute('building salvage_loom 11', f.env)).toMatchObject({ ok: false });
    expect(f.reg.execute('building kindling_pit', f.env)).toMatchObject({ ok: false });
    expect(f.reg.execute('building moat 3', f.env)).toMatchObject({ ok: false });
    expect(calls).toHaveLength(2);
    expect(f.edits()).toBe(2);
  });

  it('rifttier takes 0 to the last tier', () => {
    const f = fake();
    expect(f.reg.execute('rifttier 8', f.env).ok).toBe(true);
    expect(f.reg.execute('rifttier 17', f.env).ok).toBe(false);
    expect(f.reg.execute('rifttier', f.env).ok).toBe(false);
    expect(calls).toEqual([['rifttier', 8]]);
  });

  it('offline takes hours and needs a lit Hearth', () => {
    const f = fake();
    expect(f.reg.execute('offline 2.5', f.env).ok).toBe(true);
    expect(calls).toEqual([['offline', 9000]]);
    const dark = fake({ lit: false });
    const r = dark.reg.execute('offline 1', dark.env);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toMatch(/not lit/);
    expect(dark.reg.execute('offline', dark.env).ok).toBe(false);
  });

  it('works in adventure mode only', () => {
    const f = fake({ mode: 'sandbox' });
    for (const line of [
      'embers 5',
      'ash 1',
      'building kindling_pit 1',
      'rifttier 3',
      'offline 1',
      'hearth',
    ]) {
      const r = f.reg.execute(line, f.env);
      expect(r.ok, line).toBe(false);
      expect(r.lines[0]).toMatch(/adventure mode/);
    }
    expect(calls).toEqual([]);
    expect(f.edits()).toBe(0);
  });

  it('hearth lights it, moves the player to the Hearth stone and tells the renderer', () => {
    const f = fake();
    expect(f.reg.execute('hearth', f.env).ok).toBe(true);
    expect(calls).toEqual([
      ['embers', 12],
      ['enterRoom', hearthRoom, { kind: 'loomStone', key: hearthStone.key }],
    ]);
    expect(f.state.world.respawn).toEqual({ roomId: hearthRoom, key: hearthStone.key });
    expect(f.synced()).toBe(1);
    expect(f.edits()).toBe(1);
  });

  it('hearth says so when the hub room is not in the game', () => {
    const f = fake({ rooms: ['emberwood/e1'] });
    const r = f.reg.execute('hearth', f.env);
    expect(r.ok).toBe(false);
    expect(r.lines[0]).toMatch(/isn't built/);
    expect(() => goToHearth(f.env.session)).toThrow();
    expect(calls).toEqual([]);
    expect(f.edits()).toBe(0);
  });

  it('help lists them all', () => {
    const f = fake();
    expect(f.reg.names()).toEqual(['ash', 'building', 'embers', 'hearth', 'offline', 'rifttier']);
  });
});
