/**
 * Rift views (M6), pure: the sigils the map screen offers at a Loom Stone and the open rift's
 * summary for the HUD and the map. Names and texts come from data/rift.ts and items/sigils.ts.
 */
import { riftGate } from '../../../data/riftGate';
import { riftAreaLevel, riftMods, type RiftModId } from '../../../data/rift';
import type { RiftSigil } from '../../sim/hero/types';
import { sigilBonus, sigilName } from '../../sim/items/sigils';
import type { WorldState } from '../../sim/world/worldState';

export interface ModLine {
  id: RiftModId;
  name: string;
  text: string;
  kind: 'prefix' | 'suffix';
}

export interface SigilView {
  uid: number;
  name: string;
  tier: number;
  areaLevel: number;
  mods: ModLine[];
  /** "+35% item quantity · +20% item rarity", or '' with no modifiers. */
  bonus: string;
  /** Null when it can be opened here now, else why not. */
  blocked: string | null;
  /** Tier 9+ before the Glasswater Coil: shown greyed with a lock badge (M8). */
  locked: boolean;
}

export function modLines(mods: readonly RiftModId[]): ModLine[] {
  return mods.map((id) => ({
    id,
    name: riftMods[id].name,
    text: riftMods[id].text,
    kind: riftMods[id].kind,
  }));
}

export function bonusLine(mods: readonly RiftModId[]): string {
  const b = sigilBonus(mods);
  const parts: string[] = [];
  if (b.quantity > 0) parts.push(`+${Math.round(b.quantity * 100)}% item quantity`);
  if (b.rarity > 0) parts.push(`+${Math.round(b.rarity * 100)}% item rarity`);
  return parts.join(' · ');
}

/**
 * The hero's sigils, lowest tier first. `standing`: at an activated Loom Stone; `riftOpen`: a
 * rift is open; `best`: hero.riftTier. The same rules as world/rift/run.ts openRiftError.
 */
export function sigilViews(
  sigils: readonly RiftSigil[],
  best: number,
  standing: boolean,
  riftOpen: boolean,
  /** The highest tier that opens before the next Rekindle (hero.hearth.rekindles); default: no cap. */
  cap = Infinity,
  /** The Glasswater Coil is dead (sim/meta/view.ts deepRiftsOpen); default: open. */
  deepOpen = true,
): SigilView[] {
  return [...sigils]
    .sort((a, b) => a.tier - b.tier || a.uid - b.uid)
    .map((g) => {
      const locked = !deepOpen && g.tier > riftGate.openTier;
      return {
        uid: g.uid,
        name: sigilName(g),
        tier: g.tier,
        areaLevel: riftAreaLevel(g.tier),
        mods: modLines(g.mods),
        bonus: bonusLine(g.mods),
        locked,
        blocked: riftOpen
          ? 'A rift is already open'
          : locked
            ? riftGate.lockedText
            : g.tier > cap
              ? `Rekindle to open tiers above ${cap}`
              : g.tier > best + 1
                ? `Complete a tier ${g.tier - 1} rift first`
                : !standing
                  ? 'Stand at a Loom Stone to open it'
                  : null,
      };
    });
}

export interface RiftSummary {
  tier: number;
  areaLevel: number;
  mods: ModLine[];
  bonus: string;
  /** Rooms of the rift (boss arena included) and how many are cleared. */
  rooms: number;
  cleared: number;
  bossDead: boolean;
}

/** The open rift as the HUD and map show it, or null. `roomIds`: every room id in state.rooms. */
export function riftSummary(world: WorldState, roomIds: readonly string[]): RiftSummary | null {
  const r = world.rift;
  if (!r) return null;
  const prefix = `rift/${r.spec.index}/`;
  const ids = roomIds.filter((id) => id.startsWith(prefix));
  return {
    tier: r.spec.tier,
    areaLevel: riftAreaLevel(r.spec.tier),
    mods: modLines(r.spec.mods),
    bonus: bonusLine(r.spec.mods),
    rooms: ids.length,
    cleared: ids.filter((id) => world.flags[id]?.cleared).length,
    bossDead: r.bossDead,
  };
}
