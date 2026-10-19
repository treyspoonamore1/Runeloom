/**
 * Data checks for the passive tree (data/passives.ts, data/passiveEdges.ts) and Fuse part
 * effects (data/fuseEffects.ts), for tools/validate.ts. Returns error strings.
 */
import { passiveEdges, passiveIds, passiveNodes, PASSIVE_START } from '../../data/passives';
import { EFFECT_KEYS, statInfo } from '../../data/passiveStats';
import { fuseEffects } from '../../data/fuseEffects';
import { parseWeave } from '../../src/sim';

export function passiveTreeErrors(): string[] {
  const errors: string[] = [];
  const at = (id: string) => `data/passives ${id}`;
  const effectKeys = new Set<string>(EFFECT_KEYS);
  const adj = new Map<string, string[]>(passiveIds.map((id) => [id, []]));
  for (const id of passiveIds) {
    const n = passiveNodes[id];
    if (n.id !== id) errors.push(`${at(id)}: id is "${n.id}"`);
    if (!/^[a-z]+(_[a-z0-9]+)*$/.test(id)) errors.push(`${at(id)}: id is not snake_case`);
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) errors.push(`${at(id)}: position is not finite`);
    if (n.text.length === 0) errors.push(`${at(id)}: no tooltip text`);
    for (const l of n.stats)
      if (!(l.stat in statInfo) || !Number.isFinite(l.value)) errors.push(`${at(id)}: bad stat ${l.stat}`);
    for (const k of Object.keys(n.effects))
      if (!effectKeys.has(k)) errors.push(`${at(id)}: unknown effect ${k}`);
  }
  const seen = new Set<string>();
  for (const [a, b] of passiveEdges) {
    if (!adj.has(a) || !adj.has(b)) {
      errors.push(`data/passiveEdges: edge ${a}–${b} names an unknown node`);
      continue;
    }
    const key = [a, b].sort().join('|');
    if (a === b || seen.has(key)) errors.push(`data/passiveEdges: edge ${a}–${b} is a loop or listed twice`);
    seen.add(key);
    adj.get(a)!.push(b);
    adj.get(b)!.push(a);
  }
  const reached = new Set<string>([PASSIVE_START]);
  const q = [PASSIVE_START as string];
  for (let k = 0; k < q.length; k++)
    for (const n of adj.get(q[k]!) ?? [])
      if (!reached.has(n)) {
        reached.add(n);
        q.push(n);
      }
  for (const id of passiveIds) if (!reached.has(id)) errors.push(`${at(id)}: not connected to the start`);
  return errors;
}

export function fuseEffectErrors(): string[] {
  const errors: string[] = [];
  const effectKeys = new Set<string>(EFFECT_KEYS);
  for (const [id, def] of Object.entries(fuseEffects)) {
    for (const k of Object.keys(def.effects))
      if (!effectKeys.has(k)) errors.push(`data/fuseEffects ${id}: unknown effect ${k}`);
    for (const w of def.extraWeaves)
      if (!parseWeave(w).ok) errors.push(`data/fuseEffects ${id}: extra weave "${w}" doesn't parse`);
  }
  return errors;
}
