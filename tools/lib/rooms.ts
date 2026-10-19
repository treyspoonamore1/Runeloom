import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOMS_DIR = fileURLToPath(new URL('../../data/rooms', import.meta.url));

/** Reads a room file by id ("test/m0_room") from data/rooms. */
export function loadRoomText(id: string): string {
  return readFileSync(join(ROOMS_DIR, `${id}.txt`), 'utf8');
}

/** All room ids under data/rooms. */
export function listRoomIds(dir = ROOMS_DIR): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listRoomIds(full));
    else if (name.endsWith('.txt'))
      out.push(
        relative(ROOMS_DIR, full)
          .replace(/\\/g, '/')
          .replace(/\.txt$/, ''),
      );
  }
  return out.sort();
}

/**
 * Every room text under data/rooms by id, the RoomSource adventure games load rooms from
 * (createAdventure, replays, bench, shots). Read once per call.
 */
export function loadAllRooms(dir = ROOMS_DIR): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of listRoomIds(dir)) out[id] = readFileSync(join(dir, `${id}.txt`), 'utf8');
  return out;
}
