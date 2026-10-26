import type { BeastFactory } from './beastRig';
import { BellwetherRig } from './bellwetherRig';
import { CoilRig } from './coilRig';
import type { FenBossKind } from './fenBossPalette';

/** Rigs of the Drowned Foundry's bosses (M8); their rift versions draw as these (lookAs). */
export const FEN_BOSS_RIGS: Readonly<Record<FenBossKind, BeastFactory>> = {
  bellwether: (a, r, l, b, f) => new BellwetherRig(a, r, l, b, f),
  glasswater_coil: (a, r, l, b, f) => new CoilRig(a, r, l, b, f),
};
