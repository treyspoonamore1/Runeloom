/** One readout run and the averaging behind runReadout (weave/readout.ts). */
import { damageTypes, type DamageAmounts } from '../../../../data/combatTypes';
import { readoutRules, referenceScenes } from '../../../../data/readout';
import { triggers } from '../../../../data/runes';
import type { Tuning } from '../../../../data/tuning';
import { SIM_HZ } from '../../core/constants';
import { Button, type InputFrame } from '../../core/input';
import { zeroAmounts } from '../../combat/damage';
import { step } from '../../step';
import type { SpellProgram, SpellSpec } from '../program';
import type { ReadoutInput, ReadoutResult } from '../readout';
import { applyLoadoutSpec, LOADOUT_SLOTS } from './loadout';
import { refreshHero } from '../../hero/hero';
import { createReferenceScene } from './scenes';

/** Event triggers the readout forces once per second (DESIGN §5.5). */
const FORCED_EVENTS = ['dodge_start', 'hurt', 'crit'];

export interface RunTotals {
  hitDamage: number;
  dotDamage: number;
  byType: DamageAmounts;
  hits: number;
  fires: number;
  manaSpent: number;
  manaRefund: number;
  spawned: number;
  dropped: number;
}

/** How far a root form reaches from the player, for close-range placement; Infinity when it reaches anywhere. */
function reachOf(spec: SpellSpec): number {
  const p = spec.params;
  switch (p.form) {
    case 'strike':
      return p.reach;
    case 'nova':
      return p.radius;
    case 'swath':
      return p.length;
    case 'orb':
      return p.orbitRadius;
    default:
      return Infinity;
  }
}

/** Distance from the player to the dummies' center for this root (DESIGN §5.5, data/readout.ts). */
export function standoff(scene: ReadoutInput['scene'], root: SpellSpec): number {
  const d = referenceScenes[scene].centerDistance;
  const near = reachOf(root) * readoutRules.closeRangeFraction;
  return near < d ? near : d;
}

export function measureRun(
  input: ReadoutInput,
  tuning: Tuning,
  capacity: number | null,
  program: SpellProgram,
  distance: number,
  seed: number,
): RunTotals {
  const scene = createReferenceScene(input.scene, { seed, tuning, distance });
  const state = scene.state;
  const notations: (string | null)[] = new Array<string | null>(LOADOUT_SLOTS).fill(null);
  notations[0] = program.notation;
  if (input.hero) {
    state.hero = structuredClone(input.hero);
    refreshHero(state);
  }
  const runes = input.runes ? [[...input.runes]] : undefined;
  applyLoadoutSpec(state, { spindleId: input.spindleId, capacity, notations, runes });
  state.cheats.infiniteMana = true;
  if (FORCED_EVENTS.includes(program.trigger.event))
    state.triggerForcing = Math.round(readoutRules.forcedEventInterval * SIM_HZ);
  const frame: InputFrame = {
    moveX: 0,
    moveY: 0,
    aimX: scene.centerX,
    aimY: scene.centerY,
    buttons: Button.Cast1,
  };
  const t: RunTotals = {
    hitDamage: 0,
    dotDamage: 0,
    byType: zeroAmounts(),
    hits: 0,
    fires: 0,
    manaSpent: 0,
    manaRefund: 0,
    spawned: 0,
    dropped: 0,
  };
  const ticks = Math.round(input.seconds * SIM_HZ);
  for (let i = 0; i < ticks; i++) {
    step(state, frame);
    for (const e of state.events) {
      switch (e.type) {
        case 'hit':
          if (e.target === 'player') break;
          t.hitDamage += e.amount;
          t.hits++;
          if (e.byType) for (const k of damageTypes) t.byType[k] += e.byType[k];
          else t.byType[e.damageType] += e.amount;
          break;
        case 'dot':
          if (e.target === 'player') break;
          t.dotDamage += e.amount;
          t.byType[e.damageType] += e.amount;
          break;
        case 'triggerFired':
          t.fires++;
          t.manaSpent += e.mana;
          break;
        case 'manaRefund':
          t.manaRefund += e.amount;
          break;
        case 'spellSpawn':
          t.spawned++;
          break;
        case 'spawnDropped':
          t.dropped++;
          break;
        default:
          break;
      }
    }
  }
  return t;
}

function hasOnKill(spec: SpellSpec): boolean {
  return spec.children.some((c) => c.proc.kind === 'on_kill' || hasOnKill(c.spec));
}

function notesFor(input: ReadoutInput, program: SpellProgram, distance: number): string[] {
  const notes: string[] = [];
  if (program.trigger.event === 'kill' || hasOnKill(program.root))
    notes.push("Harvest and On Kill can't fire against dummies, so their damage isn't included.");
  // Not forced either: dummies never die, so nothing shatters (DECISIONS: Shatter in the readout).
  if (program.trigger.event === 'shatter')
    notes.push("Shatter can't fire against dummies, so its damage isn't included.");
  if (FORCED_EVENTS.includes(program.trigger.event))
    notes.push(
      `${triggers[program.trigger.id].name} assumes its event happens once per second, limited by its ICD.`,
    );
  if (distance < referenceScenes[input.scene].centerDistance)
    notes.push(`Close range: measured with the dummies ${Math.round(distance * 10) / 10} cells away.`);
  return notes;
}

export function summarize(
  input: ReadoutInput,
  program: SpellProgram,
  distance: number,
  runs: readonly RunTotals[],
): ReadoutResult {
  const n = runs.length;
  const secs = input.seconds;
  const mean = (f: (r: RunTotals) => number): number => {
    let s = 0;
    for (const r of runs) s += f(r);
    return s / n;
  };
  const perRunDps = runs.map((r) => (r.hitDamage + r.dotDamage) / secs);
  const fires = mean((r) => r.fires);
  const dpsByType = zeroAmounts();
  for (const k of damageTypes) dpsByType[k] = mean((r) => r.byType[k]) / secs;
  return {
    ok: true,
    dps: mean((r) => (r.hitDamage + r.dotDamage) / secs),
    hitDps: mean((r) => r.hitDamage / secs),
    dotDps: mean((r) => r.dotDamage / secs),
    dpsByType,
    hitsPerSecond: mean((r) => r.hits / secs),
    firesPerSecond: fires / secs,
    manaSpentPerSecond: mean((r) => r.manaSpent / secs),
    manaRefundPerSecond: mean((r) => r.manaRefund / secs),
    instancesPerFire: fires > 0 ? mean((r) => r.spawned) / fires : 0,
    droppedPerFire: fires > 0 ? mean((r) => r.dropped) / fires : 0,
    perRunDps,
    notes: notesFor(input, program, distance),
  };
}
