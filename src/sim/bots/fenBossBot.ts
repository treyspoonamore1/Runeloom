/**
 * The Drowned Foundry boss bot (BUILD_PLAN M8 phase 1 acceptance: the Bellwether in 60–100 s, the
 * Coil in 120–180 s using Tide strands, and a no-Tide comparison): the tier 8 reference character
 * fights one Fen boss in its arena with the campaign bot (bots/campaignNav.ts with the kiter and its
 * Fen tactics, bots/kiterFen.ts). Headless and deterministic: a pure function of the options and
 * the room texts.
 *
 * The character (fenBossCharacter): the rift bot's tier 8 reference (bots/riftBot.ts riftCharacter)
 * at character level 30, where a player who has just cleared tier 8 stands (CONTENT §13; the M7
 * tier 7 save is level 29), with its runes at level 20 (M8 acceptance: the Fen start save's are)
 * and two more Cast and Bolt runes. Its build is the campaign's reference build
 * without crafting (Fire Bolt, Strike, Frost Bolt on Q), with a Storm Bolt on E (slot 4) for
 * ringing the Bellwether and Overloading the Coil.
 *
 * Tide (the Coil's lure, kiterFen.ts fenTideShot): 'tide' gives it the Tide rune and puts
 * Floodline (`Cast > Swath[Tide, Lingering]`) on Q in place of the Frost Bolt; 'none' fights
 * without (the no-Tide comparison).
 */
import { SIM_HZ } from '../core/constants';
import { hashHex, hashState } from '../hashState';
import { syncWeaveSpindle } from '../hero/equip';
import { refreshHero } from '../hero/hero';
import type { HeroState } from '../hero/types';
import { makeRune } from '../items/items';
import type { Enemy } from '../actors/enemies';
import type { GameState } from '../state';
import { step } from '../step';
import { setSlotWeave } from '../weave/runtime/loadout';
import { createAdventure } from '../world/adventure';
import type { RoomSource } from '../world/worldState';
import { CampaignNav } from './campaignNav';
import { applyReferenceBuild } from './campaignPlan';
import { bossIn } from './kiterBoss';
import { riftCharacter } from './riftBot';
import { maxRuneLevel } from '../../../data/progression';

/** E weaves for the Fen bosses, best first. */
export const stormBoltWeaves: readonly string[] = ['Cast > Bolt[Storm, Chain]', 'Cast > Bolt[Storm]'];

/** Q for the Coil's lure: Floodline (CONTENT §2 #15), then a plain Tide strip. */
export const tideWeaves: readonly string[] = ['Cast > Swath[Tide, Lingering]', 'Cast > Swath[Tide]'];

export type FenTide = 'tide' | 'none';

/**
 * The Fen boss weaves on top of the reference build: the Storm Bolt on E (slot 4) and, with
 * 'tide' and a Tide rune owned, Floodline on Q in place of the Frost Bolt. Returns whether
 * Floodline went on.
 */
export function applyFenBossWeaves(state: GameState, tide: FenTide): boolean {
  for (const n of stormBoltWeaves) if (setSlotWeave(state, 3, n).applied) break;
  if (tide !== 'tide') return false;
  for (const n of tideWeaves) if (setSlotWeave(state, 2, n).applied) return true;
  return false;
}

export interface FenBossFightOptions {
  rooms: RoomSource;
  /** The arena (test/boss_bellwether, test/boss_coil, or the real F5 and F10). */
  roomId: string;
  seed: number;
  tide: FenTide;
  /** Where the fight starts (the arena's entrance), cells. */
  start: { x: number; y: number };
  /** Default fenBossCharacter(). */
  hero?: HeroState;
  /** Give up after this many seconds (default 400). */
  maxSeconds?: number;
  /** Called after every step. */
  onStep?: (state: GameState) => void;
}

export interface FenBossFightLog {
  killed: boolean;
  died: boolean;
  /** Seconds from the first tick to the boss's death (or the end). */
  seconds: number;
  /** Seconds at which phases 2 and 3 began (null: never). */
  phaseAt: (number | null)[];
  damageTaken: number;
  /** Bellwether: times rung. Coil: lure paths laid, strands, Overloads, Iced. */
  rings: number;
  lures: number;
  strands: number;
  overloads: number;
  iced: number;
  level: number;
  /** State hash at the end (determinism checks). */
  hash: string;
}

/** The tier 8 reference character at level 30 (see the file comment). */
export function fenBossCharacter(): HeroState {
  const hero = riftCharacter(8);
  hero.level = 30;
  // M8 acceptance: a tier 8 character's socketed runes are maxed (the Fen start save, the
  // progression sim's character at tier 8, has every rune it uses at 20), not riftCharacter's 14.
  for (const r of hero.runes) r.level = maxRuneLevel;
  // Two more Cast and Bolt runes (duplicates are common by tier 8), so Q and E hold bolts too.
  const level = hero.runes[0]?.level ?? 1;
  for (const rune of ['cast', 'cast', 'bolt', 'bolt'] as const) hero.runes.push(makeRune(hero, rune, level));
  return hero;
}

/** The fight's state at its first tick: the character, its build, the player at the entrance. */
export function setupFenBossFight(opts: Omit<FenBossFightOptions, 'maxSeconds' | 'onStep'>): {
  state: GameState;
  boss: Enemy;
} {
  const state = createAdventure({
    seed: opts.seed,
    rooms: opts.rooms,
    hero: structuredClone(opts.hero ?? fenBossCharacter()),
    startRoomId: opts.roomId,
  });
  syncWeaveSpindle(state);
  refreshHero(state);
  applyReferenceBuild(state, { craft: false });
  if (opts.tide === 'tide' && !state.hero.runes.some((r) => r.rune === 'tide')) {
    // Tide from the F6 shrine.
    const hero = state.hero;
    hero.runes.push(makeRune(hero, 'tide', hero.runes[0]?.level ?? 1));
    if (!hero.unlockedRunes.includes('tide')) hero.unlockedRunes.push('tide');
  }
  applyFenBossWeaves(state, opts.tide);
  const p = state.player;
  p.x = p.prevX = opts.start.x;
  p.y = p.prevY = opts.start.y;
  p.life = p.maxLife;
  p.mana = p.maxMana;
  const boss = bossIn(state.enemies);
  if (!boss) throw new Error(`setupFenBossFight: no boss in ${opts.roomId}`);
  return { state, boss };
}

export function runFenBossFight(opts: FenBossFightOptions): FenBossFightLog {
  const { state, boss } = setupFenBossFight(opts);
  const log: FenBossFightLog = {
    killed: false,
    died: false,
    seconds: 0,
    phaseAt: [null, null],
    damageTaken: 0,
    rings: 0,
    lures: 0,
    strands: 0,
    overloads: 0,
    iced: 0,
    level: state.hero.level,
    hash: '',
  };
  const nav = new CampaignNav();
  const maxTicks = (opts.maxSeconds ?? 900) * SIM_HZ;
  const start = state.tick;
  while (state.tick - start < maxTicks) {
    step(state, nav.input(state));
    opts.onStep?.(state);
    for (const e of state.events) {
      if ((e.type === 'hit' || e.type === 'dot' || e.type === 'chargeHit') && e.target === 'player')
        log.damageTaken += 'amount' in e ? e.amount : e.damage;
      else if (e.type === 'playerDeath') log.died = true;
      else if (e.type === 'bossPhase' && e.id === boss.id) log.phaseAt[e.phase - 2] = (state.tick - start) / SIM_HZ;
      else if (e.type === 'bellRung' && e.id === boss.id) log.rings++;
      else if (e.type === 'swimmerStranded' && e.id === boss.id && e.stranded) log.strands++;
      else if (e.type === 'coilOverloaded') log.overloads++;
      else if (e.type === 'coilState' && e.state === 'iced') log.iced++;
      else if (e.type === 'castStart' && e.slot === 2 && opts.tide === 'tide') log.lures++;
    }
    if (boss.dead) {
      log.killed = true;
      break;
    }
    if (log.died) break;
  }
  log.seconds = (state.tick - start) / SIM_HZ;
  log.hash = hashHex(hashState(state));
  return log;
}
