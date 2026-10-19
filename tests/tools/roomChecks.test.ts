import { describe, expect, it } from 'vitest';
import { parseRoom, type RoomData } from '../../src/sim';
import { checkRooms } from '../../tools/lib/roomChecks';

function rooms(...texts: string[]): Map<string, RoomData> {
  return new Map(texts.map((t) => [parseRoom(t).header.id, parseRoom(t)]));
}

const opts = { isEnemy: (id: string) => id === 'tinderling', isPack: null };

const A = `@id r/a
@exit e r/b
####
#..>
####
`;
const B = `@id r/b
@exit w r/a
####
<..#
####
`;

describe('checkRooms', () => {
  it('accepts exits that lead to an opposite exit and back', () => {
    expect(checkRooms(rooms(A, B), opts)).toEqual({ errors: [], warnings: [] });
  });

  it('flags missing targets, missing opposite exits, undeclared and misplaced exit tiles', () => {
    const r = checkRooms(
      rooms(
        A.replace('r/b', 'r/nope'),
        `@id r/c
@exit n r/a
#v##
#..>
####
`,
      ),
      opts,
    );
    expect(r.errors).toEqual([
      'rooms/r/a.txt: @exit e r/nope: no such room',
      "rooms/r/c.txt: @exit n but no '^' tile on the n edge",
      "rooms/r/c.txt: @exit n r/a, which has no 'v' exit on its s edge",
      "rooms/r/c.txt: '>' tiles on the e edge but no @exit e",
      "rooms/r/c.txt: exit 'v' at tile 1,0 is not on its edge",
    ]);
  });

  it('checks links, notes, spawns, enemies, packs and keys', () => {
    const r = checkRooms(
      rooms(`@id kiln/x
@link D plates:all
@link K braziers:all
@link D lit:maybe
@note S hello
@note z nope
@spawn 1 enemy:tinderling
@spawn 2 enemy:dragon
@spawn 3 pack:mob
#####
#D1G#
#K24#
#####
`),
      { isEnemy: opts.isEnemy, isPack: (id: string) => id === 'crew' },
    );
    expect(r.errors).toEqual([
      "rooms/kiln/x.txt: @link D plates:all: no 'T' in the grid",
      "rooms/kiln/x.txt: @link K: only 'D' doors take a @link",
      "rooms/kiln/x.txt: @link K braziers:all: no 'B' in the grid",
      'rooms/kiln/x.txt: @link D lit:maybe: unknown condition',
      "rooms/kiln/x.txt: @note S: no 'S' in the grid",
      'rooms/kiln/x.txt: @note z: not an object character',
      'rooms/kiln/x.txt: @spawn 2 enemy:dragon is not in data/enemies.ts',
      "rooms/kiln/x.txt: @spawn 3: no '3' in the grid",
      'rooms/kiln/x.txt: @spawn 3 pack:mob is not in data/packs.ts',
      'rooms/kiln/x.txt: spawn marker 4 is in the grid but has no @spawn header',
      'dungeon kiln: a big-key door but no big-key chest',
    ]);
    expect(r.warnings).toEqual(['dungeon kiln: 1 locked door tile(s) but only 0 small-key chest(s)']);
  });
});
