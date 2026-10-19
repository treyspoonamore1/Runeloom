/** The spell runtime: weave slots, triggers, spell instances, branches and caps (BUILD_PLAN M2 task 4). */
export type {
  SpellInstance,
  SpellEndReason,
  CastRecord,
  PendingSpawn,
  SpawnAt,
  TriggerQueueEntry,
  SpellStats,
} from './types';
export {
  LOADOUT_SLOTS,
  SLOT_BUTTONS,
  RUNTIME_SHIPS,
  DEFAULT_LOADOUT,
  compileContextFor,
  previewFor,
  previewWeave,
  createWeaveLoadout,
  loadoutSpecOf,
  applyLoadoutSpec,
  setSlotWeave,
  setLoadoutSpindle,
  applyLoadoutEdit,
  listensFor,
  legacyLoadout,
  stateContext,
  recompileWeaves,
  type WeaveSlot,
  type WeaveLoadout,
  type LoadoutSpec,
  type LoadoutEdit,
  type WeavePreview,
  type SetWeaveOutcome,
  type Loadout,
} from './loadout';
export { cancelCast, slotSpellName } from './castState';
export { noteDodge, noteKill, noteCrit, noteHurt } from './queue';
export { stepWeaves, fireProgram, payMana } from './triggers';
export { stepSpells, compactSpells, holdSpells } from './step';
export { spawnSpell, openCast, endSpell, buildPacket, boltKind } from './spawn';
export { hashWeaveState, hashPacket } from './hash';
export { createReferenceScene, sceneCenter, type ReferenceScene } from './scenes';
export { stormDamage, paintSpell } from './terrain';
