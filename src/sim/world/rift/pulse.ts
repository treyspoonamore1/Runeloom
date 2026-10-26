/**
 * Live Wires (CONTENT §10, M6): every metal pylon in a rift room pulses world-owned Storm charge
 * every pylonPulseSeconds, on the grid clock (the first pulse comes that long after entering).
 * M8: a room's `@pulse <seconds>` header does the same outside rifts (CONTENT §6.2).
 * A pulse electrifies the pylon's metal network and whatever water and metal it touches (rules
 * 12–13), and zaps every entity within data/rift.ts pylonPulse.radius of a pylon's center with
 * Storm damage scaled by the area level. World-owned: it hurts monsters as much as the player.
 */
import { MAT, OWNER } from '../../../../data/materials';
import { pylonPulse } from '../../../../data/rift';
import { GRID_HZ, TILE_CELLS } from '../../core/constants';
import { makePacket, scaleByLevel } from '../../combat/damage';
import { applyHit, directionOr } from '../../combat/hits';
import type { AilmentTarget } from '../../combat/ailments';
import { emit } from '../../events';
import { electrify } from '../../grid/charge';
import { gridTicks, WORLD_SOURCE_ID } from '../../grid/cells';
import type { GameState } from '../../state';
import { riftRules } from './rules';

const PYLON = 'M'.charCodeAt(0);

/** Seconds between pylon pulses here: Live Wires in a rift, else the room's `@pulse` (M8), else 0. */
export function pulseSeconds(state: GameState): number {
  const rift = riftRules(state).pylonPulseSeconds;
  return rift > 0 ? rift : (state.room.header.pulse ?? 0);
}

/** Pylon tile centers of the room, in cells. */
function pylonCenters(state: GameState): [number, number][] {
  const room = state.room;
  const pylons: [number, number][] = [];
  for (let ty = 0; ty < room.tilesH; ty++)
    for (let tx = 0; tx < room.tilesW; tx++)
      if (room.tiles[ty * room.tilesW + tx] === PYLON)
        pylons.push([(tx + 0.5) * TILE_CELLS, (ty + 0.5) * TILE_CELLS]);
  return pylons;
}

/**
 * Called after each grid tick: pulses every pylon when a Live Wires or `@pulse` interval ends.
 * tuning.world.pulseGlowSeconds before each pulse the pylons send 'pylonGlow' (the telegraph).
 */
export function stepPylonPulse(state: GameState): void {
  const seconds = pulseSeconds(state);
  if (seconds <= 0) return;
  const every = gridTicks(seconds);
  const glow = Math.min(every - 1, gridTicks(state.tuning.world.pulseGlowSeconds));
  if (glow > 0 && (state.grid.tick + glow) % every === 0)
    for (const [x, y] of pylonCenters(state))
      emit(state, { type: 'pylonGlow', x, y, seconds: glow / GRID_HZ });
  if (state.grid.tick % every !== 0) return;
  const room = state.room;
  const pylons = pylonCenters(state);
  if (pylons.length === 0) return;
  const damage = scaleByLevel(pylonPulse.damage, state.tuning.combat.enemyDamageGrowth, room.level);
  const g = state.grid;
  const metal: number[] = [];
  for (let i = 0; i < g.ground.length; i++) if (g.ground[i] === MAT.metal_pylon) metal.push(i);
  electrify(state, [], 0, metal, metal.length, {
    owner: OWNER.world,
    sourceId: WORLD_SOURCE_ID,
    hitDamage: damage,
    durationMult: 1,
  });
  // The pulse runs after dead enemies were compacted out of the list (step.ts); hits look up arc
  // targets through the spatial hash, so it must index the list as it is now.
  state.enemyHash.rebuild(state.enemies);
  const r = pylonPulse.radius;
  for (const [x, y] of pylons) {
    emit(state, { type: 'pylonPulse', x, y, radius: r });
    const p = state.player;
    if (!p.dead) zap(state, p, x, y, r + state.tuning.player.radius, damage);
    const n = state.enemies.length;
    for (let k = 0; k < n; k++) {
      const e = state.enemies[k]!;
      if (!e.dead) zap(state, e, x, y, r + e.radius, damage);
    }
  }
}

function zap(state: GameState, t: AilmentTarget, x: number, y: number, reach: number, damage: number): void {
  const dx = t.x - x;
  const dy = t.y - y;
  if (dx * dx + dy * dy > reach * reach) return;
  const [kx, ky] = directionOr(x, y, t.x, t.y, 0, 1);
  const packet = makePacket(damage, { storm: 1 }, 0, state.tuning.combat.critMultiplier);
  applyHit(state, t, packet, {
    sourceId: WORLD_SOURCE_ID,
    dirX: kx,
    dirY: ky,
    knockback: 0,
    owner: OWNER.world,
  });
}
