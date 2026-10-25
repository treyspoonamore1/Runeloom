import { describe, expect, it } from 'vitest';
import {
  applyHeroEdit,
  createGame,
  hashProgress,
  hashState,
  loadSave,
  makeSave,
  parseSave,
  type GameState,
  type Item,
} from '../../../src/sim';
import { makeItem } from '../../../src/sim/items/items';
import { adventure, OPEN_ROOM } from './helpers';

function give(state: GameState, base = 'travelers_cloak'): Item {
  const it = makeItem(state.hero, base, 'magic', 5, [{ id: 'life_flat', tier: 6, value: 10 }]);
  state.hero.items.push(it);
  return it;
}

describe('lock ("keep") edit', () => {
  it('locks and unlocks an item, and a locked item refuses salvage', () => {
    const state = adventure();
    const it = give(state);
    expect(applyHeroEdit(state, { kind: 'lock', uid: it.uid, locked: true })).toBeNull();
    expect(it.locked).toBe(true);
    const scrap = state.hero.threadScrap;
    expect(applyHeroEdit(state, { kind: 'salvage', uid: it.uid })).toBe('Unlock it first');
    expect(state.hero.items).toContain(it);
    expect(state.hero.threadScrap).toBe(scrap);
    expect(applyHeroEdit(state, { kind: 'lock', uid: it.uid, locked: false })).toBeNull();
    // Unlocking removes the field instead of leaving `false`, so hashes and saves stay canonical.
    expect('locked' in it).toBe(false);
    expect(applyHeroEdit(state, { kind: 'salvage', uid: it.uid })).toBeNull();
    expect(state.hero.threadScrap).toBeGreaterThan(scrap);
  });

  it('refuses unknown items and parts, and non-boolean values', () => {
    const state = adventure();
    expect(applyHeroEdit(state, { kind: 'lock', uid: 9999, locked: true })).toMatch(/don't have/);
    expect(applyHeroEdit(state, { kind: 'lock', uid: 1, locked: 'yes' as unknown as boolean })).toMatch(
      /Lock or unlock/,
    );
  });

  it('locks equipped items too (they stay equipped)', () => {
    const state = adventure();
    const sp = state.hero.equipped.spindle!;
    expect(applyHeroEdit(state, { kind: 'lock', uid: sp, locked: true })).toBeNull();
    expect(state.hero.items.find((i) => i.uid === sp)!.locked).toBe(true);
    expect(state.hero.equipped.spindle).toBe(sp);
  });

  it('needs adventure mode like the other equipment edits', () => {
    const state = createGame({ seed: 1, roomText: OPEN_ROOM });
    expect(applyHeroEdit(state, { kind: 'lock', uid: 1, locked: true })).toMatch(/adventure/);
  });

  it('is hashed: locking changes the hash, unlocking restores it', () => {
    const state = adventure();
    const it = give(state);
    const before = hashState(state);
    const progress = hashProgress(state);
    applyHeroEdit(state, { kind: 'lock', uid: it.uid, locked: true });
    expect(hashState(state)).not.toBe(before);
    expect(hashProgress(state)).not.toBe(progress);
    applyHeroEdit(state, { kind: 'lock', uid: it.uid, locked: false });
    expect(hashState(state)).toBe(before);
    expect(hashProgress(state)).toBe(progress);
  });

  it('is saved: save → JSON → parse → load keeps the lock and the hash', () => {
    const state = adventure();
    const kept = give(state);
    const other = give(state, 'wool_hood');
    applyHeroEdit(state, { kind: 'lock', uid: kept.uid, locked: true });
    const json = JSON.stringify(makeSave(state));
    const save = parseSave(json);
    expect(save).toEqual(JSON.parse(json));
    const loaded = loadSave(save, (init) =>
      createGame({ seed: init.seed, mode: 'adventure', roomText: OPEN_ROOM, hero: init.hero, world: init.world }),
    );
    expect(loaded.hero.items.find((i) => i.uid === kept.uid)!.locked).toBe(true);
    expect('locked' in loaded.hero.items.find((i) => i.uid === other.uid)!).toBe(false);
    expect(hashProgress(loaded)).toBe(hashProgress(state));
    expect(applyHeroEdit(loaded, { kind: 'salvage', uid: kept.uid })).toBe('Unlock it first');
  });
});

describe('saveParse validates `locked`', () => {
  function saveWith(locked: unknown): unknown {
    const state = adventure();
    const it = give(state);
    const save = JSON.parse(JSON.stringify(makeSave(state))) as { hero: { items: Record<string, unknown>[] } };
    const found = save.hero.items.find((i) => i.uid === it.uid)!;
    if (locked !== undefined) found.locked = locked;
    return save;
  }

  it('accepts true, and reads false or a missing field as not locked', () => {
    const t = parseSave(saveWith(true));
    expect(t.hero.items.some((i) => i.locked === true)).toBe(true);
    for (const v of [false, undefined]) {
      const s = parseSave(saveWith(v));
      expect(s.hero.items.some((i) => 'locked' in i)).toBe(false);
    }
  });

  it('rejects other types with a path', () => {
    expect(() => parseSave(saveWith('yes'))).toThrow(/locked.*true or false/);
    expect(() => parseSave(saveWith(1))).toThrow(/locked/);
  });
});
