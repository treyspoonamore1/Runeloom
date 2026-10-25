/**
 * The rift ladder sim (M6.5 balance pass; the M7 progression sim builds on it): a new game is
 * played through the region by the campaign bot (bots/campaign.ts) up to the Cinder Warden, then
 * the same character farms rifts with only what it finds, climbing the tier ladder.
 *
 * Between rifts the character rests at K10's Loom Stone and applies the reference build with
 * crafting (bots/campaignPlan.ts: equip the best found gear, craft, Fuse, passives, weaves). It
 * opens the highest-tier sigil the ladder allows (fewest prefixes on a tie), takes the free
 * tier-1 sigil when it holds none, and clears the rift with the rift bot (bots/riftBot.ts). A
 * death fails the rift as in the game. Headless and deterministic: a pure function of the seed.
 *
 * Play time (bots/pacing.ts): the campaign's pacing estimate, then per rift its fight seconds ×
 * humanFightFactor plus riftOverhead per room entered and per rift.
 *
 * M7: superseded by the progression sim (bots/progression.ts, `--progression`), which plays the
 * same ladder with the Hearth and Rekindles. This one never visits the Hearth and never
 * Rekindles, so it stops at the first cycle's tier cap (10) whatever `targetTier` asks; it is the
 * progression sim's `nohearth` player without the Hearth's bookkeeping.
 */
import { regionRooms } from '../../../data/progression';
import { riftMods } from '../../../data/rift';
import { SIM_HZ } from '../core/constants';
import { applyHeroEdit } from '../hero/edits';
import type { RiftSigil } from '../hero/types';
import type { GameState } from '../state';
import { step } from '../step';
import { NEUTRAL_INPUT } from '../core/input';
import type { RoomSource } from '../world/worldState';
import { runCampaign } from './campaign';
import { humanFightFactor, pacingMinutes, riftOverhead } from './pacing';
import { applyReferenceBuild } from './campaignPlan';
import { clearOpenRift, type RiftRunLog } from './riftBot';
import { itemScore } from './campaignPlan';
import { findItem } from '../items/items';
import { maxRiftTier } from '../meta/view';

export interface LadderOptions {
  seed: number;
  rooms: RoomSource;
  /** Stop once this tier is completed (default 8: the Rekindle unlock). */
  targetTier?: number;
  /** Stop after this many rifts (default 150). */
  maxRifts?: number;
}

export interface LadderRift extends RiftRunLog {
  /** Play hours when this rift ended (campaign included). */
  hours: number;
  /** The equipped gear's summed item score before it (bots/campaignPlan.ts itemScore). */
  gearScore: number;
  maxLife: number;
}

export interface LadderResult {
  seed: number;
  /** Play hours of the campaign up to the Warden. */
  campaignHours: number;
  rifts: LadderRift[];
  /** Play hours when each tier was first completed, by tier. */
  firstClear: Record<number, number>;
  reachedTarget: boolean;
  finalLevel: number;
}

/** The equipped gear's summed item score (bots/campaignPlan.ts itemScore). */
export function gearScore(state: GameState): number {
  let n = 0;
  for (const uid of Object.values(state.hero.equipped)) {
    if (uid === null) continue;
    const it = findItem(state.hero, uid);
    if (it) n += itemScore(it);
  }
  return n;
}

const prefixes = (g: RiftSigil) => g.mods.filter((m) => riftMods[m].kind === 'prefix').length;

/** The sigil the bot opens: highest tier the ladder allows, then fewest prefixes, then oldest. */
export function pickSigil(sigils: readonly RiftSigil[], best: number): RiftSigil | null {
  const ok = sigils.filter((g) => g.tier <= best + 1);
  ok.sort((a, b) => b.tier - a.tier || prefixes(a) - prefixes(b) || a.uid - b.uid);
  return ok[0] ?? null;
}

/** Stands the player on the room's Loom Stone (K10's, the bot's rift home) and rests. */
export function restAtStone(state: GameState): void {
  const stone = state.objects.find((o) => o.kind === 'loom_stone' && o.on);
  if (!stone) throw new Error(`riftLadder: no active Loom Stone in ${state.room.id}`);
  const p = state.player;
  p.x = p.prevX = (stone.tx + 0.5) * 4;
  p.y = p.prevY = (stone.ty + 0.5) * 4;
  applyHeroEdit(state, { kind: 'rest' });
}

/** Walks home from a finished rift: the boss arena's way home, as the game does (closes it). */
export function goHome(state: GameState): void {
  const r = state.world.rift;
  if (r)
    state.world.pending = {
      roomId: r.spec.home.roomId,
      arrival: { kind: 'loomStone', key: r.spec.home.key },
      reason: 'exit',
    };
  // A death or the way home is applied by the next step; respawn waits out its timer.
  for (let i = 0; i < 10 * SIM_HZ && (state.world.rift || state.player.dead); i++) step(state, NEUTRAL_INPUT);
}

export function runRiftLadder(opts: LadderOptions): LadderResult {
  const target = opts.targetTier ?? 8;
  let end: GameState | null = null;
  const campaign = runCampaign({ seed: opts.seed, rooms: opts.rooms, craft: true, onEnd: (s) => (end = s) });
  let seconds = pacingMinutes(campaign) * 60;
  const campaignHours = seconds / 3600;
  const state = end as GameState | null;
  if (!state) throw new Error('riftLadder: the campaign gave no game');
  if (state.room.id !== regionRooms.k10)
    throw new Error(`riftLadder: the campaign ended in ${state.room.id}`);
  // M7: without Rekindles the ladder stops at the first cycle's cap.
  const cap = Math.min(target, maxRiftTier(state.hero));
  const rifts: LadderRift[] = [];
  const firstClear: Record<number, number> = {};
  const max = opts.maxRifts ?? 150;
  while (rifts.length < max && state.hero.riftTier < cap) {
    restAtStone(state);
    applyReferenceBuild(state, { craft: true });
    if (state.hero.sigils.length === 0) applyHeroEdit(state, { kind: 'freeSigil' });
    const sigil = pickSigil(state.hero.sigils, state.hero.riftTier);
    if (!sigil) throw new Error('riftLadder: no sigil the ladder allows');
    const gs = gearScore(state);
    const maxLife = state.player.maxLife;
    const err = applyHeroEdit(state, { kind: 'openRift', uid: sigil.uid });
    if (err) throw new Error(`riftLadder: ${err}`);
    const log = clearOpenRift(state, state.rooms, { build: 'fire', seed: opts.seed });
    goHome(state);
    seconds += log.seconds * humanFightFactor + log.cleared * riftOverhead.perRoom + riftOverhead.perRift;
    const hours = seconds / 3600;
    if (log.completed && firstClear[log.tier] === undefined) firstClear[log.tier] = hours;
    rifts.push({ ...log, hours, gearScore: gs, maxLife });
  }
  return {
    seed: opts.seed,
    campaignHours,
    rifts,
    firstClear,
    reachedTarget: state.hero.riftTier >= target,
    finalLevel: state.hero.level,
  };
}
