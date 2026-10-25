/**
 * `npm run sim -- --progression [--seed 1] [--seeds 3] [--rekindles 1] [--variants play,offline]
 *   [--sessions 1.5,16] [--rekindle-stall 3] [--rekindle-after 9] [--max-hours 40] [--out dir] [--no-hearth]
 *   [--verbose] [--json]`
 * (M7 acceptance: the progression sim, src/sim/bots/progression.ts). Per seed and variant:
 *
 * - `play`: the model player with the Hearth, play time only (no offline breaks).
 * - `offline`: the same with sessions: `--sessions <play h>,<break h>` (default 1.5 h of play, then
 *   16 h away, of which 8 h count, the offline cap).
 * - `nohearth`: the ladder's player, who never visits the Hearth (`--no-hearth` runs only this).
 *
 * Prints each run and a summary table, and writes every rift as CSV plus a JSON summary into
 * shots/progression/ (gitignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILDING_IDS } from '../../data/hearth';
import { runProgression, type ProgressionResult, type Sessions } from '../../src/sim/bots/progression';
import { loadAllRooms } from './rooms';

export const PROGRESSION_VARIANTS = ['play', 'offline', 'nohearth'] as const;
export type ProgressionVariant = (typeof PROGRESSION_VARIANTS)[number];

export interface ProgressionCliOptions {
  seed: number;
  seeds: number;
  rekindles: number;
  variants: ProgressionVariant[];
  sessions: Sessions;
  stallFailures: number | null;
  stallRifts: number | null;
  maxHours: number;
  /** Where the CSV and JSON go (default shots/progression). */
  outDir?: string;
  verbose?: boolean;
  json?: boolean;
}

const OUT_DIR = fileURLToPath(new URL('../../shots/progression', import.meta.url));

const SHORT: Record<string, string> = {
  kindling_pit: 'pit',
  rune_garden: 'garden',
  expedition_board: 'board',
  salvage_loom: 'loom',
};

const f2 = (n: number | undefined) => (n === undefined ? '  -  ' : n.toFixed(2).padStart(5));
const int = (n: number) => Math.round(n).toLocaleString('en-US');

/** Parses "--sessions 1.5,16" (hours of play, hours of break). */
export function parseSessions(s: string): Sessions {
  const [p, b] = s.split(',').map(Number);
  if (!(p! > 0) || !(b! >= 0) || !Number.isFinite(p) || !Number.isFinite(b))
    throw new Error(`--sessions takes "<play hours>,<break hours>", got "${s}"`);
  return { playSeconds: p! * 3600, breakSeconds: b! * 3600 };
}

function describe(r: ProgressionResult, variant: ProgressionVariant): string[] {
  const out: string[] = [];
  const fails = r.rifts.filter((x) => !x.completed);
  const r1 = r.rekindles[0];
  out.push(
    `seed ${r.seed} [${variant}]: campaign ${r.campaignHours.toFixed(2)} h; ${r.rifts.length} rifts, ` +
      `${fails.length} failed (${fails.filter((x) => x.died).length} deaths); ` +
      (r1
        ? `first Rekindle at ${r1.hours.toFixed(2)} h (T${r1.bestTier}, ${r1.ash} Ash, ${int(r1.embersSpent)} Embers spent)`
        : 'no Rekindle') +
      `; level ${r.finalLevel}; ${r.finalHours.toFixed(2)} h played` +
      (r.offlineHours > 0 ? `, ${r.offlineHours.toFixed(0)} h offline` : ''),
  );
  for (const [cycle, fc] of Object.entries(r.firstClear))
    out.push(
      `  cycle ${cycle} first clears (h): ` +
        Object.entries(fc)
          .map(([t, h]) => `T${t} ${h.toFixed(2)}`)
          .join(', '),
    );
  for (const [i, k] of r.rekindles.entries())
    out.push(
      `  Rekindle ${i + 1} at ${k.hours.toFixed(2)} h after ${k.rifts} rifts (T${k.bestTier}, ${k.reason}): level ${k.level}, ${k.ash} Ash; ` +
        BUILDING_IDS.map((b) => `${SHORT[b]} ${k.buildings[b]}`).join(', ') +
        `; bought ${k.mutations.join(', ') || 'nothing'}`,
    );
  if (r.hearth) {
    const t = r.tally;
    out.push(
      `  Embers: ${int(r.riftEmbers)} from play, ${int(t.expeditionEmbers)} from expeditions; ${int(t.embersSpent)} spent in ${t.upgrades} upgrades`,
    );
    out.push(
      `  Thread Scrap: Kindling Pit ${int(r.pitScrap)}, Salvage Loom ${int(r.salvageScrap)}; Spindlewright ${int(t.scrapSpent)} spent: ` +
        (Object.entries(t.bought)
          .map(([c, n]) => `${n} ${c}`)
          .join(', ') || 'nothing'),
    );
    out.push(
      `  Rune Garden: ${r.gardenLevels} rune levels; expeditions ${t.expeditionsSent} sent, ${t.expeditionsCollected} back: ` +
        `${t.expeditionParts} parts, ${t.expeditionCurrency} currencies, ${t.expeditionSigils} sigils (${t.expeditionsAtBest} at the best tier, ${t.expeditionTierUps} a tier up), ${int(t.expeditionEmbers)} Embers`,
    );
  }
  return out;
}

function verboseLines(r: ProgressionResult): string[] {
  return r.rifts.map(
    (x) =>
      `  ${x.hours.toFixed(2)} h c${x.cycle} T${x.tier} L${x.level} life ${Math.round(x.maxLife)} gear ${x.gearScore.toFixed(0)} ` +
      `${x.completed ? 'cleared' : x.died ? 'DIED' : 'timeout'} +${x.embers} Embers (${x.embersHeld} held) ` +
      `+${x.sigils} sigils (top T${x.topSigil}) ` +
      BUILDING_IDS.map((b) => `${SHORT[b]}${x.buildings[b]}`).join(' ') +
      ` [${x.mods.join(' ')}]`,
  );
}

function csv(r: ProgressionResult, variant: string): string {
  const head = [
    'seed',
    'variant',
    'rift',
    'cycle',
    'tier',
    'completed',
    'died',
    'hours',
    'offline_hours',
    'level',
    'gear_score',
    'max_life',
    'embers',
    'embers_held',
    ...BUILDING_IDS,
    'mods',
  ];
  const rows = r.rifts.map((x, i) =>
    [
      r.seed,
      variant,
      i + 1,
      x.cycle,
      x.tier,
      x.completed ? 1 : 0,
      x.died ? 1 : 0,
      x.hours.toFixed(3),
      x.offlineHours.toFixed(1),
      x.level,
      x.gearScore.toFixed(0),
      Math.round(x.maxLife),
      x.embers,
      x.embersHeld,
      ...BUILDING_IDS.map((b) => x.buildings[b]),
      x.mods.join(' '),
    ].join(','),
  );
  return [head.join(','), ...rows, ''].join('\n');
}

/**
 * The summary row of one run: hours to tiers 1, 4, 8, 10, the first Rekindle (its tier and why),
 * the re-climb to that tier after it (hours, and as a share of the first climb from the Warden),
 * the new tiers 11 and 12, and the second Rekindle.
 */
export function curveRow(r: ProgressionResult) {
  const c0 = r.firstClear[0] ?? {};
  const c1 = r.firstClear[1] ?? {};
  const r1 = r.rekindles[0];
  const back = r1 && c1[r1.bestTier] !== undefined ? c1[r1.bestTier]! - r1.hours : undefined;
  const first = r1 ? c0[r1.bestTier]! - r.campaignHours : undefined;
  return {
    seed: r.seed,
    t1: c0[1],
    t4: c0[4],
    t8: c0[8],
    t10: c0[10],
    rekindle: r1?.hours,
    rekindleTier: r1?.bestTier,
    reason: r1?.reason,
    ash: r1?.ash,
    level: r1?.level ?? r.finalLevel,
    buildings: r1?.buildings,
    reclimb: back,
    reclimbShare: back !== undefined && first ? back / first : undefined,
    after11: c1[11],
    after12: c1[12],
    rekindle2: r.rekindles[1]?.hours,
    reasons: r.rekindles.map((k) => k.reason),
    rifts: r1?.rifts ?? r.rifts.length,
    failed: r.rifts.filter((x) => !x.completed && (!r1 || x.cycle === 0)).length,
  };
}

export function runProgressionCli(o: ProgressionCliOptions): void {
  const rooms = loadAllRooms();
  const outDir = o.outDir ?? OUT_DIR;
  mkdirSync(outDir, { recursive: true });
  const t0 = performance.now();
  const summary: { variant: ProgressionVariant; rows: ReturnType<typeof curveRow>[] }[] = [];
  for (const variant of o.variants) {
    const rows: ReturnType<typeof curveRow>[] = [];
    for (let k = 0; k < o.seeds; k++) {
      const r = runProgression({
        seed: o.seed + k,
        rooms,
        hearth: variant !== 'nohearth',
        sessions: variant === 'offline' ? o.sessions : null,
        rekindles: o.rekindles,
        rekindlePolicy: { stallFailures: o.stallFailures, stallRifts: o.stallRifts },
        maxHours: o.maxHours,
      });
      writeFileSync(join(outDir, `${variant}-seed${r.seed}.csv`), csv(r, variant));
      writeFileSync(join(outDir, `${variant}-seed${r.seed}.json`), JSON.stringify(r, null, 1));
      rows.push(curveRow(r));
      if (!o.json) {
        for (const line of describe(r, variant)) console.log(line);
        if (o.verbose) for (const line of verboseLines(r)) console.log(line);
      }
    }
    summary.push({ variant, rows });
  }
  writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
  if (o.json) {
    console.log(JSON.stringify(summary));
    return;
  }
  console.log('');
  console.log(
    "variant   seed   T1    T4    T8    T10   Rekindle (tier, why)  Ash level  back   %    T11'  T12'  Rekindle2 rifts fails  buildings at Rekindle",
  );
  for (const { variant, rows } of summary) {
    for (const x of rows)
      console.log(
        `${variant.padEnd(9)} ${String(x.seed).padStart(4)}  ${f2(x.t1)} ${f2(x.t4)} ${f2(x.t8)} ${f2(x.t10)}  ${f2(x.rekindle)} ` +
          `${(x.rekindle === undefined ? '' : `(T${x.rekindleTier}, ${x.reason})`).padEnd(14)} ` +
          `${String(x.ash ?? '-').padStart(3)} ${String(x.level).padStart(5)}  ${f2(x.reclimb)} ` +
          `${x.reclimbShare === undefined ? '  - ' : `${Math.round(x.reclimbShare * 100)}%`.padStart(4)} ` +
          `${f2(x.after11)} ${f2(x.after12)}  ${f2(x.rekindle2)}    ` +
          `${String(x.rifts).padStart(5)} ${String(x.failed).padStart(5)}  ` +
          (x.buildings ? BUILDING_IDS.map((b) => `${SHORT[b]} ${x.buildings![b]}`).join(', ') : '-'),
      );
    const reasons = rows.flatMap((x) => x.reasons);
    if (reasons.length)
      console.log(
        `  ${variant}: Rekindles by reason: ` +
          (['cap', 'stall', 'failures'] as const)
            .map((k) => `${k} ${reasons.filter((r) => r === k).length}`)
            .join(', '),
      );
  }
  console.log(
    "(hours of play; back: hours from the first Rekindle to its tier again, %: of the first climb from the Warden to it; T11' and T12' after the first Rekindle)",
  );
  console.log(`${((performance.now() - t0) / 1000).toFixed(0)} s; CSV and JSON in ${outDir}`);
}
