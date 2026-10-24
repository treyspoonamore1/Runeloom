/** Helpers for the M7 Hearth tests: a lit Hearth in a stand-in hub room (id hearth/hearth). */
import { hearthRoom, type BuildingId } from '../../../data/hearth';
import type { RuneId } from '../../../data/runes';
import { createGame, newGameHero, setupNewGameWeaves, type GameState, type RuneItem } from '../../../src/sim';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import { lightHearth } from '../../../src/sim/meta/hearth';
import type { HearthEdit } from '../../../src/sim/meta/edits';
import { place } from '../actors/helpers';
import { giveRune } from '../hero/helpers';

/** An open room standing in for the hub (the hub agent owns the real data/rooms/hearth/hearth.txt). */
export function roomText(id: string): string {
  return [
    `@id ${id}`,
    '#'.repeat(40),
    ...Array.from({ length: 28 }, () => `#${'.'.repeat(38)}#`),
    '#'.repeat(40),
    '',
  ].join('\n');
}

export const HUB_ROOM = roomText(hearthRoom);

/** A new-game adventure in the stand-in hub, AI frozen; the Hearth lit unless `lit` is false. */
export function hub(opts: { seed?: number; lit?: boolean; roomId?: string } = {}): GameState {
  const state = createGame({
    seed: opts.seed ?? 1,
    roomText: roomText(opts.roomId ?? hearthRoom),
    mode: 'adventure',
    hero: newGameHero(),
  });
  setupNewGameWeaves(state);
  place(state, 80, 60);
  state.cheats.noAI = true;
  if (opts.lit !== false) lightHearth(state);
  return state;
}

/** Sets building levels directly. */
export function build(state: GameState, levels: Partial<Record<BuildingId, number>>): void {
  Object.assign(state.hero.hearth.buildings, levels);
}

/** Applies a Hearth edit and expects it to succeed. */
export function ok(state: GameState, edit: HearthEdit): void {
  const err = applyHeroEdit(state, edit);
  if (err !== null) throw new Error(`${edit.kind}: ${err}`);
}

/** Plants new pouch runes of `ids` at `level` in the garden (no checks) and returns them. */
export function plant(state: GameState, ids: RuneId[], level = 1, quality = 0): RuneItem[] {
  return ids.map((id) => {
    const r = giveRune(state, id, level);
    r.quality = quality;
    state.hero.hearth.garden.push(r.uid);
    return r;
  });
}
