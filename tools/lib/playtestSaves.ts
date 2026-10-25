/**
 * `npm run sim -- --playtest-saves [--seed 1] [--tier 7] [--out data/playtest]`: writes the two
 * bundled playtest saves the title screen offers in dev builds (src/app/playtestStarts.ts), made
 * by the headless bots. Deterministic: the same seed gives the same files.
 *
 * - `after_warden.json`: the campaign bot's character the moment the Cinder Warden is dead and the
 *   Hearth is lit, resting at K10's Loom Stone (src/sim/bots/campaign.ts, `runCampaign`).
 * - `mid_climb.json`: the progression sim's character (src/sim/bots/progression.ts) after it
 *   first reaches `--tier` (default 7): between rifts, home in the hub at its Loom Stone, none
 *   open, with Embers unspent, buildings upgraded and an expedition out.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { regionRooms } from '../../data/progression';
import { BUILDING_IDS } from '../../data/hearth';
import { runCampaign } from '../../src/sim/bots/campaign';
import { pacingMinutes } from '../../src/sim/bots/pacing';
import { runProgression } from '../../src/sim/bots/progression';
import { restAtStone } from '../../src/sim/bots/riftLadder';
import { makeSave, parseSave, type SaveData } from '../../src/sim/save';
import type { GameState } from '../../src/sim/state';
import { loadAllRooms } from './rooms';

export interface PlaytestSavesOptions {
  seed: number;
  /** The tier the mid-climb character has reached (default 7). */
  tier: number;
  /** Where the files go (default data/playtest). */
  outDir?: string;
}

const OUT_DIR = fileURLToPath(new URL('../../data/playtest', import.meta.url));

export interface PlaytestSave {
  file: string;
  save: SaveData;
  hours: number;
}

function summary(name: string, s: SaveData, hours: number): string {
  const h = s.hero.hearth;
  return (
    `${name}: level ${s.hero.level}, riftTier ${s.hero.riftTier}, ${h.embers} Embers (${h.embersSpent} spent), ` +
    `buildings ${BUILDING_IDS.map((b) => `${b} ${h.buildings[b]}`).join(', ')}, ` +
    `${h.expeditions.length} expeditions, room ${s.world.roomId}, ${s.hero.sigils.length} sigils, ${hours.toFixed(2)} h played`
  );
}

/** Builds both saves (nothing is written). */
export function buildPlaytestSaves(o: Pick<PlaytestSavesOptions, 'seed' | 'tier'>): PlaytestSave[] {
  const rooms = loadAllRooms();
  let warden: GameState | null = null;
  const campaign = runCampaign({ seed: o.seed, rooms, craft: true, onEnd: (s) => (warden = s) });
  const w = warden as GameState | null;
  if (!w || w.room.id !== regionRooms.k10) throw new Error('playtest saves: the campaign did not end in K10');
  if (!w.hero.hearth.lit) throw new Error('playtest saves: the Warden did not light the Hearth');
  restAtStone(w);
  const afterWarden = makeSave(w);
  let mid: SaveData | null = null;
  let midHours = 0;
  runProgression({
    seed: o.seed,
    rooms,
    rekindles: 0,
    stopAtTier: o.tier,
    onEnd: (s, r) => {
      restAtStone(s);
      mid = makeSave(s);
      midHours = r.finalHours;
    },
  });
  if (!mid) throw new Error('playtest saves: the progression sim gave no game');
  return [
    { file: 'after_warden.json', save: afterWarden, hours: pacingMinutes(campaign) / 60 },
    { file: 'mid_climb.json', save: mid, hours: midHours },
  ];
}

export function runPlaytestSavesCli(o: PlaytestSavesOptions): void {
  const dir = o.outDir ?? OUT_DIR;
  mkdirSync(dir, { recursive: true });
  for (const { file, save, hours } of buildPlaytestSaves(o)) {
    const text = JSON.stringify(save);
    parseSave(text); // never write a file the game would refuse
    writeFileSync(join(dir, file), text + '\n');
    console.log(`${join(dir, file)} (${(text.length / 1024).toFixed(0)} KB)`);
    console.log('  ' + summary(file, save, hours));
  }
}
