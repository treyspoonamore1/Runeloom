/**
 * Drowned Foundry boss tactics for the kiter bot (bots/kiter.ts), M8, as a sensible player fights
 * them (CONTENT §5, §13.2, DESIGN §10.5). A pure function of the state, like the rest of the bot.
 *
 * Old Bellwether:
 * - Shelled and ringable, standing on metal or water: shoot the Storm Bolt in slot 4 (E) at it;
 *   its impact charges what the bell stands on and rings it open (a direct hit alone doesn't).
 * - Its self-toll windup (phase 2): metal and water are hazards; wait it out on stone.
 * - Where to stand and its toll ring: bots/kiterBell.ts.
 *
 * Glasswater Coil (stand spots from the distance to the nearest water, waterDistance):
 * - Never wade: water is always a hazard in its fight, and any conductor is while a pulse or the
 *   pylons glow.
 * - Phase 1: stand coilStandoff cells from the water (beyond its lunge's reach but inside its
 *   trigger, so it surfaces to lunge and can be hit; the kiter dodges the lines).
 * - Phases 2–3 with a Tide weave (fenTideShot, Floodline `Cast > Swath[Tide, Lingering]`): stand
 *   coilLureFrom cells from its water, paint the strip toward the water, step coilLureGap cells off
 *   its end and wait (Exposed in the path it takes normal damage). When the path dries it is
 *   Stranded: close to Strike range just outside its tail thrash and burst it.
 * - Phases 2–3 without Tide: stand inside its lunge reach to bait lunges (its only Surfaced moments).
 * - Phase 3: while its Body pulse glows, shoot the Storm Bolt into its water to Overload it.
 */
import { bossFightOf } from '../../../data/enemies';
import { materialByCode } from '../../../data/materials';
import type { Enemy } from '../actors/enemies';
import { isWaterCell } from '../actors/locomotion';
import { cellOf } from '../actors/swim';
import { Button, type InputFrame } from '../core/input';
import type { GameState } from '../state';
import { hasLineOfSight } from '../world/los';
import { onConductor } from '../ai/bosses/bellwether';
import { bellGoal } from './kiterBell';

export { fenWaveSoon, fenWaveTelegraph } from './kiterBell';

/** Bot heuristics for the Fen bosses (not game tuning). Distances in cells. */
export const fenBotConfig = {
  /** Phase 1: cells from the Coil's water to stand at (beyond its lunge's reach, inside its trigger). */
  coilStandoff: 11,
  /** Phases 2–3 without a Tide path: inside its lunge reach (8), to bait lunges. */
  coilBaitStandoff: 6,
  /** Phases 2–3, before a lure: cells from its water to stand at and cast from (a Swath is 14 long). */
  coilLureFrom: 13,
  /** It casts from at most this far (the strip must reach the water). */
  coilLureMax: 14,
  /** The lure path ends this many cells short of the bot (outside its phase 2 lunge reach of 8). */
  coilLureGap: 9,
  /** It casts from at least this far (a shorter path barely leaves the rim). */
  coilLureMin: 10,
  /** Temporary water cells joined to its water that count as a lure path (a spit puddle is about 12). */
  lureCells: 30,
  /** Stranded: stand this many cells beyond its tail thrash circle (Strike still reaches). */
  thrashMargin: 1,
  /** Stand spots are searched this far around the player, cells. */
  standSearch: 30,
  /** With a lure path down, only this far (it holds where it laid the path). */
  lureHoldSearch: 5,
  /** The water distance field is rebuilt every this many ticks. */
  fieldTicks: 20,
};
const F = fenBotConfig;

/** The kiter's engage point (bots/kiter.ts): `fixed` walks up to it despite the wall margin. */
export type Goal = { x: number; y: number; on: boolean; fixed: boolean; exact: boolean };

/** The Fen boss being fought, if `boss` is one. */
function fight(boss: Enemy | null): 'bellwether' | 'glasswater_coil' | null {
  if (boss === null || boss.boss?.fen == null) return null;
  const f = bossFightOf(boss.kind);
  return f === 'bellwether' || f === 'glasswater_coil' ? f : null;
}

// --- The distance to the boss's water (cached per state and tick block) ---

let field = new Int32Array(0);
let queue = new Int32Array(0);
let fieldState: GameState | null = null;
let fieldTick = -1;
let fieldBoss = -1;
/** Temporary water cells (lure paths, puddles) joined to the boss's water at the last build. */
let bodyTemp = 0;

/**
 * Steps (8 neighbors) from each cell to the nearest cell of the water body the boss is in (all
 * water when it isn't in any), rebuilt every fieldTicks ticks. Puddles apart from it don't count.
 */
export function waterDistance(state: GameState, boss: Enemy | null = null): Int32Array {
  const g = state.grid;
  const n = g.width * g.height;
  const id = boss?.id ?? -1;
  const fresh = state.tick - fieldTick < F.fieldTicks && state.tick >= fieldTick;
  if (fieldState === state && field.length === n && fieldBoss === id && fresh) return field;
  fieldState = state;
  fieldTick = state.tick;
  fieldBoss = id;
  if (field.length !== n) {
    field = new Int32Array(n);
    queue = new Int32Array(n);
  }
  field.fill(-1);
  const w = g.width;
  let tail = 0;
  const start = boss ? cellOf(state, boss.x, boss.y) : -1;
  if (start >= 0 && isWaterCell(g, start)) {
    // The boss's water body first (8 neighbors over water).
    field[start] = 0;
    queue[tail++] = start;
    for (let head = 0; head < tail; head++) {
      const c = queue[head]!;
      const x = c % w;
      const y = (c - x) / w;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= g.height) continue;
          const j = ny * w + nx;
          if (field[j]! >= 0 || !isWaterCell(g, j)) continue;
          field[j] = 0;
          queue[tail++] = j;
        }
    }
  } else
    for (let i = 0; i < n; i++)
      if (isWaterCell(g, i)) {
        field[i] = 0;
        queue[tail++] = i;
      }
  bodyTemp = 0;
  for (let k = 0; k < tail; k++) if (g.borrowed[queue[k]!] === 1) bodyTemp++;
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    const x = c % w;
    const y = (c - x) / w;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx === 0 && dy === 0) || nx < 0 || ny < 0 || nx >= w || ny >= g.height) continue;
        const j = ny * w + nx;
        if (field[j]! >= 0) continue;
        field[j] = field[c]! + 1;
        queue[tail++] = j;
      }
  }
  return field;
}

/** Drops the cached field (the runner just changed the water: a lure path). */
export function forgetWaterField(): void {
  fieldState = null;
}

/** A lure path is down: at least lureCells temporary water cells joined to the boss's water. */
function lureDown(state: GameState, boss: Enemy): boolean {
  waterDistance(state, boss);
  return bodyTemp >= F.lureCells;
}

/** The walkable dry cell nearest the player whose water distance is `want` (±1); false if none. */
function standAt(state: GameState, boss: Enemy, want: number, goal: Goal, R = F.standSearch): boolean {
  const g = state.grid;
  const d = waterDistance(state, boss);
  const p = state.player;
  const cx = Math.floor(p.x);
  const cy = Math.floor(p.y);
  let best = Infinity;
  for (let y = Math.max(1, cy - R); y <= Math.min(g.height - 2, cy + R); y++)
    for (let x = Math.max(1, cx - R); x <= Math.min(g.width - 2, cx + R); x++) {
      const i = y * g.width + x;
      const v = d[i]!;
      if (v < want - 1 || v > want + 1 || state.room.solid[i] === 1) continue;
      // Dry stone only: not other water (the flats), not metal pads (the pylon storm).
      if (materialByCode[g.ground[i]!]!.conducts !== 'none') continue;
      const d2 = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        goal.x = x + 0.5;
        goal.y = y + 0.5;
      }
    }
  if (best === Infinity) return false;
  goal.on = true;
  // The stone ring is narrow: walk right up to the spot, wall or not, and onto it.
  goal.fixed = true;
  goal.exact = true;
  return true;
}

/** Sets the engage point for a Fen boss; false (goal untouched) to let the kiter pick as usual. */
export function fenBossGoal(state: GameState, boss: Enemy | null, goal: Goal): boolean {
  const kind = fight(boss);
  if (kind === 'bellwether') return bellGoal(state, boss!, goal, F.standSearch);
  if (kind !== 'glasswater_coil') return false;
  const b = boss!;
  const s = b.special;
  if (s.stranded || s.trapped) {
    // Burst it: Strike range, just outside the thrash circle.
    const p = state.player;
    let ux = p.x - b.x;
    let uy = p.y - b.y;
    const d = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= d;
    uy /= d;
    const r = 7 + state.tuning.player.radius + F.thrashMargin;
    goal.on = true;
    goal.x = b.x + ux * r;
    goal.y = b.y + uy * r;
    return true;
  }
  if (b.boss!.phase < 2) return standAt(state, b, F.coilStandoff, goal);
  if (tideSlot(state) < 0) return standAt(state, b, F.coilBaitStandoff, goal);
  if (lureDown(state, b)) {
    // Hold near where the path was laid (wandering off would turn the Coil back to deep water);
    // step back only if the path came too close.
    const here = cellOf(state, state.player.x, state.player.y);
    const near = here >= 0 && waterDistance(state, b)[here]! < F.coilLureGap - 1;
    if (near && standAt(state, b, F.coilLureGap, goal, F.lureHoldSearch)) return true;
    goal.on = true;
    goal.fixed = true;
    goal.x = state.player.x;
    goal.y = state.player.y;
    return true;
  }
  return standAt(state, b, F.coilLureFrom, goal);
}

/** The slot (0–3) of a Cast weave whose root carries Tide (the lure: Floodline), or -1. */
export function tideSlot(state: GameState): number {
  for (let k = 0; k < 4; k++) {
    const prog = state.weaves.slots[k]?.program;
    if (prog && prog.trigger.event === 'press' && prog.root.elements.some((x) => x.element === 'tide')) return k;
  }
  return -1;
}

const CAST_BUTTONS = [Button.Cast1, Button.Cast2, Button.Cast3, Button.Cast4] as const;

/**
 * Phases 2–3 with Tide: lays the lure path (CONTENT §13.3 "a typical Stranding") once the bot
 * stands coilLureGap + coilLureMin or more from the Coil's water, the Coil is in the water and not
 * Stranded, and no lure is down: the Tide weave aimed at the nearest cell of its water, so the
 * strip runs from the bot to the water. Returns true if it holds the cast.
 */
export function fenTideShot(state: GameState, out: InputFrame, boss: Enemy | null): boolean {
  if (fight(boss) !== 'glasswater_coil' || boss!.boss!.phase < 2) return false;
  const b = boss!;
  const slot = tideSlot(state);
  const p = state.player;
  if (slot < 0 || b.special.stranded || b.special.trapped || p.dead) return false;
  if (p.castSlot === slot) {
    out.buttons = (out.buttons & Button.Dodge) | CAST_BUTTONS[slot]!;
    return true;
  }
  const prog = state.weaves.slots[slot]!.program!;
  if (p.mana < prog.mana || lureDown(state, b)) return false;
  const d = waterDistance(state, b);
  const here = cellOf(state, p.x, p.y);
  if (here < 0 || d[here]! < F.coilLureMin || d[here]! > F.coilLureMax) return false;
  const g = state.grid;
  const r = d[here]! + 1;
  let best = Infinity;
  for (let y = Math.max(0, Math.floor(p.y) - r); y <= Math.min(g.height - 1, Math.floor(p.y) + r); y++)
    for (let x = Math.max(0, Math.floor(p.x) - r); x <= Math.min(g.width - 1, Math.floor(p.x) + r); x++) {
      if (d[y * g.width + x] !== 0) continue;
      const d2 = (x + 0.5 - p.x) ** 2 + (y + 0.5 - p.y) ** 2;
      if (d2 < best) {
        best = d2;
        out.aimX = x + 0.5;
        out.aimY = y + 0.5;
      }
    }
  if (best === Infinity) return false;
  out.buttons = (out.buttons & Button.Dodge) | CAST_BUTTONS[slot]!;
  forgetWaterField();
  return true;
}

/**
 * The Coil is rarely in Strike reach: bolt it whenever there is mana for a bolt, keeping enough
 * for the Tide weave in phases 2–3 (and the Storm Bolt in phase 3).
 */
export function fenFreeBolts(state: GameState, boss: Enemy | null): boolean {
  if (fight(boss) !== 'glasswater_coil') return false;
  const phase = boss!.boss!.phase;
  let keep = 0;
  const slot = tideSlot(state);
  if (phase >= 2 && slot >= 0) keep += state.weaves.slots[slot]!.program!.mana;
  if (phase >= 3) keep += stormBolt(state) ?? 0;
  const bolt = state.weaves.slots[0]?.program?.mana ?? 0;
  return state.player.mana >= keep + bolt;
}

/** Extra hazards in a Fen boss fight (cell i): see the file comment. */
export function fenBossHazard(state: GameState, i: number, boss: Enemy | null): boolean {
  const kind = fight(boss);
  if (kind === null) return false;
  const conducts = materialByCode[state.grid.ground[i]!]!.conducts !== 'none';
  const b = boss!;
  if (kind === 'bellwether') return conducts && b.attack.phase === 'windup' && b.attack.name === 'self_toll';
  const f = b.boss!.fen!;
  if (isWaterCell(state.grid, i)) return true;
  return conducts && (f.pulseGlowing || f.pylonGlowing);
}

/** The Storm Bolt in slot 4 (E) and its mana, if it holds one. */
function stormBolt(state: GameState): number | null {
  const prog = state.weaves.slots[3]?.program;
  if (!prog || prog.trigger.event !== 'press' || prog.root.form !== 'bolt') return null;
  if (!prog.root.elements.some((x) => x.element === 'storm')) return null;
  return prog.mana;
}

/** Holds the Storm Bolt at the boss when it would ring or Overload it. Returns true if it did. */
export function fenBossShot(state: GameState, out: InputFrame, boss: Enemy | null): boolean {
  const kind = fight(boss);
  if (kind === null) return false;
  const b = boss!;
  const mana = stormBolt(state);
  const p = state.player;
  if (mana === null || p.mana < mana || !hasLineOfSight(state.room, p.x, p.y, b.x, b.y)) return false;
  if (kind === 'bellwether') {
    const s = b.special;
    if (s.openLeft > 0 || s.ringCooldown > 0 || s.dashSpeed > 0 || !onConductor(state, b)) return false;
  } else {
    const f = b.boss!.fen!;
    if (b.boss!.phase < 3 || !f.pulseGlowing) return false;
    const i = cellOf(state, b.x, b.y);
    if (i < 0 || !isWaterCell(state.grid, i)) return false;
  }
  out.aimX = b.x;
  out.aimY = b.y;
  out.buttons = (out.buttons & Button.Dodge) | Button.Cast4;
  return true;
}
