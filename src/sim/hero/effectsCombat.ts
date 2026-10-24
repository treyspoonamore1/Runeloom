/**
 * Passive and Fuse rules on the player's hits and ailments (HeroMods "Ailments" and "Rules"),
 * called from the combat code. Each hook is a no-op returning its input when no rule applies.
 *
 * Hooks:
 * - playerHitPacket (combat/hits.ts, hitEnemy): per-hit "more" multipliers that depend on the
 *   target or the player — Wildheart (Fire 30% less), Oilcraft (Oiled: Fire more), Rainshadow
 *   (Wet: Storm more), Stormglass (Shocked and Frozen: Storm more), Brittle (Chilled or Frozen:
 *   Strike more), Pyre Walker (player on burning ground: all more).
 * - afterPlayerHit (combat/hits.ts, hitEnemy): Matriarch's Sac (hits apply Oiled), Tar Gland
 *   (Fire hits leave an oil patch, then ignite it).
 * - ailmentScale (combat/ailments.ts applyHitAilments, combat/arcs.ts): durations and effects of
 *   the ailments the player inflicts (ailment/ignite/freeze duration, ignite/chill/shock effect,
 *   chill build-up, flat freeze seconds).
 * - arcReach (combat/arcs.ts): Bog Gill's arc range and extra targets for the player's arcs.
 * - kindredTargets (combat/ailments.ts applyIgnite): Kindred Flame's neighbours (M7 mutation).
 */
import { OWNER } from '../../../data/materials';
import type { DamageAmounts } from '../../../data/combatTypes';
import type { FormId } from '../../../data/runes';
import { PLAYER_ID, type Enemy } from '../actors/enemies';
import { isOiled, isWet } from '../actors/terrainState';
import type { DamagePacket, HitResult } from '../combat/damage';
import { emit } from '../events';
import { applyElement } from '../grid/paint';
import { spillOil } from '../grid/oil';
import type { GameState } from '../state';

/** What playerHitPacket needs from HitInfo. */
export interface PlayerHitInfo {
  /** The spell form dealing the hit (Brittle), when a spell instance deals it. */
  form?: FormId;
  /** A rule 19 arc. */
  arc?: boolean;
}

/** True if the player stands on a burning cell (Pyre Walker). */
export function playerOnBurningGround(state: GameState): boolean {
  const p = state.player;
  const g = state.grid;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  if (cx < 0 || cy < 0 || cx >= g.width || cy >= g.height) return false;
  return g.fire[cy * g.width + cx]! > 0;
}

/**
 * The packet a player hit on `e` resolves with: the same packet when no rule applies, else a
 * copy with Pyre Walker and Brittle added to `more` and the per-type rules in `moreByType`.
 */
export function playerHitPacket(
  state: GameState,
  e: Enemy,
  packet: DamagePacket,
  info: PlayerHitInfo,
): DamagePacket {
  const fx = state.heroMods.effects;
  let all = 1;
  let fire = 1;
  let storm = 1;
  const pyre = fx.pyre_walker ?? 0;
  if (pyre > 0 && playerOnBurningGround(state)) all *= 1 + pyre;
  const brittle = fx.brittle ?? 0;
  if (brittle > 0 && info.form === 'strike' && (e.ailments.chill > 0 || e.ailments.freeze.timeLeft > 0))
    all *= 1 + brittle;
  const wild = fx.wildheart ?? 0;
  if (wild > 0) fire *= 1 - wild;
  const oilcraft = fx.oilcraft ?? 0;
  if (oilcraft > 0 && isOiled(e)) fire *= 1 + oilcraft;
  const rain = fx.rainshadow ?? 0;
  if (rain > 0 && isWet(e)) storm *= 1 + rain;
  const glass = fx.stormglass ?? 0;
  if (glass > 0 && e.ailments.freeze.timeLeft > 0 && e.ailments.shock.timeLeft > 0) storm *= 1 + glass;
  if (all === 1 && fire === 1 && storm === 1) return packet;
  const prev = packet.moreByType;
  const byType: DamageAmounts = {
    physical: prev?.physical ?? 1,
    fire: (prev?.fire ?? 1) * fire,
    frost: prev?.frost ?? 1,
    storm: (prev?.storm ?? 1) * storm,
  };
  return { ...packet, more: all === 1 ? packet.more : [...packet.more, all - 1], moreByType: byType };
}

/** After a player hit on `e` resolved (before its death is handled): Matriarch's Sac, Tar Gland. */
export function afterPlayerHit(state: GameState, e: Enemy, res: HitResult, info: PlayerHitInfo): void {
  const fx = state.heroMods.effects;
  const oiled = fx.oiled_on_hit ?? 0;
  if (oiled > 0) {
    const ts = e.terrain;
    if (ts.oiledLeft <= 0) emit(state, { type: 'oiledChanged', target: e.id, oiled: true, x: e.x, y: e.y });
    if (ts.oiledLeft < oiled) ts.oiledLeft = oiled;
  }
  const tar = fx.tar_gland ?? 0;
  if (tar > 0 && res.byType.fire > 0 && !info.arc) {
    spillOil(state, e.x, e.y, tar);
    applyElement(state, {
      element: 'fire',
      shape: { kind: 'circle', x: e.x, y: e.y, r: tar },
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: 0,
      durationMult: 1,
    });
  }
}

/** True when a player hit needs playerHitPacket / afterPlayerHit at all (cheap neutral path). */
export function hasHitRules(state: GameState): boolean {
  const fx = state.heroMods.effects;
  for (const k in fx) if (HIT_KEYS.has(k)) return true;
  return false;
}

const HIT_KEYS = new Set([
  'pyre_walker',
  'brittle',
  'wildheart',
  'oilcraft',
  'rainshadow',
  'stormglass',
  'oiled_on_hit',
  'tar_gland',
]);

/** Multipliers on the ailments one source inflicts. NEUTRAL_AILMENTS for everyone but the player. */
export interface AilmentScale {
  igniteDps: number;
  igniteDuration: number;
  chillPoints: number;
  freezeDuration: number;
  /** Seconds added to a freeze after the multiplier (Deep Freeze). */
  freezeAdd: number;
  shockEffect: number;
  shockDuration: number;
}

export const NEUTRAL_AILMENTS: Readonly<AilmentScale> = Object.freeze({
  igniteDps: 1,
  igniteDuration: 1,
  chillPoints: 1,
  freezeDuration: 1,
  freezeAdd: 0,
  shockEffect: 1,
  shockDuration: 1,
});

// Rebuilt per call for the player; the sim is single-threaded and callers read it at once.
const scale: AilmentScale = { ...NEUTRAL_AILMENTS };

/**
 * How the ailments `sourceId` inflicts are scaled: increased duration (all ailments, plus Ignite
 * and Freeze on their own), increased Ignite / Chill / Shock effect (Chill effect and build-up
 * both multiply the chill points), and Deep Freeze's flat seconds. Only the player has any.
 */
export function ailmentScale(state: GameState, sourceId: number): Readonly<AilmentScale> {
  if (sourceId !== PLAYER_ID) return NEUTRAL_AILMENTS;
  const m = state.heroMods;
  scale.igniteDps = 1 + m.igniteEffectInc;
  scale.igniteDuration = 1 + m.ailmentDurationInc + m.igniteDurationInc;
  scale.chillPoints = (1 + m.chillGainInc) * (1 + m.chillEffectInc);
  scale.freezeDuration = 1 + m.ailmentDurationInc + m.freezeDurationInc;
  scale.freezeAdd = m.freezeDurationAdd;
  scale.shockEffect = 1 + m.shockEffectInc;
  scale.shockDuration = 1 + m.ailmentDurationInc;
  return scale;
}

/** Rule 19 arc range and target count for a hit of team `owner` (Bog Gill on the player's). */
export function arcReach(state: GameState, owner: number): { range: number; maxTargets: number } {
  const T = state.tuning.terrain.arc;
  if (owner !== OWNER.player) return { range: T.range, maxTargets: T.maxTargets };
  const fx = state.heroMods.effects;
  return {
    range: T.range * (1 + (fx.arc_range_inc ?? 0)),
    maxTargets: T.maxTargets + Math.round(fx.arc_targets_add ?? 0),
  };
}

/**
 * Kindred Flame (M7 mutation, mods.effects.kindred_flame = reach in cells): the live enemies
 * other than `e` whose bodies are within reach of its body (edge to edge) and that are Oiled or
 * Ignited, in enemy order. Empty without the mutation.
 */
export function kindredTargets(state: GameState, e: Enemy): Enemy[] {
  const reach = state.heroMods.effects.kindred_flame ?? 0;
  if (reach <= 0) return [];
  const out: Enemy[] = [];
  for (const n of state.enemies) {
    if (n === e || n.dead || (!isOiled(n) && n.ailments.ignite.timeLeft <= 0)) continue;
    const r = e.radius + n.radius + reach;
    const dx = n.x - e.x;
    const dy = n.y - e.y;
    if (dx * dx + dy * dy <= r * r) out.push(n);
  }
  return out;
}
