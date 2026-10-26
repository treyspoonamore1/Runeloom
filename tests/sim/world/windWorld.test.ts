/** Wind in the world (M8): wind vanes and `vanes:all`, and the rift suffix "of the Gale". */
import { describe, expect, it } from 'vitest';
import { enterRoom, type GameState } from '../../../src/sim';
import { Rng } from '../../../src/sim/core/rng';
import { writeGust } from '../../../src/sim/grid/wind';
import { rollSigilMods } from '../../../src/sim/items/sigils';
import { rulesOf } from '../../../src/sim/world/rift/rules';
import { inlineRoom, obj, run, T } from './worldHelpers';
import type { RiftModId } from '../../../data/rift';
import { stepGrid } from '../../../src/sim/grid/tick';
import { setAir } from '../../../src/sim/grid/cells';
import { AIR } from '../../../data/materials';

const VANES = `@id t/vanes
@level 1
@link D vanes:all
@note Y The vane turns.
##########
#x.......#
#..Y...Y.#
#........#
####D#####
#........#
##########
`;

const gustAt = (s: GameState, x: number, seconds: number) =>
  writeGust(s, { x, y: T(2) - 6, dirX: 0, dirY: 1, radius: 9, angleDeg: 60, seconds, team: 'player' });

describe('wind vanes (CONTENT §6.1 Y)', () => {
  it('a vane spins after wind covers a cell touching it for 0.5 s, then stays spun; vanes:all opens the door', () => {
    const s = inlineRoom(VANES);
    gustAt(s, T(3), 2);
    run(s, 29);
    expect(obj(s, 'wind_vane', 0).on).toBe(false);
    run(s, 1);
    expect(obj(s, 'wind_vane', 0).on).toBe(true);
    expect(s.events.map((e) => e.type)).toEqual(expect.arrayContaining(['vaneSpun', 'note']));
    run(s, 200);
    expect(obj(s, 'wind_vane', 0).on).toBe(true); // latched after the gust
    expect(obj(s, 'door').on).toBe(false);
    gustAt(s, T(7), 2);
    run(s, 31);
    expect(obj(s, 'door').on).toBe(true);
  });

  it('a gust shorter than 0.5 s does not spin it', () => {
    const s = inlineRoom(VANES);
    gustAt(s, T(3), 0.3);
    run(s, 120);
    expect(obj(s, 'wind_vane', 0).on).toBe(false);
  });

  it('room wind spins every vane', () => {
    const s = inlineRoom(VANES.replace('@level 1', '@level 1\n@wind s'));
    run(s, 32);
    expect(obj(s, 'wind_vane', 0).on).toBe(true);
    expect(obj(s, 'wind_vane', 1).on).toBe(true);
    expect(obj(s, 'door').on).toBe(true);
  });

  it('the vanes of an opened door start spun when the room is entered again', () => {
    const s = inlineRoom(VANES.replace('@level 1', '@level 1\n@wind s'));
    run(s, 32);
    enterRoom(s, 't/vanes', { kind: 'default' });
    expect(obj(s, 'wind_vane', 0).on).toBe(true);
  });
});

describe('rift suffix "of the Gale" (CONTENT §10)', () => {
  function roomText(): string {
    const rows = ['################'];
    for (let y = 1; y < 9; y++) rows.push(`#${'"'.repeat(14)}#`);
    rows.push('################');
    return `@id rift/9/test\n@name Test\n@level 10\n${rows.join('\n')}\n`;
  }
  function inRift(mods: RiftModId[]): GameState {
    const s = inlineRoom(roomText());
    s.world.rift = {
      spec: { index: 9, seed: 1, tier: 9, mods, home: { roomId: 'rift/9/test', key: 'x' } },
      bossDead: false,
    };
    enterRoom(s, 'rift/9/test', { kind: 'default' });
    return s;
  }

  it('gives every rift room wind blowing east (smoke drifts east)', () => {
    expect(rulesOf(['gale']).wind).toBe(1);
    expect(rulesOf([]).wind).toBe(0);
    const s = inRift(['gale']);
    expect(s.grid.wind).toBe(1);
    expect(inRift([]).grid.wind).toBe(0);
    const g = s.grid;
    setAir(g, 5 * g.width + 20, AIR.smoke, 100);
    while (g.tick % 8 !== 7) stepGrid(s);
    stepGrid(s);
    expect(g.air[5 * g.width + 21]).toBe(AIR.smoke);
  });

  it('rolls only from tier 9', () => {
    const rng = new Rng(7);
    let low = 0;
    let high = 0;
    for (let k = 0; k < 4000; k++) {
      if (rollSigilMods(rng, 1 + (k % 8)).includes('gale')) low++;
      if (rollSigilMods(rng, 9 + (k % 8)).includes('gale')) high++;
    }
    expect(low).toBe(0);
    expect(high).toBeGreaterThan(0);
  });
});
