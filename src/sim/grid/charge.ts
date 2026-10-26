/**
 * Storm charge (DESIGN §6.3 rules 11–13). A Storm hit electrifies the water bodies and metal
 * networks it touches. Each electrified body is one charge event (grid.chargeEvents): its cells
 * carry its id, so the entity code hits each entity at most once per event.
 *
 * - Water (rule 11): breadth-first flood fill from the hit water cells, at most water.maxCells
 *   cells and water.maxDistance steps. Per-cell falloff 1 − d / maxDistance, at least minFalloff.
 * - Metal (rule 12): the whole connected network, at most metal.maxCells cells, no falloff.
 * - Rule 13: after an event, the other medium's cells touching it are electrified as a new event
 *   of the same chain with that medium's rules (up to chargeMaxHops hand-offs).
 *
 * A new Storm hit starts a new chain that overwrites older charge in reach (a new effect takes
 * the new owner); a hand-off only claims cells its own chain hasn't. Breadth-first order with
 * fixed neighbor order makes every fill deterministic.
 */
import { MAT, materialByCode } from '../../../data/materials';
import { chargeSeconds, iceConducts, waterConduction } from '../hero/effectsTerrain';
import { emit } from '../events';
import type { GameState } from '../state';
import { markActive } from './active';
import { gridTicks, u8 } from './cells';
import type { ChargeEvent, Grid } from './grid';

export type Medium = 'water' | 'metal';

/** What started a chain. */
export interface ChargeSource {
  owner: number;
  sourceId: number;
  hitDamage: number;
  durationMult: number;
  /**
   * M8: this chain's own water reach instead of the owner's (a Sparkfly's pop reaches 8 cells; the
   * Glasswater Coil's pulses reach farther). Falloff runs over this distance.
   */
  waterReach?: { maxDistance: number; maxCells: number };
}

// Scratch shared by every fill (one fill runs at a time).
let queue = new Int32Array(0);
let dist = new Int32Array(0);
/** CLAIMED by the running chain, CONTACT queued for its next hand-off; cleared per chain. */
let stamp = new Uint8Array(0);
let contacts = new Int32Array(0);

function ensureScratch(n: number): void {
  if (stamp.length >= n) {
    stamp.fill(0, 0, n);
    return;
  }
  queue = new Int32Array(n);
  dist = new Int32Array(n);
  stamp = new Uint8Array(n);
  contacts = new Int32Array(n);
}

const CLAIMED = 1;
const CONTACT = 2;

export function conducts(g: Grid, i: number, medium: Medium): boolean {
  const c = materialByCode[g.ground[i]!]!.conducts;
  return medium === 'water' ? c === 'falloff' : c === 'full';
}

/** conducts(), with ice and ice bridges counting as water when `ice` (Stormglass). */
function conductsAs(g: Grid, i: number, medium: Medium, ice: boolean): boolean {
  if (ice && medium === 'water') {
    const code = g.ground[i]!;
    if (code === MAT.ice || code === MAT.ice_bridge || code === MAT.rime) return true;
  }
  return conducts(g, i, medium);
}

const DX = [1, -1, 0, 0];
const DY = [0, 0, 1, -1];

/**
 * One Storm hit's charge (a chain): electrifies the hit water cells and the hit metal cells,
 * then hands off across water ↔ metal contacts (rule 13), breadth-first by hand-off depth.
 * Seeds not of their medium are ignored; the arrays are copied before anything runs.
 */
export function electrify(
  state: GameState,
  water: ArrayLike<number>,
  waterCount: number,
  metal: ArrayLike<number>,
  metalCount: number,
  src: ChargeSource,
): void {
  const g = state.grid;
  ensureScratch(g.width * g.height);
  const chain = g.nextChargeId;
  const copy = (a: ArrayLike<number>, n: number) => Int32Array.from({ length: n }, (_, k) => a[k]!);
  const jobs: { seeds: Int32Array; medium: Medium; hop: number }[] = [];
  if (waterCount > 0) jobs.push({ seeds: copy(water, waterCount), medium: 'water', hop: 0 });
  if (metalCount > 0) jobs.push({ seeds: copy(metal, metalCount), medium: 'metal', hop: 0 });
  const maxHops = state.tuning.grid.chargeMaxHops;
  for (let k = 0; k < jobs.length; k++) {
    const job = jobs[k]!;
    const n = fill(state, job.seeds, job.medium, chain, src, job.hop > 0);
    if (n > 0 && job.hop < maxHops)
      jobs.push({
        seeds: contacts.slice(0, n),
        medium: job.medium === 'water' ? 'metal' : 'water',
        hop: job.hop + 1,
      });
  }
}

/**
 * One charge event over `medium` from `seeds`. Returns how many contact cells of the other
 * medium it found (written to `contacts`).
 */
function fill(
  state: GameState,
  seeds: Int32Array,
  medium: Medium,
  chain: number,
  src: ChargeSource,
  handoff: boolean,
): number {
  const g = state.grid;
  const t = state.tuning.grid;
  const rules = medium === 'water' ? t.water : t.metal;
  // Passives on the player's charge (hero/effectsTerrain.ts): Conduit's reach, Stormglass's ice.
  const reach = src.waterReach ?? waterConduction(state, src.owner);
  const maxCells = medium === 'water' ? reach.maxCells : rules.maxCells;
  const maxDist = medium === 'water' ? reach.maxDistance : Infinity;
  const ice = iceConducts(state, src.owner);
  const id = g.nextChargeId;
  let head = 0;
  let tail = 0;
  for (const i of seeds) {
    if (tail >= maxCells) break;
    if (stamp[i] === CLAIMED || !conductsAs(g, i, medium, ice)) continue;
    stamp[i] = CLAIMED;
    dist[i] = 0;
    queue[tail++] = i;
  }
  if (tail === 0) return 0;
  g.nextChargeId++;
  const ticks = u8(gridTicks(chargeSeconds(state, src.owner, rules.chargeSeconds, src.durationMult)));
  const w = g.width;
  let nContacts = 0;
  const other: Medium = medium === 'water' ? 'metal' : 'water';
  while (head < tail) {
    const i = queue[head++]!;
    const d = dist[i]!;
    g.charge[i] = ticks;
    g.chargeId[i] = id;
    g.chargeFalloff[i] = medium === 'water' ? Math.max(t.water.minFalloff, 1 - d / maxDist) : 1;
    g.owner[i] = src.owner;
    markActive(g.active, i);
    const x = i % w;
    const y = (i - x) / w;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k]!;
      const ny = y + DY[k]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= g.height) continue;
      const j = ny * w + nx;
      if (stamp[j] === CLAIMED) continue;
      if (conductsAs(g, j, medium, ice)) {
        if (tail < maxCells && d + 1 <= maxDist) {
          stamp[j] = CLAIMED;
          dist[j] = d + 1;
          queue[tail++] = j;
        }
      } else if (conductsAs(g, j, other, ice)) contacts[nContacts++] = j;
    }
  }
  const ev: ChargeEvent = {
    id,
    chain,
    medium,
    damage: src.hitDamage * rules.damageMult,
    owner: src.owner,
    sourceId: src.sourceId,
    ticksLeft: ticks,
    cells: tail,
  };
  g.chargeEvents.push(ev);
  const o = queue[0]!;
  const ox = o % w;
  emit(state, {
    type: medium === 'water' ? 'waterElectrified' : 'metalElectrified',
    chargeId: id,
    x: ox + 0.5,
    y: (o - ox) / w + 0.5,
    cells: tail,
    owner: src.owner,
    sourceId: src.sourceId,
    handoff,
  });
  return dedupe(nContacts);
}

/** Drops contacts listed twice or already claimed (a contact can touch several charged cells). */
function dedupe(n: number): number {
  let k = 0;
  for (let c = 0; c < n; c++) {
    const j = contacts[c]!;
    if (stamp[j] !== 0) continue;
    stamp[j] = CONTACT;
    contacts[k++] = j;
  }
  return k;
}

/** Counts charge events down by one grid tick and drops the finished ones. */
export function tickChargeEvents(g: Grid): void {
  if (g.chargeEvents.length === 0) return;
  let w = 0;
  for (const ev of g.chargeEvents) if (--ev.ticksLeft > 0) g.chargeEvents[w++] = ev;
  g.chargeEvents.length = w;
}
