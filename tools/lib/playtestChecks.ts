/** Data validation for data/playtest/*.json: each bundled save parses and its room exists. */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSave } from '../../src/sim/save';
import { listRoomIds } from './rooms';

const DIR = fileURLToPath(new URL('../../data/playtest', import.meta.url));

export function playtestSaveErrors(dir = DIR): string[] {
  const known = new Set(listRoomIds());
  const errors: string[] = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const s = parseSave(readFileSync(join(dir, f), 'utf8'));
      if (!known.has(s.world.roomId)) errors.push(`data/playtest/${f}: unknown room "${s.world.roomId}"`);
    } catch (e) {
      errors.push(`data/playtest/${f}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return errors;
}
