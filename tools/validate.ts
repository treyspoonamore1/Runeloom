/**
 * Data validation (CLAUDE.md rule 5). Exits non-zero on any problem.
 * Checks so far: every room file parses and its @id matches its path.
 */
import { parseRoom, RoomParseError } from '../src/sim';
import { listRoomIds, loadRoomText } from './lib/rooms';

const problems: string[] = [];

for (const id of listRoomIds()) {
  try {
    const data = parseRoom(loadRoomText(id));
    if (data.header.id !== id) problems.push(`rooms/${id}.txt: @id is "${data.header.id}", expected "${id}"`);
  } catch (e) {
    problems.push(`rooms/${id}.txt: ${e instanceof RoomParseError ? e.message : String(e)}`);
  }
}

if (problems.length > 0) {
  console.error(`validate: ${problems.length} problem(s)`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('validate: ok');
