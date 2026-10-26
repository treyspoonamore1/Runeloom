/**
 * The progression sim (M7 acceptance: "a model player reaches the first Rekindle in 6 to 10 hours
 * of play"). A new game is played through the region by the campaign bot (the Cinder Warden
 * lights the Hearth), then the same character plays rifts as the rift ladder sim does
 * (bots/riftLadder.ts), using the Hearth between them:
 *
 * - From K10's Loom Stone it fast travels to the Hearth's (HeroEdit 'travel'). Rifts return to
 *   the stone they opened from, so it lives in the hub from then on.
 * - Before every rift: a Hearth visit (bots/hearthVisit.ts), then Rekindle when the policy says
 *   so (bots/hearthPolicy.ts shouldRekindle) and Mutations with the Ash, then the best sigil the
 *   ladder allows (riftLadder.ts pickSigil; the free tier-1 sigil when it holds none).
 * - Hearth time follows play time: the sim's ticks advance the Hearth for the bot's fight time
 *   only, but a human's rift takes fight × humanFightFactor plus overheads (bots/pacing.ts); the
 *   difference is advanced directly (meta/hearth.ts advanceHearth, as the dev console's
 *   `offline` does), so production matches play time.
 * - Sessions (optional): after `playSeconds` of play, a break of `breakSeconds` is sent as the
 *   recorded 'offline' edit, capped at 8 hours as the app does.
 *
 * `hearth: false` is the comparison: the ladder's player, who never visits the Hearth (no
 * buildings, expeditions, Salvage Loom or Rekindle; Embers pile up unused).
 *
 * Headless and deterministic: a pure function of the options.
 */
import { hearthStone, offline as offlineCap } from '../../../data/hearth';
import { regionRooms } from '../../../data/progression';
import type { RiftModId } from '../../../data/rift';
import { applyHeroEdit } from '../hero/edits';
import { advanceHearth } from '../meta/hearth';
import {
  productionMult,
  scrapPerMinute,
  maxRiftTier,
  ashForRekindle,
  mutationCost,
  riftOpenCap,
} from '../meta/view';
import type { BuildingId, MutationId } from '../meta/types';
import type { GameState } from '../state';
import type { RoomSource } from '../world/worldState';
import { runCampaign } from './campaign';
import { applyReferenceBuild } from './campaignPlan';
import {
  defaultRekindlePolicy,
  nextMutation,
  rekindleReason,
  type RekindlePolicy,
  type RekindleReason,
} from './hearthPolicy';
import { emptyTally, visitHearth, type HearthTally } from './hearthVisit';
import { humanFightFactor, pacingMinutes, riftOverhead } from './pacing';
import { fenDue, playFenFromHome, type ProgressionFen } from './progressionFen';
import { clearOpenRift } from './riftBot';
import { gearScore, goHome, pickSigil, restAtStone } from './riftLadder';

export interface Sessions {
  /** Play seconds per session. */
  playSeconds: number;
  /** Seconds between sessions (the 'offline' edit gets at most data/hearth.ts offline.capSeconds). */
  breakSeconds: number;
}

/** The default session model: 1.5 h of play, then a 16 h break (8 h offline, the cap). */
export const defaultSessions: Sessions = { playSeconds: 1.5 * 3600, breakSeconds: 16 * 3600 };

export interface ProgressionOptions {
  seed: number;
  /** Room texts; must hold the hub room (data/hearth.ts hearthRoom) when `hearth` is on. */
  rooms: RoomSource;
  /** Use the Hearth (default true). */
  hearth?: boolean;
  /** Offline breaks between sessions (default none: play only). */
  sessions?: Sessions | null;
  /** Rekindles to play through (default 1); the run ends at the tier cap after the last. */
  rekindles?: number;
  rekindlePolicy?: RekindlePolicy;
  /** Stop after this many rifts (default 500) or play hours (default 40). */
  maxRifts?: number;
  maxHours?: number;
  /** Stop once this tier is completed in the first cycle (smoke tests). */
  stopAtTier?: number;
  /**
   * Called as the run ends with the live game: between rifts, home (in the hub with the Hearth
   * on), none open. The playtest saves (tools/lib/playtestSaves.ts) are made from it.
   */
  onEnd?: (state: GameState, result: ProgressionResult) => void;
}

export interface ProgressionRift {
  /** Rekindles before it (0: the first cycle). */
  cycle: number;
  tier: number;
  mods: RiftModId[];
  completed: boolean;
  died: boolean;
  timedOut: boolean;
  /** Play hours when it ended (campaign included) and offline hours so far. */
  hours: number;
  offlineHours: number;
  level: number;
  gearScore: number;
  maxLife: number;
  /** Embers picked up in the rift, and held after it. */
  embers: number;
  embersHeld: number;
  /** Building levels when it opened. */
  buildings: Record<BuildingId, number>;
  /** Sigils it gave (boss and kills), and the highest sigil tier held after it. */
  sigils: number;
  topSigil: number;
}

export interface ProgressionRekindle {
  hours: number;
  offlineHours: number;
  /** Rifts played before it (all cycles). */
  rifts: number;
  bestTier: number;
  ash: number;
  /** Why the model player Rekindled (bots/hearthPolicy.ts rekindleReason). */
  reason: RekindleReason;
  embersSpent: number;
  level: number;
  buildings: Record<BuildingId, number>;
  mutations: MutationId[];
}

export interface ProgressionResult {
  seed: number;
  hearth: boolean;
  sessions: Sessions | null;
  campaignHours: number;
  rifts: ProgressionRift[];
  /** M8: the Fen runs (normally one, right after tier 8 is first completed). */
  fen: ProgressionFen[];
  /** Play hours when each tier was first completed, per cycle: firstClear[cycle][tier]. */
  firstClear: Record<number, Record<number, number>>;
  rekindles: ProgressionRekindle[];
  tally: HearthTally;
  /** Embers picked up in rifts and the regions after the Hearth lit (expeditions in `tally`). */
  riftEmbers: number;
  /** Thread Scrap the Kindling Pit made, the Salvage Loom made. */
  pitScrap: number;
  salvageScrap: number;
  /** Rune levels the Rune Garden gave. */
  gardenLevels: number;
  offlineHours: number;
  finalLevel: number;
  finalHours: number;
}

function travelToHearth(state: GameState): void {
  restAtStone(state);
  const err = applyHeroEdit(state, { kind: 'travel', roomId: hearthStone.roomId, key: hearthStone.key });
  if (err) throw new Error(`progression: ${err}`);
}

/** Fen attempts before the model player gives up on it (it then climbs no higher than tier 8). */
const MAX_FEN_TRIES = 2;

export function runProgression(opts: ProgressionOptions): ProgressionResult {
  const useHearth = opts.hearth ?? true;
  const sessions = opts.sessions ?? null;
  const targetRekindles = useHearth ? (opts.rekindles ?? 1) : 0;
  const policy = opts.rekindlePolicy ?? defaultRekindlePolicy;
  const maxRifts = opts.maxRifts ?? 500;
  const maxSeconds = (opts.maxHours ?? 40) * 3600;
  let end: GameState | null = null;
  const campaign = runCampaign({ seed: opts.seed, rooms: opts.rooms, craft: true, onEnd: (s) => (end = s) });
  const state = end as GameState | null;
  if (!state) throw new Error('progression: the campaign gave no game');
  if (state.room.id !== regionRooms.k10)
    throw new Error(`progression: the campaign ended in ${state.room.id}`);
  if (!state.hero.hearth.lit) throw new Error('progression: the Warden did not light the Hearth');
  const hero = state.hero;
  const h = hero.hearth;
  let play = pacingMinutes(campaign) * 60;
  const res: ProgressionResult = {
    seed: opts.seed,
    hearth: useHearth,
    sessions,
    campaignHours: play / 3600,
    rifts: [],
    fen: [],
    firstClear: {},
    rekindles: [],
    tally: emptyTally(),
    riftEmbers: 0,
    pitScrap: 0,
    salvageScrap: 0,
    gardenLevels: 0,
    offlineHours: 0,
    finalLevel: 0,
    finalHours: 0,
  };
  let offlineSeconds = 0;
  let sessionPlay = play;
  const climb = { failuresInARow: 0, riftsSinceBest: 0 };
  /** Hearth time passing outside the sim's ticks (or offline): pit Scrap and garden levels counted. */
  const pass = (seconds: number, asOffline: boolean): void => {
    if (!(seconds > 0)) return;
    res.pitScrap += ((scrapPerMinute(h.buildings.kindling_pit) * productionMult(hero)) / 60) * seconds;
    if (asOffline) {
      const err = applyHeroEdit(state, { kind: 'offline', seconds });
      if (err) throw new Error(`progression: ${err}`);
      for (const e of state.events) if (e.type === 'offlineGains') res.gardenLevels += e.runeLevels;
    } else res.gardenLevels += advanceHearth(state, seconds).runeLevels;
  };
  if (useHearth) travelToHearth(state);
  const done = () =>
    h.rekindles >= targetRekindles &&
    (hero.riftTier >= maxRiftTier(hero) ||
      (opts.stopAtTier !== undefined && h.rekindles === 0 && hero.riftTier >= opts.stopAtTier));
  while (res.rifts.length < maxRifts && play < maxSeconds && !done()) {
    if (sessions && sessionPlay >= sessions.playSeconds) {
      const off = Math.min(sessions.breakSeconds, offlineCap.capSeconds);
      pass(off, true);
      offlineSeconds += off;
      sessionPlay = 0;
    }
    // M8: tier 8 done and the Coil alive (tier 9 can't open): play the Fen first (bots/progressionFen.ts).
    if (fenDue(state) && res.fen.length < MAX_FEN_TRIES) {
      const simBefore = h.playSeconds;
      const { fen, seconds } = playFenFromHome(state, play / 3600, useHearth ? 'hearth' : 'k10');
      const simSeconds = h.playSeconds - simBefore;
      res.pitScrap += ((scrapPerMinute(h.buildings.kindling_pit) * productionMult(hero)) / 60) * simSeconds;
      pass(seconds - simSeconds, false);
      play += seconds;
      sessionPlay += seconds;
      res.fen.push(fen);
      continue;
    }
    restAtStone(state);
    if (useHearth) {
      visitHearth(state, res.tally);
      const reason = h.rekindles < targetRekindles ? rekindleReason(hero, climb, policy) : null;
      if (reason !== null) {
        const ash = ashForRekindle(hero);
        const rec: ProgressionRekindle = {
          hours: play / 3600,
          offlineHours: offlineSeconds / 3600,
          rifts: res.rifts.length,
          bestTier: hero.riftTier,
          ash,
          reason,
          embersSpent: h.embersSpent,
          level: hero.level,
          buildings: { ...h.buildings },
          mutations: [],
        };
        const err = applyHeroEdit(state, { kind: 'rekindle' });
        if (err) throw new Error(`progression: ${err}`);
        for (let m = nextMutation(hero); m !== null; m = nextMutation(hero)) {
          if (h.ash < (mutationCost(hero, m) ?? Infinity)) break;
          if (applyHeroEdit(state, { kind: 'mutationBuy', mutation: m }) !== null) break;
          rec.mutations.push(m);
        }
        res.rekindles.push(rec);
        climb.failuresInARow = 0;
        climb.riftsSinceBest = 0;
        visitHearth(state, res.tally);
      }
      pass(riftOverhead.hearthVisit, false);
      play += riftOverhead.hearthVisit;
      sessionPlay += riftOverhead.hearthVisit;
    } else applyReferenceBuild(state, { craft: true });
    if (hero.sigils.length === 0) applyHeroEdit(state, { kind: 'freeSigil' });
    // The ladder's next tier, but never past what opens (M8: 8 until the Coil dies).
    const sigil = pickSigil(hero.sigils, Math.min(hero.riftTier, riftOpenCap(hero, state.world) - 1));
    if (!sigil) throw new Error('progression: no sigil the ladder allows');
    const before = {
      gear: gearScore(state),
      life: state.player.maxLife,
      embers: h.embers,
      simSeconds: h.playSeconds,
      buildings: { ...h.buildings },
      cycle: h.rekindles,
      best: hero.riftTier,
    };
    const err = applyHeroEdit(state, { kind: 'openRift', uid: sigil.uid });
    if (err) throw new Error(`progression: ${err}`);
    const sigilsBefore = hero.sigils.length;
    const onStep = (s: GameState) => {
      for (const e of s.events) if (e.type === 'autoSalvaged') res.salvageScrap += e.scrap;
      for (const e of s.events) if (e.type === 'gardenRuneLevel') res.gardenLevels++;
    };
    const log = clearOpenRift(state, state.rooms, { build: 'fire', seed: opts.seed, onStep });
    goHome(state);
    const human = log.seconds * humanFightFactor + log.cleared * riftOverhead.perRoom + riftOverhead.perRift;
    const simSeconds = h.playSeconds - before.simSeconds;
    res.pitScrap +=
      ((scrapPerMinute(before.buildings.kindling_pit) * productionMult(hero)) / 60) * simSeconds;
    pass(human - simSeconds, false);
    play += human;
    sessionPlay += human;
    const embers = h.embers - before.embers;
    res.riftEmbers += embers;
    // The game's ladder is the truth: a boss killed just before a death still completes the rift.
    const completed = log.completed || hero.riftTier > before.best;
    climb.failuresInARow = completed ? 0 : climb.failuresInARow + 1;
    climb.riftsSinceBest = hero.riftTier > before.best ? 0 : climb.riftsSinceBest + 1;
    const hours = play / 3600;
    const fc = (res.firstClear[before.cycle] ??= {});
    if (completed && fc[log.tier] === undefined) fc[log.tier] = hours;
    res.rifts.push({
      cycle: before.cycle,
      tier: log.tier,
      mods: log.mods,
      completed,
      died: log.died,
      timedOut: log.timedOut,
      hours,
      offlineHours: offlineSeconds / 3600,
      level: hero.level,
      gearScore: before.gear,
      maxLife: before.life,
      embers,
      embersHeld: h.embers,
      buildings: before.buildings,
      sigils: hero.sigils.length - sigilsBefore,
      topSigil: hero.sigils.reduce((m, g) => Math.max(m, g.tier), 0),
    });
  }
  res.offlineHours = offlineSeconds / 3600;
  res.finalLevel = hero.level;
  res.finalHours = play / 3600;
  opts.onEnd?.(state, res);
  return res;
}
