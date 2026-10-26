/**
 * BUILD_PLAN M8 acceptance "Determinism and saves": a Fen-style room with room wind, fog,
 * furnace vents and borrowed terrain active plays identically on every run, and a save made
 * there round-trips (room-scoped terrain is rebuilt from the file on load, DESIGN §12).
 */
import { describe, expect, it } from 'vitest';
import {
  applyElement,
  Button,
  createAdventure,
  hashProgress,
  hashState,
  loadSave,
  makeSave,
  parseSave,
  PLAYER_ID,
  step,
  writeGust,
  type ElementApplication,
  type GameState,
} from '../../src/sim';
import { AIR, OWNER } from '../../data/materials';

const ROOM = `@id test/m8det
@name Determinism Fen
@level 18
@wind e
@fog 10 0 15 7
@spawn 1 enemy:tinderling 3
@spawn 2 enemy:bog_lurker
################
#x..""""""....f#
#...""""""..._.#
#..,,,""~~~~~..#
#...1"""~~2~~..#
#..mm"""~~~~~.Y#
#..mm."""..:::.#
################
`;

function game(seed: number): GameState {
  return createAdventure({ seed, rooms: { 'test/m8det': ROOM }, startRoomId: 'test/m8det' });
}

const app = (
  element: ElementApplication['element'],
  x: number,
  y: number,
  r: number,
): ElementApplication => ({
  element,
  shape: { kind: 'circle', x, y, r },
  owner: OWNER.player,
  sourceId: PLAYER_ID,
  hitDamage: 12,
  durationMult: 1,
});

/** A scripted run: the player wanders and dodges while Tide, Gale, Fire, Frost and Storm land. */
function play(
  seed: number,
  ticks: number,
  every = 100,
): { hashes: number[]; state: GameState; sawM8: boolean } {
  const s = game(seed);
  s.cheats.god = true;
  const hashes: number[] = [];
  let sawM8 = false;
  for (let t = 0; t < ticks; t++) {
    if (t % 240 === 10) applyElement(s, app('fire', 24, 6, 3));
    if (t % 240 === 70) applyElement(s, app('tide', 30, 14, 6));
    if (t % 240 === 90) applyElement(s, app('frost', 30, 14, 4));
    if (t % 240 === 120)
      writeGust(s, {
        x: 14,
        y: 10,
        dirX: 1,
        dirY: 0.3,
        radius: 14,
        angleDeg: 60,
        seconds: 2,
        team: 'player',
      });
    if (t % 240 === 150) applyElement(s, app('tide', 58, 6, 3)); // the vent
    if (t % 240 === 180) applyElement(s, app('storm', 40, 14, 2));
    if (t % 240 === 200) applyElement(s, app('tide', 54, 10, 3)); // the pit
    const a = (t * 0.013) % (2 * Math.PI);
    step(s, {
      moveX: Math.cos(a),
      moveY: Math.sin(a * 1.7),
      aimX: s.player.x + 10,
      aimY: s.player.y,
      buttons: t % 97 === 0 ? Button.Dodge : 0,
    });
    const g = s.grid;
    if (!sawM8 && g.gusts.length > 0 && g.borrowed.some((b) => b === 1) && g.air.some((x) => x === AIR.fog))
      sawM8 = true;
    if (t % every === 0) hashes.push(hashState(s));
  }
  return { hashes, state: s, sawM8 };
}

describe('M8 determinism (wind, fog, borrowed terrain)', () => {
  it('two runs of the same seed hash the same on every 100th tick', () => {
    const a = play(5, 3000);
    const b = play(5, 3000);
    expect(a.sawM8).toBe(true);
    expect(a.hashes).toEqual(b.hashes);
    expect(play(6, 3000).hashes.at(-1)).not.toBe(a.hashes.at(-1));
  }, 60_000);

  it('a save made there round-trips; the room comes back from its file (fog, wind, no borrowed water)', () => {
    const { state } = play(3, 900);
    expect(state.grid.borrowed.some((b) => b === 1)).toBe(true);
    const json = JSON.stringify(makeSave(state));
    const save = parseSave(json);
    expect(save).toEqual(JSON.parse(json));
    const loaded = loadSave(save, (init) =>
      createAdventure({ seed: init.seed, rooms: { 'test/m8det': ROOM }, hero: init.hero, world: init.world }),
    );
    expect(hashProgress(loaded)).toBe(hashProgress(state));
    expect(loaded.room.id).toBe('test/m8det');
    expect(loaded.grid.wind).toBe(1);
    expect(loaded.grid.air.some((x) => x === AIR.fog)).toBe(true);
    expect(loaded.grid.borrowed.every((b) => b === 0)).toBe(true);
    // And it plays on deterministically from the load.
    const again = loadSave(parseSave(json), (init) =>
      createAdventure({ seed: init.seed, rooms: { 'test/m8det': ROOM }, hero: init.hero, world: init.world }),
    );
    for (let t = 0; t < 300; t++) {
      const input = { moveX: 1, moveY: 0, aimX: 0, aimY: 0, buttons: 0 };
      step(loaded, input);
      step(again, input);
    }
    expect(hashState(loaded)).toBe(hashState(again));
  });
});
