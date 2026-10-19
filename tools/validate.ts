/**
 * Data validation (CLAUDE.md rule 5). Exits non-zero on any error; warnings do not fail.
 * Checks: rooms parse and @id matches path; scenario and scene rooms exist; tuning defaults are finite
 * numbers > 0; room cross-references (tools/lib/roomChecks.ts: exits both ways, @link doors and
 * conditions, spawn markers, enemy and pack ids, @note characters, keys per dungeon); rune and
 * spindle data is consistent and every CONTENT §2 reference weave compiles or fails as stated.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  capacityMessage,
  compileWeave,
  mustFailWeaves,
  parseRoom,
  parseWeave,
  printWeave,
  referenceWeaves,
  RoomParseError,
  scenarios,
  spindleContext,
  type RoomData,
} from '../src/sim';
import { forms, runeIds, runes, runeShips, shipsThrough } from '../data/runes';
import { spindles, testSpindle } from '../data/spindles';
import { scenes } from '../src/app/scenes';
import { defaultTuning } from '../data/tuning';
import { isEnemyKind } from '../data/enemies';
import { checkPositiveNumbers, missingRefs } from './lib/checks';
import { fuseEffectErrors, passiveTreeErrors } from './lib/passiveChecks';
import { checkRooms } from './lib/roomChecks';
import { listRoomIds, loadRoomText } from './lib/rooms';
import { checkItemData } from './lib/itemChecks';

const errors: string[] = [];
const warnings: string[] = [];

const roomIds = listRoomIds();
const known = new Set(roomIds);
const parsed = new Map<string, RoomData>();
for (const id of roomIds) {
  try {
    const data = parseRoom(loadRoomText(id));
    parsed.set(id, data);
    if (data.header.id !== id) errors.push(`rooms/${id}.txt: @id is "${data.header.id}", expected "${id}"`);
  } catch (e) {
    errors.push(`rooms/${id}.txt: ${e instanceof RoomParseError ? e.message : String(e)}`);
  }
}

errors.push(
  ...missingRefs(
    scenarios.map((s) => ({ from: `scenario ${s.id}`, id: s.roomId })),
    known,
  ),
);
errors.push(
  ...missingRefs(
    scenes.map((s) => ({ from: `scene ${s.id}`, id: s.roomId })),
    known,
  ),
);

for (const p of checkPositiveNumbers(defaultTuning)) errors.push(`data/tuning.ts: ${p}`);

const items = checkItemData();
errors.push(...items.errors);
warnings.push(...items.warnings);

const roomCheck = checkRooms(parsed, { isEnemy: isEnemyKind, isPack: await loadPackCheck() });
errors.push(...roomCheck.errors);
warnings.push(...roomCheck.warnings);

// Runes (data/runes): ids, names, cross-references, numbers.
const notations = new Map<string, string>();
const isForm = (id: string) => Object.prototype.hasOwnProperty.call(forms, id);
for (const id of runeIds) {
  const r = runes[id];
  const at = `data/runes ${id}`;
  if (r.id !== id) errors.push(`${at}: id is "${r.id}"`);
  if (!/^[a-z]+(_[a-z]+)*$/.test(id)) errors.push(`${at}: id is not snake_case`);
  if (r.description.trim() === '') errors.push(`${at}: no description`);
  if (r.notation !== r.name.replace(/ /g, ''))
    errors.push(`${at}: notation "${r.notation}" is not the name without spaces`);
  if (!/^[A-Za-z]+$/.test(r.notation)) errors.push(`${at}: notation "${r.notation}" has non-letters`);
  const prev = notations.get(r.notation.toLowerCase());
  if (prev) errors.push(`${at}: notation "${r.notation}" clashes with ${prev}`);
  notations.set(r.notation.toLowerCase(), id);
  if (!runeShips.includes(r.ships)) errors.push(`${at}: unknown ships "${r.ships}"`);
  for (const p of checkFinite(r)) errors.push(`${at}: ${p}`);
  if (r.kind === 'modifier' && Array.isArray(r.appliesTo))
    for (const f of r.appliesTo) if (!isForm(f)) errors.push(`${at}: appliesTo "${f}" is not a form`);
  if (r.kind === 'branch' && Array.isArray(r.parents))
    for (const f of r.parents) if (!isForm(f)) errors.push(`${at}: parent "${f}" is not a form`);
}

for (const [id, sp] of Object.entries(spindles)) {
  if (sp.id !== id) errors.push(`data/spindles ${id}: id is "${sp.id}"`);
  if (!(sp.capacity > 0 && sp.castSpeed > 0 && sp.fuseSockets > 0))
    errors.push(`data/spindles ${id}: capacity, cast speed and fuse sockets must be > 0`);
}

// CONTENT §2 reference weaves, with M2 runes only.
const m2 = shipsThrough('M2');
for (const w of referenceWeaves) {
  const at = `reference weave #${w.n} ${w.name}`;
  const p = parseWeave(w.notation);
  if (!p.ok) {
    errors.push(`${at}: ${p.error.message}`);
    continue;
  }
  if (printWeave(p.tree) !== w.notation) errors.push(`${at}: prints as "${printWeave(p.tree)}"`);
  const ok = compileWeave(p.tree, spindleContext(testSpindle(w.cx), { allowShips: m2 }));
  if (!ok.ok) errors.push(`${at}: ${ok.error.message}`);
  else if (ok.costs.complexity !== w.cx) errors.push(`${at}: cx ${ok.costs.complexity}, expected ${w.cx}`);
  const small = compileWeave(p.tree, spindleContext(testSpindle(w.cx - 1), { allowShips: m2 }));
  if (small.ok || small.error.message !== capacityMessage(w.cx, w.cx - 1))
    errors.push(`${at}: on ${w.cx - 1} Capacity expected "${capacityMessage(w.cx, w.cx - 1)}"`);
  const fits = Object.values(spindles)
    .filter((sp) => !sp.devOnly && compileWeave(p.tree, spindleContext(sp, { allowShips: m2 })).ok)
    .map((sp) => sp.id)
    .sort();
  if (fits.join() !== [...w.fits].sort().join())
    errors.push(`${at}: fits ${fits.join(', ')}; CONTENT says ${w.fits.join(', ')}`);
}
for (const f of mustFailWeaves) {
  const p = parseWeave(f.notation);
  const r = p.ok ? compileWeave(p.tree, spindleContext(testSpindle(99), { allowShips: m2 })) : null;
  const got = !p.ok ? p.error.message : r && !r.ok ? r.error.message : 'compiled';
  if (got !== f.message) errors.push(`must-fail weave ${f.notation}: got "${got}", expected "${f.message}"`);
}

// Passive tree and Fuse part effects (M4).
errors.push(...passiveTreeErrors(), ...fuseEffectErrors());

console.log(
  `validate: ${roomIds.length} rooms, ${scenarios.length} scenarios, ${scenes.length} scenes, tuning checked, ` +
    `${runeIds.length} runes, ${referenceWeaves.length + mustFailWeaves.length} reference weaves`,
);
for (const w of warnings) console.warn(`  warning: ${w}`);
if (errors.length > 0) {
  console.error(`validate: ${errors.length} error(s)`);
  for (const p of errors) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`validate: ok (${warnings.length} warning(s))`);

/** Every number in a data object is finite (rune data allows 0 and negatives where they mean something). */
function checkFinite(obj: unknown, path = ''): string[] {
  if (typeof obj === 'number') return Number.isFinite(obj) ? [] : [`${path}: ${obj} is not finite`];
  if (obj !== null && typeof obj === 'object')
    return Object.entries(obj).flatMap(([k, v]) => checkFinite(v, path ? `${path}.${k}` : k));
  return [];
}

/**
 * Pack ids from data/packs.ts (the enemies agent adds it in M4), or null while it doesn't exist.
 * Accepts an `isPackId` function, or a `packs` record or array with ids.
 */
async function loadPackCheck(): Promise<((id: string) => boolean) | null> {
  const path = fileURLToPath(new URL('../data/packs.ts', import.meta.url));
  if (!existsSync(path)) return null;
  const mod = (await import(path)) as Record<string, unknown>;
  if (typeof mod.isPackId === 'function') return (id) => (mod.isPackId as (id: string) => boolean)(id);
  const packs = mod.packs;
  if (Array.isArray(packs)) return (id) => packs.some((p: { id?: string }) => p.id === id);
  if (packs !== null && typeof packs === 'object')
    return (id) => Object.prototype.hasOwnProperty.call(packs, id);
  errors.push('data/packs.ts: exports neither isPackId nor packs; pack ids not checked');
  return () => true;
}
