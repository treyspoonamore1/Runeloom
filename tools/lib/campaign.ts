/**
 * `npm run sim -- --campaign [--seed N] [--seeds N] [--until k5] [--json] [--verbose]`: the M4
 * balance campaign (src/sim/bots/campaign.ts) for one or more seeds, printed as a table per seed
 * plus a summary across seeds (level at the Warden, his kill time, deaths, the pacing estimate).
 */
import {
  campaignOrder,
  runCampaign,
  type CampaignResult,
  type RoomKey,
  type RoomLog,
} from '../../src/sim/bots/campaign';
import { expectedCharacters, runEncounter } from '../../src/sim/bots/campaignEncounter';
import { loadAllRooms } from './rooms';

/**
 * Human-play overhead per room on top of the bot's clear time, seconds: walking in, reading the
 * room, looting, the Loom and menus, plus each room's puzzle (an estimate, BUILD_PLAN M4 pacing).
 */
export const roomOverhead: Readonly<Record<RoomKey, number>> = {
  e1: 150, // tutorial: move, dodge, the first weave, the bramble wall
  e2: 240, // the bramble maze, the hidden Loom Shard
  e3: 150, // the bridge
  e4: 180, // barrels, the Heart Seed behind crates
  e5: 90,
  e6: 120, // the Heart Seed
  e7: 180, // three braziers in 10 s, the Loom Shard
  e8: 90,
  k1: 120, // two braziers
  k2: 150, // Lob over the walls
  k3: 150, // the bramble path, the small key
  k4: 180, // the oil channels, the barricade, the Heart Seed
  k5: 60,
  k6: 120, // the Frost rune, freezing the pool
  k7: 180, // the ice crossing, the Heart Seed
  k8: 240, // sliding ice blocks onto two plates, the Loom Shard
  k9: 210, // thaw the ice blocks, freeze the meltwater
  k10: 60,
};

/** Human fights run slower than the bot's: misses, retreats, rereading telegraphs. */
export const humanFightFactor = 1.5;

export function pacingMinutes(r: CampaignResult): number {
  let s = 0;
  for (const l of r.logs) s += l.clearSeconds * humanFightFactor + roomOverhead[l.key];
  return s / 60;
}

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}

function short(w: string | null): string {
  if (w === null) return '-';
  return w.replace('Cast > ', '').replace(/\s+/g, '');
}

export function printCampaign(r: CampaignResult, verbose: boolean): void {
  console.log(`\n=== campaign seed=${r.seed} ===`);
  console.log(
    pad('room', 5) +
      pad('alvl', 5) +
      pad('lvl', 9) +
      pad('xp in', 11) +
      pad('clear s', 8) +
      pad('dmg', 6) +
      pad('die', 4) +
      pad('kills', 6) +
      pad('xp+', 6) +
      pad('life', 9) +
      pad('cap', 4) +
      'weaves / rune levels',
  );
  for (const l of r.logs) {
    const lv =
      (l.exitLevel > l.entryLevel ? `${l.entryLevel}->${l.exitLevel}` : `${l.entryLevel}`) +
      (l.rested ? 'r' : '');
    const flag = l.done ? '' : ' NOT CLEARED';
    const left = l.left.length > 0 ? ` left:${l.left.length}${verbose ? ' ' + l.left.join(' ') : ''}` : '';
    const stuck = l.stuck > 0 ? ` stuck:${l.stuck}${verbose ? ' ' + l.stuckAt.join(' ') : ''}` : '';
    const boss = l.bossSeconds !== undefined ? ` boss ${l.bossSeconds.toFixed(0)} s` : '';
    console.log(
      pad(l.key, 5) +
        pad(l.areaLevel, 5) +
        pad(lv, 9) +
        pad(`${l.entryXp}/${l.entryXpToNext}`, 11) +
        pad(l.clearSeconds.toFixed(0), 8) +
        pad(l.damageTaken.toFixed(0), 6) +
        pad(l.deaths, 4) +
        pad(l.kills, 6) +
        pad(l.xpGained, 6) +
        pad(`${Math.round(l.lifeLeft * 100)}%/${Math.round(l.maxLife)}`, 9) +
        pad(l.capacity, 4) +
        l.weaves.map(short).join(' | ') +
        flag +
        stuck +
        left +
        boss,
    );
    if (l.deathCauses.length) console.log(`       deaths: ${l.deathCauses.join(' | ')}`);
    if (verbose) {
      console.log(`       runes: ${l.runeLevels.join(' ')}`);
      console.log(`       gear: ${l.gear.join('; ')}`);
      const changes = [
        l.equipped.length ? `equip ${l.equipped.join('; ')}` : '',
        l.fused.length ? `fuse ${l.fused.join(', ')}` : '',
        l.allocated.length ? `passives ${l.allocated.join(', ')}` : '',
      ].filter(Boolean);
      if (changes.length) console.log(`       before: ${changes.join(' / ')}`);
      const d = l.drops;
      console.log(
        `       drops: runes [${d.runes.join(', ')}] items ${d.items} parts [${d.parts.join(', ')}] scrap ${d.scrap}`,
      );
    }
  }
  const w = r.logs.find((l) => l.key === 'k10');
  console.log(
    `total fight ${(r.totalSeconds / 60).toFixed(1)} min, deaths ${r.deaths}, final level ${r.finalLevel}` +
      (w ? `, Warden: level ${w.entryLevel}, ${w.bossSeconds?.toFixed(0) ?? '-'} s` : '') +
      `, pacing estimate ${pacingMinutes(r).toFixed(0)} min`,
  );
}

export interface CampaignArgs {
  seed: number;
  seeds: number;
  until?: string;
  json: boolean;
  verbose: boolean;
}

export function runCampaignCli(a: CampaignArgs): void {
  const rooms = loadAllRooms();
  const results: CampaignResult[] = [];
  for (let i = 0; i < a.seeds; i++) {
    const r = runCampaign({ seed: a.seed + i, rooms, until: a.until as RoomKey | undefined });
    results.push(r);
    if (!a.json) printCampaign(r, a.verbose);
  }
  if (a.json) {
    console.log(
      JSON.stringify(
        results.map((r) => ({ ...r, hero: undefined, pacingMinutes: pacingMinutes(r) })),
        null,
        1,
      ),
    );
    return;
  }
  if (results.length > 1) printSummary(results);
  const failed = results.some((r) => r.logs.some((l: RoomLog) => !l.done));
  if (failed) process.exitCode = 1;
}

function printSummary(results: CampaignResult[]): void {
  console.log('\n=== summary ===');
  for (const r of results) {
    const w = r.logs.find((l) => l.key === 'k10');
    console.log(
      `seed ${r.seed}: Warden at level ${w?.entryLevel ?? '-'}, kill ${w?.bossSeconds?.toFixed(0) ?? '-'} s, ` +
        `deaths ${r.deaths}, fight ${(r.totalSeconds / 60).toFixed(1)} min, pacing ${pacingMinutes(r).toFixed(0)} min`,
    );
  }
}

export interface EncounterArgs {
  seed: number;
  seeds: number;
  room?: string;
  level?: number;
  runeLevel?: number;
  verbose: boolean;
  json: boolean;
}

/**
 * `npm run sim -- --encounters [--room k10] [--seed 1] [--seeds 5] [--level 12] [--rune-level 10]`:
 * every room's encounter (or one) with the reference character at its expected level
 * (src/sim/bots/campaignEncounter.ts), once per seed. Exit code 1 if the bot dies anywhere.
 */
export function runEncountersCli(a: EncounterArgs): void {
  const rooms = loadAllRooms();
  const keys = a.room ? [a.room as RoomKey] : campaignOrder;
  const rows: { key: RoomKey; level: number; logs: RoomLog[] }[] = [];
  let failed = false;
  for (const key of keys) {
    if (!campaignOrder.includes(key)) throw new Error(`Unknown room key "${key}"`);
    const spec = { ...expectedCharacters[key] };
    if (a.level !== undefined) spec.level = a.level;
    if (a.runeLevel !== undefined) spec.runeLevel = a.runeLevel;
    const logs: RoomLog[] = [];
    for (let i = 0; i < a.seeds; i++) logs.push(runEncounter({ rooms, key, seed: a.seed + i, spec }));
    rows.push({ key, level: spec.level, logs });
    if (logs.some((l) => l.deaths > 0 || !l.done)) failed = true;
    if (!a.json) printEncounter(key, spec.level, spec.runeLevel, logs, a.verbose);
  }
  if (a.json) console.log(JSON.stringify(rows, null, 1));
  if (failed) process.exitCode = 1;
}

function printEncounter(
  key: RoomKey,
  level: number,
  runeLevel: number,
  logs: RoomLog[],
  verbose: boolean,
): void {
  const n = logs.length;
  const cleared = logs.filter((l) => l.done && l.deaths === 0).length;
  const left = logs.reduce((s, l) => s + l.left.length, 0);
  const t = logs.map((l) => l.clearSeconds);
  const boss = logs.map((l) => l.bossSeconds).filter((x): x is number => x !== undefined);
  const worst = Math.max(...logs.map((l) => l.damageTaken / l.maxLife));
  const fmt = (xs: number[]) =>
    xs.length
      ? `${Math.min(...xs).toFixed(0)}–${Math.max(...xs).toFixed(0)} (mean ${(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(0)})`
      : '-';
  console.log(
    `${pad(key, 5)}L${pad(level, 3)}r${pad(runeLevel, 3)} won ${cleared}/${n}  clear ${pad(fmt(t), 22)}` +
      (boss.length ? ` boss ${pad(fmt(boss), 22)}` : '') +
      ` worst damage ${(worst * 100).toFixed(0)}% of life` +
      (left > 0 ? ` (left ${left} unreachable)` : '') +
      (logs.some((l) => l.deaths) ? `  DEATHS: ${logs.flatMap((l) => l.deathCauses).join(' | ')}` : ''),
  );
  if (verbose) for (const l of logs) console.log(`       ${l.weaves.map(short).join(' | ')}`);
}
