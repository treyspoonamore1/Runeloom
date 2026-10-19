import { describe, expect, it } from 'vitest';
import { buildRoom, isSolidCell, parseRoom, RoomParseError, TILE_CELLS } from '../../../src/sim';

const SMALL = `@id test/small
@name Small
@level 2
@exit e test/other
@spawn 1 enemy:tinderling 3
@link D braziers:all
#####
#x.1#
#..D>
#####
`;

describe('parseRoom', () => {
  it('reads headers and the grid', () => {
    const r = parseRoom(SMALL);
    expect(r.header).toMatchObject({ id: 'test/small', name: 'Small', level: 2 });
    expect(r.header.exits).toEqual([{ dir: 'e', room: 'test/other' }]);
    expect(r.header.spawns).toEqual([{ marker: '1', kind: 'enemy', id: 'tinderling', count: 3 }]);
    expect(r.header.links).toEqual([{ door: 'D', condition: 'braziers:all' }]);
    expect(r.tilesW).toBe(5);
    expect(r.tilesH).toBe(4);
  });

  it('rejects rows of unequal width with the line number', () => {
    const bad = '@id x\n###\n##\n';
    expect(() => parseRoom(bad)).toThrow(RoomParseError);
    expect(() => parseRoom(bad)).toThrow(/line 3/);
  });

  it('rejects unknown tile characters', () => {
    expect(() => parseRoom('@id x\n#Z#\n')).toThrow(/unknown tile character 'Z'/);
  });

  it('reads a trailing monster rarity on @spawn and rejects bad counts', () => {
    const text = (spawn: string) => `@id x\n@spawn ${spawn}\n###\n#1#\n###\n`;
    expect(parseRoom(text('1 pack:archer_line rare')).header.spawns).toEqual([
      { marker: '1', kind: 'pack', id: 'archer_line', count: 1, rarity: 'rare' },
    ]);
    expect(parseRoom(text('1 enemy:tinderling 2 magic')).header.spawns).toEqual([
      { marker: '1', kind: 'enemy', id: 'tinderling', count: 2, rarity: 'magic' },
    ]);
    expect(() => parseRoom(text('1 enemy:tinderling lots'))).toThrow(/positive integer/);
  });

  it('rejects unknown headers', () => {
    expect(() => parseRoom('@id x\n@colour red\n###\n')).toThrow(/unknown header @colour/);
  });
});

describe('buildRoom', () => {
  it('expands tiles to cells and marks walls solid', () => {
    const room = buildRoom(parseRoom(SMALL));
    expect(room.width).toBe(5 * TILE_CELLS);
    expect(room.height).toBe(4 * TILE_CELLS);
    expect(isSolidCell(room, 0, 0)).toBe(true);
    expect(isSolidCell(room, TILE_CELLS, TILE_CELLS)).toBe(false);
    // The door D at tile (3, 2) is solid.
    expect(isSolidCell(room, 3 * TILE_CELLS + 1, 2 * TILE_CELLS + 1)).toBe(true);
  });

  it('treats out-of-bounds cells as solid', () => {
    const room = buildRoom(parseRoom(SMALL));
    expect(isSolidCell(room, -1, 5)).toBe(true);
    expect(isSolidCell(room, room.width, 5)).toBe(true);
  });

  it('spawns the player on the first Loom Stone', () => {
    const room = buildRoom(parseRoom(SMALL));
    expect(room.spawnX).toBe(1.5 * TILE_CELLS);
    expect(room.spawnY).toBe(1.5 * TILE_CELLS);
  });
});
