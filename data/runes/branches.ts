/**
 * Branch runes (CONTENT §1.5): cast another spell from this one. Cost is `cx` at depth 1, +1 per
 * depth level beyond it (DESIGN §5.4, `weaveLimits.branchCxPerDepth`).
 */
import type { BranchDef, BranchId } from './types';

export const branches = {
  on_hit: {
    id: 'on_hit',
    kind: 'branch',
    name: 'On Hit',
    notation: 'OnHit',
    cx: 2,
    description:
      'Casts the next spell from the enemy hit, once per instance (3 times with Pierce or Chain). 35% less damage.',
    ships: 'M2',
    parents: ['bolt', 'beam', 'lob', 'strike', 'orb', 'nova'],
    damageMult: 0.65,
    origin: 'hit_target',
    aim: 'parent_direction',
    proc: { kind: 'on_hit', maxProcs: 1, maxProcsWithPierceOrChain: 3, areaFirstTargetOnly: true },
  },
  on_expire: {
    id: 'on_expire',
    kind: 'branch',
    name: 'On Expire',
    notation: 'OnExpire',
    cx: 2,
    description:
      'Casts the next spell where this one ends: out of time, stopped on an enemy, or into a wall.',
    ships: 'M2',
    parents: ['bolt', 'beam', 'lob', 'nova', 'orb', 'swath', 'sigil'],
    damageMult: 1,
    origin: 'end_point',
    aim: 'last_direction',
    proc: { kind: 'on_expire', maxProcs: 1 },
  },
  on_kill: {
    id: 'on_kill',
    kind: 'branch',
    name: 'On Kill',
    notation: 'OnKill',
    cx: 2,
    description: 'Casts the next spell from each enemy this one kills, aimed away from you.',
    ships: 'M2',
    parents: 'damaging',
    damageMult: 1,
    origin: 'killed_target',
    aim: 'away_from_caster',
    proc: { kind: 'on_kill' },
  },
  emit: {
    id: 'emit',
    kind: 'branch',
    name: 'Emit',
    notation: 'Emit',
    cx: 2,
    description:
      'Every 0.5 s while this spell lives, casts the next spell at the nearest enemy within 30 cells. 50% less damage.',
    ships: 'M2',
    parents: ['orb', 'sigil'],
    damageMult: 0.5,
    origin: 'instance',
    aim: 'nearest_enemy',
    proc: { kind: 'emit', interval: 0.5, aimRange: 30 },
  },
} satisfies Record<BranchId, BranchDef>;
