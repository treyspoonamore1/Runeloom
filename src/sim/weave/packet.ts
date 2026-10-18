/** Bridges a SpellSpec to the combat damage formula (src/sim/combat/damage.ts). */
import { makePacket, type DamagePacket } from '../combat/damage';
import type { SpellSpec } from './program';

/**
 * The spec's hit packet: base damage × shares, its rune `increased`, and its `more` list as
 * fractions. `extraMore` adds per-hit factors the runtime knows (Echo repeat 0.8, chain jumps).
 * The runtime adds character "increased" to `packet.increased` before resolving.
 */
export function specPacket(spec: SpellSpec, extraMore: readonly number[] = []): DamagePacket {
  const packet = makePacket(spec.baseDamage, spec.shares, spec.critChance, spec.critMultiplier);
  const more: number[] = spec.more.map((m) => m.mult - 1);
  for (const m of extraMore) more.push(m - 1);
  return { ...packet, increased: spec.increased, more };
}
