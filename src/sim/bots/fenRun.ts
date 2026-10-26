/**
 * The Fen campaign bot (BUILD_PLAN M8 phase 1 acceptance "Campaign bot"): from a game standing in
 * K10 with the storm door open (the "Fen start" save, data/playtest/fen_start.json, or the
 * progression sim's character at its tier 8 gate), the character walks the Glasswater Fen and the
 * Drowned Foundry in route order (bots/fenRoute.ts), fights every room's packs with the campaign
 * bot (bots/campaignNav.ts, the kiter with its Fen boss tactics) and solves each puzzle with the
 * scripted solutions the puzzle tests prove (bots/fenPuzzles.ts, foundryPuzzles.ts), with real
 * mana, real damage and live hazards. It kills the Old Bellwether in F5 and the Glasswater Coil in
 * F10 (with Floodline Tide strands once F6 has given Tide).
 *
 * Per visit: enter (walking out of the last room, or from K10 the first time), touch the room's
 * Loom Stone, rest when life is low (the campaign's rule: a walk back to the last stone, logged),
 * apply the reference build (crafting on; the Storm Bolt on E in the boss rooms and Floodline on
 * Q against the Coil), fight until the room is clear, then play its puzzle steps with their
 * weaves and walk out. A death respawns at the last Loom Stone as in the game; the bot comes
 * straight back into the room it died in (logged). A step that fails falls back to opening the
 * room's doors and taking its pickups (flagged; it should never happen).
 *
 * Headless and deterministic: a pure function of the starting state and the room texts.
 */
import { PLAYER_ID } from '../actors/enemies';
import { resetPlayerVitals } from '../actors/playerVitals';
import { killEnemy } from '../combat/hits';
import { SIM_HZ } from '../core/constants';
import { fenRooms, regionRooms } from '../../../data/progression';
import { collectRoomLoot } from '../items/loot';
import type { GameState } from '../state';
import { step } from '../step';
import { setSlotWeave } from '../weave/runtime/loadout';
import { openDoor } from '../world/objectGround';
import { touchLoomStone } from '../world/objectTouch';
import { enterRoom } from '../world/transition';
import { roomFlags, type Edge } from '../world/worldState';
import { CampaignNav } from './campaignNav';
import { applyReferenceBuild } from './campaignPlan';
import { applyFenBossWeaves, fenBossCharacter, type FenTide } from './fenBossBot';
import { runeIds, runes, type RuneId } from '../../../data/runes';
import type { HeroState } from '../hero/types';
import { makeRune } from '../items/items';
import type { FenShort, PuzzleStep } from './fenPuzzles';
import { edgeTo, exitStep, fenRoute, stormDoorStep, type FenVisit } from './fenRoute';
import { ScriptDriver } from './script';

/** Rest before a room below this life fraction; before a boss room below the second (campaign.ts). */
const REST_BELOW = 0.5;
const REST_BELOW_BOSS = 0.9;
/** Leave a room whose remaining enemies can't be reached or shot for this long. */
const STRANDED_TICKS = 10 * SIM_HZ;

export interface FenStepLog {
  name: string;
  ok: boolean;
  seconds: number;
  error?: string;
}

export interface FenVisitLog {
  label: string;
  roomId: string;
  areaLevel: number;
  entryLevel: number;
  exitLevel: number;
  rested: boolean;
  /** Seconds from arriving to the room clear (deaths and retries included). */
  fightSeconds: number;
  /** Seconds of puzzle steps and the walk out. */
  puzzleSeconds: number;
  /** Boss rooms: seconds from the boss's first damage to its death. */
  bossSeconds?: number;
  steps: FenStepLog[];
  /** A step failed: the room's doors were opened and its pickups taken by the script instead. */
  fallback: boolean;
  deaths: number;
  deathCauses: string[];
  damageTaken: number;
  kills: number;
  xpGained: number;
  /** Enemies finished by the script after a stall, and enemies left unreachable. */
  stuck: number;
  left: string[];
  lifeLeft: number;
}

export interface FenRunOptions {
  /** Called after every step (debugging, benches). */
  onStep?: (state: GameState) => void;
  /** Give up on a room's fight after this many seconds (default 600) or deaths (default 3). */
  maxSeconds?: number;
  maxDeaths?: number;
  /** Finish a room's last enemies after this many seconds without damage dealt (default 45). */
  stallSeconds?: number;
  /** Spend crafting currency between rooms (default true). */
  craft?: boolean;
  /** The Coil with Floodline ('tide', default) or without. */
  tide?: FenTide;
  /** Called with the state as the bot enters F10, before the fight (the no-Tide comparison). */
  beforeCoil?: (state: GameState) => void;
  /**
   * Open K10's storm door with a Storm Bolt and walk through (the progression sim's character
   * arrives at K10's Loom Stone with it shut). Default false: the Fen start save has it open and
   * the bot steps straight through.
   */
  stormDoor?: boolean;
}

export interface FenRunResult {
  visits: FenVisitLog[];
  fightSeconds: number;
  puzzleSeconds: number;
  deaths: number;
  startLevel: number;
  endLevel: number;
  bellwetherSeconds: number | null;
  coilSeconds: number | null;
  /** The Coil is dead (bossesDefeated holds it). */
  coilDead: boolean;
  /** Steps that failed (each fell back to opening the room). */
  failedSteps: string[];
}

/** Rune ids a weave notation uses, with repeats (one rune item each). */
function weaveRunes(notation: string): RuneId[] {
  return (notation.match(/[A-Za-z]+/g) ?? []).map((w) => {
    const id = BY_NOTATION.get(w);
    if (!id) throw new Error(`fenRun: unknown rune "${w}" in ${notation}`);
    return id;
  });
}
const BY_NOTATION = new Map<string, RuneId>(runeIds.map((id) => [runes[id].notation, id]));

/**
 * The tier 8 reference character for the Fen (BUILD_PLAN M8 phase 1 "a tier 8 reference build"):
 * the one the Fen bosses were tuned with (bots/fenBossBot.ts fenBossCharacter, the rift bot's tier 8
 * build at level 30) plus the rune copies the route's puzzle weaves need at once (a tier 8
 * character owns many duplicates: the Fen start save holds 7 to 26 of each). Tide is not among
 * them: it comes from F6's shrine.
 */
export function fenReferenceCharacter(): HeroState {
  const hero = fenBossCharacter();
  const need = new Map<RuneId, number>();
  for (const v of fenRoute)
    for (const st of v.steps) {
      if (st === 'fight') continue;
      const counts = new Map<RuneId, number>();
      for (const w of st.weaves)
        for (const r of w ? weaveRunes(w) : []) counts.set(r, (counts.get(r) ?? 0) + 1);
      for (const [r, n] of counts) need.set(r, Math.max(need.get(r) ?? 0, n));
    }
  const level = hero.runes[0]?.level ?? 1;
  for (const [r, n] of need) {
    if (r === 'tide') continue;
    for (let have = hero.runes.filter((i) => i.rune === r).length; have < n; have++)
      hero.runes.push(makeRune(hero, r, level));
    if (!hero.unlockedRunes.includes(r)) hero.unlockedRunes.push(r);
  }
  hero.unlockedRunes.sort();
  return hero;
}

/** Sets slots 0..3 to a step's weaves (all emptied first); returns the ones that didn't apply. */
function applyStepWeaves(state: GameState, weaves: readonly (string | null)[]): string[] {
  if (weaves.length === 0) return [];
  for (let slot = 0; slot < 5; slot++) setSlotWeave(state, slot, null);
  const bad: string[] = [];
  weaves.forEach((w, slot) => {
    if (w !== null && !setSlotWeave(state, slot, w).applied) bad.push(w);
  });
  return bad;
}

/** Opens every door in the room and takes its pickups: the fallback when a step fails. */
function forceRoom(state: GameState): void {
  for (const o of state.objects)
    if ((o.kind === 'door' || o.kind === 'locked_door' || o.kind === 'big_key_door') && !o.on)
      openDoor(state, o);
}

interface Tally {
  log: FenVisitLog;
  recent: { tick: number; src: string; amount: number }[];
}

/** Counts one tick's events into the visit log. */
function count(state: GameState, t: Tally): { dealt: boolean; died: boolean } {
  let dealt = false;
  let died = false;
  for (const e of state.events) {
    if ((e.type === 'hit' || e.type === 'dot' || e.type === 'chargeHit') && e.target === 'player') {
      const amount = 'amount' in e ? e.amount : e.damage;
      t.log.damageTaken += amount;
      const srcId = 'sourceId' in e ? e.sourceId : -1;
      const src =
        state.enemies.find((x) => x.id === srcId)?.kind ?? (e.type === 'chargeHit' ? 'charge' : 'world');
      t.recent.push({ tick: state.tick, src, amount });
    } else if ((e.type === 'hit' || e.type === 'dot') && e.target !== 'player') dealt = true;
    else if (e.type === 'death') t.log.kills++;
    else if (e.type === 'xpGained') t.log.xpGained += e.amount;
    else if (e.type === 'playerDeath') {
      died = true;
      t.log.deaths++;
      const by = new Map<string, number>();
      for (const h of t.recent)
        if (state.tick - h.tick <= 3 * SIM_HZ) by.set(h.src, (by.get(h.src) ?? 0) + h.amount);
      t.log.deathCauses.push(
        [...by.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ${Math.round(v)}`)
          .join(', '),
      );
      t.recent.length = 0;
    }
  }
  return { dealt, died };
}

/** Back into the room after a respawn elsewhere, through the edge it was entered by. */
function reenter(state: GameState, roomId: string, from: Edge | null): void {
  enterRoom(state, roomId, from ? { kind: 'edge', from } : { kind: 'default' });
}

/** Steps until the room's fight is over (cleared, stranded, or out of time or lives). */
function fight(state: GameState, visit: FenVisit, t: Tally, from: Edge | null, opts: FenRunOptions): void {
  const roomId = fenRooms[visit.room];
  const maxTicks = (opts.maxSeconds ?? 600) * SIM_HZ;
  const maxDeaths = opts.maxDeaths ?? 3;
  const stallTicks = (opts.stallSeconds ?? 45) * SIM_HZ;
  const nav = new CampaignNav();
  const start = state.tick;
  let lastDamage = state.tick;
  let bossHitAt = -1;
  const flags = () => roomFlags(state.world, roomId);
  while (!flags().cleared && state.tick - start < maxTicks) {
    step(state, nav.input(state));
    opts.onStep?.(state);
    const { dealt } = count(state, t);
    if (dealt) {
      lastDamage = state.tick;
      if (bossHitAt < 0 && state.enemies.some((x) => x.boss !== null && x.life < x.maxLife))
        bossHitAt = state.tick;
    }
    if (state.room.id !== roomId) {
      if (t.log.deaths >= maxDeaths) break;
      reenter(state, roomId, from);
      applyFightBuild(state, visit, opts);
      lastDamage = state.tick;
      bossHitAt = -1;
      continue;
    }
    if (t.log.deaths >= maxDeaths && state.player.dead) break;
    if (nav.strandedTicks > STRANDED_TICKS) {
      for (const e of state.enemies)
        if (!e.dead) t.log.left.push(`${e.kind}@${Math.round(e.x)},${Math.round(e.y)}`);
      break;
    }
    if (state.tick - lastDamage > stallTicks && !state.player.dead) {
      for (const e of state.enemies)
        if (!e.dead) {
          t.log.stuck++;
          killEnemy(state, e, PLAYER_ID, 'hit');
        }
      lastDamage = state.tick;
    }
  }
  t.log.fightSeconds += (state.tick - start) / SIM_HZ;
  if (bossHitAt >= 0 && flags().cleared) t.log.bossSeconds = (state.tick - bossHitAt) / SIM_HZ;
}

/** The reference build for a visit: crafting on; the boss weaves in F5 and F10. */
function applyFightBuild(state: GameState, visit: FenVisit, opts: FenRunOptions): void {
  applyReferenceBuild(state, { craft: opts.craft ?? true });
  if (visit.boss)
    applyFenBossWeaves(state, visit.boss === 'glasswater_coil' ? (opts.tide ?? 'tide') : 'none');
}

/** Plays one puzzle step; true when it finished (the player may have walked out of the room). */
function playStep(state: GameState, s: PuzzleStep, t: Tally, opts: FenRunOptions): FenStepLog {
  const bad = applyStepWeaves(state, s.weaves);
  if (bad.length > 0)
    return { name: s.name, ok: false, seconds: 0, error: `weaves didn't apply: ${bad.join('; ')}` };
  const d = new ScriptDriver(s.script(state));
  const start = state.tick;
  const limit = 240 * SIM_HZ;
  for (let f = d.next(state); f !== null && state.tick - start < limit; f = d.next(state)) {
    step(state, f);
    opts.onStep?.(state);
    if (count(state, t).died)
      return { name: s.name, ok: false, seconds: (state.tick - start) / SIM_HZ, error: 'died' };
  }
  const seconds = (state.tick - start) / SIM_HZ;
  const error = d.error ?? (state.tick - start >= limit ? 'out of time' : undefined);
  return error ? { name: s.name, ok: false, seconds, error } : { name: s.name, ok: true, seconds };
}

function emptyLog(label: string, roomId: string, state: GameState): FenVisitLog {
  return {
    label,
    roomId,
    areaLevel: state.room.level,
    entryLevel: state.hero.level,
    exitLevel: state.hero.level,
    rested: false,
    fightSeconds: 0,
    puzzleSeconds: 0,
    steps: [],
    fallback: false,
    deaths: 0,
    deathCauses: [],
    damageTaken: 0,
    kills: 0,
    xpGained: 0,
    stuck: 0,
    left: [],
    lifeLeft: 1,
  };
}

/** The current room id (a function, so checks after steps aren't narrowed away). */
const here = (state: GameState): string => state.room.id;

/** Plays the Fen's route from `state` (in K10, the storm door open). Mutates and returns logs. */
export function runFen(state: GameState, opts: FenRunOptions = {}): FenRunResult {
  if (here(state) !== regionRooms.k10) throw new Error(`runFen: starts in K10, not ${here(state)}`);
  const startLevel = state.hero.level;
  const visits: FenVisitLog[] = [];
  const failed: string[] = [];
  // The storm door: K10's north exit to G1.
  let from: Edge | null = edgeTo(state, fenRooms.g1);
  if (opts.stormDoor) {
    const log = emptyLog('k10', regionRooms.k10, state);
    const r = playStep(state, stormDoorStep, { log, recent: [] }, opts);
    log.steps.push(r);
    log.puzzleSeconds = r.seconds;
    if (!r.ok) {
      log.fallback = true;
      failed.push(`k10: ${r.name}: ${r.error}`);
    }
    visits.push(log);
  }
  if (here(state) !== fenRooms.g1) reenter(state, fenRooms.g1, from);
  for (let i = 0; i < fenRoute.length; i++) {
    const visit = fenRoute[i]!;
    const roomId = fenRooms[visit.room];
    if (state.room.id !== roomId) {
      // A failed step's fallback: carry on from where the walk out should have led.
      reenter(state, roomId, from);
    }
    from = arrivalEdge(state, i);
    const hero = state.hero;
    const p = state.player;
    const log = emptyLog(visit.label, roomId, state);
    const t: Tally = { log, recent: [] };
    const stone = state.objects.find((o) => o.kind === 'loom_stone');
    if (stone) touchLoomStone(state, stone);
    if (p.life < p.maxLife * (visit.boss ? REST_BELOW_BOSS : REST_BELOW)) {
      log.rested = true;
      resetPlayerVitals(p, state.tuning, state.heroMods);
    }
    if (visit.boss === 'glasswater_coil') opts.beforeCoil?.(state);
    applyFightBuild(state, visit, opts);
    fight(state, visit, t, from, opts);
    log.lifeLeft = p.maxLife > 0 ? p.life / p.maxLife : 0;
    const steps = [...visit.steps];
    let walkOut = visit.exitTo;
    for (let k = 0; k <= steps.length; k++) {
      // After the listed steps, walk out toward the next room if they didn't (once).
      if (k === steps.length) {
        if (walkOut === undefined || here(state) !== roomId) break;
        steps.push(exitStep(state, walkOut));
        walkOut = undefined;
      }
      if (here(state) !== roomId) break;
      const next = steps[k]!;
      if (next === 'fight') {
        t.log.left = [];
        applyFightBuild(state, visit, opts);
        fight(state, visit, t, from, opts);
        continue;
      }
      const r = playStep(state, next, t, opts);
      log.steps.push(r);
      log.puzzleSeconds += r.seconds;
      if (!r.ok) {
        log.fallback = true;
        failed.push(`${visit.label}: ${r.name}: ${r.error}`);
        if (state.room.id !== roomId) reenter(state, roomId, from);
        forceRoom(state);
      }
    }
    collectRoomLoot(state);
    log.exitLevel = hero.level;
    visits.push(log);
  }
  const sum = (f: (v: FenVisitLog) => number) => visits.reduce((s, v) => s + f(v), 0);
  const boss = (label: string) => visits.find((v) => v.label === label)?.bossSeconds ?? null;
  return {
    visits,
    fightSeconds: sum((v) => v.fightSeconds),
    puzzleSeconds: sum((v) => v.puzzleSeconds),
    deaths: sum((v) => v.deaths),
    startLevel,
    endLevel: state.hero.level,
    bellwetherSeconds: boss('f5'),
    coilSeconds: boss('f10'),
    coilDead: state.world.bossesDefeated.includes('glasswater_coil'),
    failedSteps: failed,
  };
}

/** The edge the player arrived through for visit i: the previous visit's room's side. */
function arrivalEdge(state: GameState, i: number): Edge | null {
  const prev: FenShort | null = i > 0 ? fenRoute[i - 1]!.room : null;
  const prevId = prev ? fenRooms[prev] : regionRooms.k10;
  const back = edgeTo(state, prevId);
  if (back === null) return null;
  // Arrival is "from" the edge of the previous room the player left by: the opposite side.
  return ({ w: 'e', e: 'w', n: 's', s: 'n' } as const)[back];
}
