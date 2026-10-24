import { describe, expect, it } from 'vitest';
import { hearthRoom } from '../../data/hearth';
import { parseRoom, type RoomData } from '../../src/sim';
import { checkHub } from '../../tools/lib/hubChecks';
import { loadAllRooms } from '../../tools/lib/rooms';

const ROOMS = loadAllRooms();
const hubWith = (edit: (text: string) => string): Map<string, RoomData> =>
  new Map([[hearthRoom, parseRoom(edit(ROOMS[hearthRoom]!))]]);

describe('checkHub', () => {
  it('accepts the authored hub', () => {
    expect(checkHub(hubWith((t) => t))).toEqual([]);
  });

  it('flags a missing hub, a moved Loom Stone, a missing station, enemies and fuel', () => {
    expect(checkHub(new Map())[0]).toMatch(/missing/);
    expect(checkHub(hubWith((t) => t.replace('.x.', '..x')))[0]).toMatch(/hearthStone/);
    expect(checkHub(hubWith((t) => t.replace(',s,', ',,,')))).toEqual(
      expect.arrayContaining([expect.stringMatching(/no 's' \(spindlewright\)/)]),
    );
    const bad = checkHub(hubWith((t) => t.replace(/,,,,/, ',"1,').replace('@level 1', '@level 1\n@spawn 1 enemy:tinderling')));
    expect(bad).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/@spawn/),
        expect.stringMatching(/grass\) burns/),
        expect.stringMatching(/spawn marker/),
      ]),
    );
  });
});
