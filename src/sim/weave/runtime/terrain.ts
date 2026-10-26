/**
 * Spell terrain footprints (CONTENT §1.2, DESIGN §5.3; BUILD_PLAN M3 task 3): where each form
 * writes its elements' terrain effects through applyElement, owned by the player's team.
 *
 * - Bolt: a circle of the footprint radius (2 cells) where it ends: impact, wall, shield, expiry.
 * - Nova: the disc (ring radius × the footprint scale), painted as the ring expands: each tick
 *   Fire and Frost cover the newly reached band. Storm paints the whole disc once, when the ring
 *   completes, so one Nova is one charge chain (entities are hit once per charge event).
 * - Beam: the line it fired, from its origin to where it stopped, 1 cell wide (× Saturate).
 * - Lob: its burst circle where it lands. Strike: its arc. Swath: its strip.
 * - Orb: a circle of the trail radius under the orb when it appears and every trail interval.
 * - Sigil: nothing.
 * Elements apply in slot order (DESIGN §5.3). Saturate (footprint area) and Lingering (terrain
 * durations) come from SpellSpec.terrain. Storm's charge damage is the instance's Storm part
 * (stormDamage). Evicted instances paint nothing.
 */
import { OWNER } from '../../../../data/materials';
import { PLAYER_ID } from '../../actors/enemies';
import type { DamagePacket } from '../../combat/damage';
import { applyElement, type Footprint, type TerrainElement } from '../../grid/paint';
import type { GameState } from '../../state';
import type { SpellInstance } from './types';

/** Which elements of the spell a paint call applies. */
type Which = 'all' | 'storm' | 'not_storm';

/**
 * The packet's Storm damage before crit, resistance and Shock: base Storm × (1 + increased,
 * plus Storm's own increased) × Π (1 + more). What charged water and metal deal (rules 11, 12).
 */
export function stormDamage(packet: DamagePacket): number {
  const base = packet.base.storm;
  if (base === 0) return 0;
  let k = 1 + packet.increased + (packet.increasedByType?.storm ?? 0);
  for (const m of packet.more) k *= 1 + m;
  return base * k;
}

/** Applies the instance's elements (slot order) to `shape`. */
export function paintSpell(
  state: GameState,
  inst: SpellInstance,
  shape: Footprint,
  which: Which = 'all',
): void {
  const els = inst.spec.elements;
  if (els.length === 0) return;
  const durationMult = inst.spec.terrain.durationMult;
  // M8: forms with a direction wash blocks along it (rule 28) and aim their gusts with it; Nova,
  // Lob and Orb act away from their footprint's center.
  const f = inst.form;
  const directed = f === 'bolt' || f === 'beam' || f === 'strike' || f === 'swath';
  let storm = -1;
  for (const el of els) {
    const element = el.element as TerrainElement;
    if (which === 'storm' ? element !== 'storm' : which === 'not_storm' && element === 'storm') continue;
    if (element === 'storm' && storm < 0) storm = stormDamage(inst.packet);
    applyElement(state, {
      element,
      shape,
      owner: OWNER.player,
      sourceId: PLAYER_ID,
      hitDamage: element === 'storm' ? storm : 0,
      durationMult,
      spellId: inst.id,
      ...(directed ? { dirX: inst.dirX, dirY: inst.dirY } : {}),
    });
  }
}

/** Footprint scale of a 'hit_shape' footprint (Saturate's √ of its area mult), else 1. */
function scaleOf(inst: SpellInstance): number {
  const fp = inst.spec.terrain.footprint;
  return fp.kind === 'hit_shape' ? fp.scale : 1;
}

/** Paints the footprint of an instance that just ended (Bolt, Beam, Lob, Strike, Swath). */
export function paintOnEnd(state: GameState, inst: SpellInstance): void {
  const fp = inst.spec.terrain.footprint;
  const p = inst.spec.params;
  const k = scaleOf(inst);
  switch (p.form) {
    case 'bolt':
      if (fp.kind === 'impact')
        paintSpell(state, inst, { kind: 'circle', x: inst.x, y: inst.y, r: fp.radius });
      return;
    case 'beam':
      if (fp.kind === 'line')
        paintSpell(state, inst, {
          kind: 'line',
          x0: inst.fromX,
          y0: inst.fromY,
          x1: inst.x,
          y1: inst.y,
          width: fp.width,
        });
      return;
    case 'lob':
      if (fp.kind === 'hit_shape')
        paintSpell(state, inst, { kind: 'circle', x: inst.x, y: inst.y, r: p.burstRadius * k });
      return;
    case 'strike':
      if (fp.kind === 'hit_shape')
        paintSpell(state, inst, {
          kind: 'arc',
          x: inst.x,
          y: inst.y,
          dirX: inst.dirX,
          dirY: inst.dirY,
          r: p.reach * k,
          halfAngleCos: p.halfAngleCos,
        });
      return;
    case 'swath':
      if (fp.kind === 'hit_shape')
        paintSpell(state, inst, {
          kind: 'strip',
          x: inst.fromX,
          y: inst.fromY,
          dirX: inst.dirX,
          dirY: inst.dirY,
          length: p.length * k,
          width: p.width * k,
        });
      return;
    default:
      return;
  }
}

/**
 * Nova, once per tick after its ring grew: Fire and Frost on the band between the radius painted
 * so far and the ring's radius × footprint scale; on the last tick Storm on the whole disc.
 */
export function paintNova(state: GameState, n: SpellInstance, done: boolean): void {
  const p = n.spec.params;
  if (p.form !== 'nova' || n.spec.terrain.footprint.kind !== 'hit_shape') return;
  const r = n.radius * scaleOf(n);
  if (r > n.terrainR) {
    paintSpell(state, n, { kind: 'ring', x: n.cx, y: n.cy, r0: n.terrainR, r1: r }, 'not_storm');
    n.terrainR = r;
  }
  if (done) paintSpell(state, n, { kind: 'circle', x: n.cx, y: n.cy, r: p.radius * scaleOf(n) }, 'storm');
}

/** Orb, every tick: counts down its trail timer and paints under the orb when it runs out. */
export function paintOrb(state: GameState, o: SpellInstance, dt: number): void {
  const fp = o.spec.terrain.footprint;
  if (fp.kind !== 'trail') return;
  o.terrainLeft -= dt;
  if (o.terrainLeft > 1e-9) return;
  o.terrainLeft += fp.interval;
  paintSpell(state, o, { kind: 'circle', x: o.x, y: o.y, r: fp.radius });
}
