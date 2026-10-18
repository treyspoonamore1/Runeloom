/**
 * Data validation (CLAUDE.md rule 5). Exits non-zero on any error; warnings do not fail.
 * Checks: rooms parse and @id matches path; scenario and scene rooms exist; tuning defaults are finite
 * numbers > 0; spawn markers in the grid match @spawn headers (warning in M0).
 */
import { parseRoom, RoomParseError, scenarios, type RoomData } from '../src/sim';
import { scenes } from '../src/app/scenes';
import { defaultTuning } from '../data/tuning';
import { checkPositiveNumbers, missingRefs, spawnMarkerDiffs } from './lib/checks';
import { listRoomIds, loadRoomText } from './lib/rooms';

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

for (const [id, data] of parsed) {
  const d = spawnMarkerDiffs(data);
  for (const m of d.usedNotDeclared)
    warnings.push(`rooms/${id}.txt: spawn marker ${m} is in the grid but has no @spawn header`);
  for (const m of d.declaredNotUsed)
    warnings.push(`rooms/${id}.txt: @spawn ${m} is declared but not placed in the grid`);
}

console.log(
  `validate: ${roomIds.length} rooms, ${scenarios.length} scenarios, ${scenes.length} scenes, tuning checked`,
);
for (const w of warnings) console.warn(`  warning: ${w}`);
if (errors.length > 0) {
  console.error(`validate: ${errors.length} error(s)`);
  for (const p of errors) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`validate: ok (${warnings.length} warning(s))`);
