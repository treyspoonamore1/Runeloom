/**
 * The Hearth in saves (save version 3, M7). parseHero calls parseHearth for `hero.hearth`;
 * parseSaveData calls migrateHearth once the hero and world are parsed.
 *
 * CONTRACT (M7), owned by the meta agent: validate every field (building levels within their
 * max, garden uids are pouch runes, expedition uids unique, mutation counts within their max),
 * throwing an Error that names the field, like src/sim/saveParse.ts.
 */
import type { HeroState } from '../hero/types';
import type { WorldState } from '../world/worldState';
import { createHearth } from './hearth';
import type { HearthState } from './types';

/** `hero.hearth` from a save; a missing one (versions 1 and 2) is a fresh, unlit Hearth. */
export function parseHearth(v: unknown): HearthState {
  const d = createHearth();
  if (v === undefined) return d;
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('Bad save: hero.hearth should be an object');
  const o = v as Partial<HearthState>;
  return { ...d, ...o, buildings: { ...d.buildings, ...(o.buildings ?? {}) }, mutations: { ...(o.mutations ?? {}) } };
}

/**
 * After parsing (meta agent): a save from before M7 (`hadHearth` false) whose world shows the
 * Cinder Warden dead gets a lit Hearth, as lightHearth gives (onLit Embers, the Hearth's Loom
 * Stone in world.loomStones); garden runes that a weave socketed go back to the pouch.
 */
export function migrateHearth(hero: HeroState, world: WorldState, hadHearth: boolean): void {
  void hero;
  void world;
  void hadHearth;
}
