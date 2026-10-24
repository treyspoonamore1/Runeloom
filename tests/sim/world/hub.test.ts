/**
 * The Hearth's hub (M7, DESIGN §11): the room file, its stations, Interact (F) at a station,
 * fast travel to and from the hub, rifts opened there, and that it is a safe room.
 */
import { describe, expect, it } from 'vitest';
import { hearthRoom, hearthStone, STATION_IDS, type StationId } from '../../../data/hearth';
import { materialByCode } from '../../../data/materials';
import { startRoom } from '../../../data/progression';
import {
  Button,
  createAdventure,
  killPlayer,
  OBJECT_CHAR,
  parseRoom,
  step,
  type GameState,
  type InputFrame,
  type SimEvent,
} from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { makeSigil } from '../../../src/sim/items/sigils';
import { travelToLoomStone } from '../../../src/sim/world/adventure';
import { isStationKind, stationHere } from '../../../src/sim/world/hub';
import { travelDestinations } from '../../../src/sim/world/regionMap';
import { loomStoneId } from '../../../src/sim/world/worldState';
import { ROOMS, inlineRoom, run, runUntil, T, teleport } from './worldHelpers';

const F: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: Button.Interact };
const IDLE: InputFrame = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
const SOUTH: InputFrame = { ...IDLE, moveY: 1 };
const HUB_STONE = loomStoneId(hearthStone.roomId, hearthStone.key);

const uses = (evs: readonly SimEvent[]) =>
  evs.filter((e): e is Extract<SimEvent, { type: 'stationUse' }> => e.type === 'stationUse');

/** An adventure in the hub, standing on its Loom Stone (activated by the touch). */
function hub(): GameState {
  const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: hearthRoom });
  run(s, 1);
  return s;
}

/** Stands the player just south of the station's southernmost, then westernmost tile (always floor). */
function standAt(s: GameState, id: StationId): void {
  const tiles = s.objects.filter((o) => o.kind === id);
  const ty = Math.max(...tiles.map((o) => o.ty));
  const tx = Math.min(...tiles.filter((o) => o.ty === ty).map((o) => o.tx));
  teleport(s, T(tx), T(ty + 1) - 0.5);
}

describe('the hub room', () => {
  const data = parseRoom(ROOMS[hearthRoom]!);

  it('parses, and its Loom Stone is data/hearth.ts hearthStone', () => {
    expect(data.header.id).toBe(hearthRoom);
    const stones: string[] = [];
    data.rows.forEach((row, ty) => [...row].forEach((ch, tx) => ch === 'x' && stones.push(`loom_stone@${tx},${ty}`)));
    expect(stones).toEqual([hearthStone.key]);
    const s = hub();
    expect(s.objects.find((o) => o.kind === 'loom_stone')!.key).toBe(hearthStone.key);
  });

  it('has every station, no enemies and no exits', () => {
    const s = hub();
    for (const id of STATION_IDS) expect(s.objects.some((o) => o.kind === id), id).toBe(true);
    expect(data.header.spawns).toEqual([]);
    expect(data.header.exits).toEqual([]);
    run(s, 120);
    expect(s.enemies).toHaveLength(0);
  });

  it('stations are solid and inert; nothing in the hub can burn, so the Hearth fire ignites nothing', () => {
    const s = hub();
    const g = s.grid;
    for (let i = 0; i < g.ground.length; i++) expect(materialByCode[g.ground[i]!]!.flammable).toBeNull();
    run(s, 600);
    expect(g.fire.some((f) => f > 0)).toBe(false);
  });
});

describe('stationHere and Interact', () => {
  it('finds each station from beside it, and none in the open', () => {
    const s = hub();
    for (const id of STATION_IDS) {
      standAt(s, id);
      expect(stationHere(s), id).toBe(id);
    }
    teleport(s, T(9), T(14));
    expect(stationHere(s)).toBeNull();
  });

  it('a press at a station sends one stationUse, not again while held, again on a new press', () => {
    const s = hub();
    standAt(s, 'spindlewright');
    step(s, F);
    expect(uses(s.events)).toEqual([{ type: 'stationUse', station: 'spindlewright' }]);
    const held = runUntil(s, () => false, 30, F);
    expect(uses(held)).toEqual([]);
    step(s, IDLE);
    step(s, F);
    expect(uses(s.events)).toHaveLength(1);
  });

  it('nothing happens on Interact away from stations, or when dead', () => {
    const s = hub();
    teleport(s, T(9), T(14));
    step(s, F);
    expect(uses(s.events)).toEqual([]);
    step(s, IDLE);
    standAt(s, 'cartographer');
    killPlayer(s);
    expect(stationHere(s)).toBeNull();
    step(s, F);
    expect(uses(s.events)).toEqual([]);
  });

  it('station characters outside the hub do nothing', () => {
    const s = inlineRoom(`@id test/not_hub
#######
#.....#
#.s.x.#
#.....#
#######
`);
    expect(s.objects.some((o) => isStationKind(o.kind))).toBe(true);
    teleport(s, T(2), T(1));
    expect(stationHere(s)).toBeNull();
    step(s, F);
    expect(uses(s.events)).toEqual([]);
  });
});

describe('getting to the hub', () => {
  /** E1 at its activated Loom Stone, with the Hearth's stone activated (as lightHearth does). */
  function region(): GameState {
    const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: startRoom });
    run(s, 1);
    s.world.loomStones.push(HUB_STONE);
    return s;
  }

  it('fast travel reaches the hub from a region Loom Stone and goes back', () => {
    const s = region();
    const e1 = s.world.loomStones[0]!.split('#')[1]!;
    expect(travelToLoomStone(s, hearthRoom, hearthStone.key)).toBeNull();
    expect(s.room.id).toBe(hearthRoom);
    const [tx, ty] = hearthStone.key.split('@')[1]!.split(',').map(Number) as [number, number];
    expect([s.player.x, s.player.y]).toEqual([T(tx), T(ty)]);
    expect(s.enemies).toHaveLength(0);
    expect(travelToLoomStone(s, startRoom, e1)).toBeNull();
    expect(s.room.id).toBe(startRoom);
  });

  it('is refused before the Hearth stone is activated', () => {
    const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: startRoom });
    run(s, 1);
    expect(travelToLoomStone(s, hearthRoom, hearthStone.key)).toMatch(/not an activated/);
  });

  it('the travel list names the Hearth, first', () => {
    const s = region();
    const d = travelDestinations(s);
    expect(d[0]).toEqual({ roomId: hearthRoom, key: hearthStone.key, name: 'The Hearth', hub: true });
    expect(d[1]).toMatchObject({ roomId: startRoom, hub: false, name: 'Loomstone Glade' });
  });

  it('a rift opened at the hub Loom Stone returns there', () => {
    const s = hub();
    const g = makeSigil(s.hero, 1, []);
    s.hero.sigils.push(g);
    expect(applyHeroEdit(s, { kind: 'openRift', uid: g.uid })).toBeNull();
    expect(s.world.rift!.spec.home).toEqual({ roomId: hearthRoom, key: hearthStone.key });
    teleport(s, s.room.width / 2, s.room.height - 6);
    runUntil(s, (st) => st.room.id === hearthRoom, 300, SOUTH);
    expect(s.room.id).toBe(hearthRoom);
    expect(s.world.rift).toBeNull();
  });
});

it('every station kind has a legend character', () => {
  for (const id of STATION_IDS) expect(OBJECT_CHAR[id]).toMatch(/^.$/);
});
