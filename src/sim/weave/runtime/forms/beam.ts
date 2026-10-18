/**
 * Beam (CONTENT §1.2): an instant line up to params.length, params.width wide, stopped by walls.
 * It hits the first target along it (1 + Pierce targets), Chains after its first hit, and is
 * stopped by a Shieldbearer's shield facing its origin. It ends the tick it fires, where it
 * stopped, so On Expire spawns from there.
 */
import { circleIntersectsLine } from '../../../combat/shapes';
import { isBlockedByShield } from '../../../combat/shield';
import { emit } from '../../../events';
import type { GameState } from '../../../state';
import { enemiesTouching, rayWallDistance } from '../geom';
import { canTarget, chainFrom, spellHit } from '../procs';
import { elementsOf, endSpell } from '../spawn';
import type { SpellEndReason, SpellInstance } from '../types';

export function fireBeam(state: GameState, b: SpellInstance): void {
  const p = b.spec.params;
  if (p.form !== 'beam') return;
  const ox = b.x;
  const oy = b.y;
  const dx = b.dirX;
  const dy = b.dirY;
  const len = rayWallDistance(state.room, ox, oy, dx, dy, p.length);
  const half = len / 2;
  const reach = Math.sqrt(half * half + (p.width / 2) * (p.width / 2));

  // Candidates along the line, sorted by distance along it (ties: array order).
  const hits: { idx: number; u: number }[] = [];
  for (const idx of enemiesTouching(state, ox + dx * half, oy + dy * half, reach)) {
    const e = state.enemies[idx]!;
    if (!canTarget(b, e)) continue;
    if (!circleIntersectsLine(e.x, e.y, e.radius, ox, oy, dx, dy, len, p.width)) continue;
    hits.push({ idx, u: (e.x - ox) * dx + (e.y - oy) * dy });
  }
  hits.sort((a, c) => a.u - c.u || a.idx - c.idx);

  let end = len;
  let reason: SpellEndReason = len < p.length ? 'wall' : 'done';
  let stoppedOn = -1;
  const hitList: { target: number; x: number; y: number }[] = [];
  const maxTargets = 1 + b.spec.pierce;
  for (const { idx, u } of hits) {
    const e = state.enemies[idx]!;
    if (!canTarget(b, e) || b.hitIds.includes(e.id)) continue;
    b.hitIds.push(e.id);
    const at = u < 0 ? 0 : u;
    if (isBlockedByShield(e, ox, oy)) {
      emit(state, { type: 'shieldBlock', id: e.id, projectileId: b.id, x: ox + dx * at, y: oy + dy * at });
      end = at;
      reason = 'blocked';
      stoppedOn = e.id;
      break;
    }
    hitList.push({ target: e.id, x: e.x, y: e.y });
    const first = b.hitCount === 0;
    spellHit(state, b, e, dx, dy, dx, dy);
    if (first) chainFrom(state, b, e);
    if (b.ended) break;
    if (hitList.length >= maxTargets) {
      end = at;
      reason = 'hit';
      stoppedOn = e.id;
      break;
    }
  }
  emit(state, {
    type: 'beamFire',
    id: b.id,
    castId: b.castId,
    elements: elementsOf(b.spec),
    fromX: ox,
    fromY: oy,
    toX: ox + dx * end,
    toY: oy + dy * end,
    width: p.width,
    hits: hitList,
  });
  b.x = ox + dx * end;
  b.y = oy + dy * end;
  endSpell(state, b, reason, stoppedOn);
}
