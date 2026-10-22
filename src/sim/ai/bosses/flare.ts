/**
 * The Tar Matriarch's flare (CONTENT §5): she is a Tar Hulk elite, so fire on her while she is
 * Oiled lights the Hulk's fuse, but she lives through the blast.
 * - Ignited while Oiled, with her flare ready: the fuse lights ('matriarchFuse'; e.special.fuseLeft,
 *   the same field and look as a Hulk's fuse). Losing her Ignite (Wet) puts it out
 *   ('matriarchFuseOut').
 * - When the fuse runs out she flares ('matriarchFlare'): the Hulk's world-owned fire burst
 *   (actors/hulkBlast.ts fireBurst) hits the player and every other enemy within `radius`
 *   (her summoned Hulks too, which then explode if Oiled) and lights the ground, tar and oil
 *   around her; she takes `selfDamage` herself (Physical: no resistance, no Ignite).
 * - Then it can't light again for `cooldown` s (BossState.flareCooldown).
 * Dying with the fuse lit flares at once (actors/chemistry.ts deathTerrain), without the self damage.
 * Runs every tick, frozen or not (ai/passive.ts).
 */
import type { EnemyChemistry } from '../../../../data/enemies';
import { OWNER } from '../../../../data/materials';
import { bossDamageScale, riftBossScale, type Enemy } from '../../actors/enemies';
import { fireBurst } from '../../actors/hulkBlast';
import { isOiled } from '../../actors/terrainState';
import { isIgnited } from '../../combat/ailments';
import { makePacket } from '../../combat/damage';
import { applyHit } from '../../combat/hits';
import { DT } from '../../core/constants';
import { emit } from '../../events';
import { WORLD_SOURCE_ID } from '../../grid/cells';
import type { GameState } from '../../state';

type FlareDef = NonNullable<EnemyChemistry['flare']>;

const TIME_EPSILON = 1e-9;

export function stepFlare(state: GameState, e: Enemy, f: FlareDef): void {
  const b = e.boss;
  if (b === null) return;
  if (b.flareCooldown > 0) b.flareCooldown = b.flareCooldown > DT + TIME_EPSILON ? b.flareCooldown - DT : 0;
  const s = e.special;
  const ignited = isIgnited(e);
  if (s.fuseLeft > 0) {
    if (!ignited) {
      s.fuseLeft = 0;
      emit(state, { type: 'matriarchFuseOut', id: e.id, x: e.x, y: e.y });
      return;
    }
    s.fuseLeft -= DT;
    if (s.fuseLeft <= TIME_EPSILON) flare(state, e, f, true);
    return;
  }
  if (ignited && isOiled(e) && b.flareCooldown <= 0) {
    s.fuseLeft = f.fuse;
    emit(state, { type: 'matriarchFuse', id: e.id, fuse: f.fuse, radius: f.radius, x: e.x, y: e.y });
  }
}

/** Her self damage keeps its share of her life when a rift scales it. */
function lifeScale(state: GameState, e: Enemy): number {
  return riftBossScale(e.kind, e.areaLevel, state.tuning.combat.enemyLifeGrowth);
}

/** She flares now: the burst, then (`self`) her own damage; the flare cools down. */
export function flare(state: GameState, e: Enemy, f: FlareDef, self: boolean): void {
  e.special.fuseLeft = 0;
  if (e.boss !== null) e.boss.flareCooldown = f.cooldown;
  emit(state, {
    type: 'matriarchFlare',
    id: e.id,
    x: e.x,
    y: e.y,
    radius: f.radius,
    damage: f.damage * bossDamageScale(state, e),
    selfDamage: self ? f.selfDamage * lifeScale(state, e) : 0,
  });
  fireBurst(state, e, f.radius, f.damage * bossDamageScale(state, e));
  if (!self || e.dead) return;
  const packet = makePacket(
    f.selfDamage * lifeScale(state, e),
    { physical: 1 },
    0,
    state.tuning.combat.critMultiplier,
  );
  applyHit(state, e, packet, {
    sourceId: WORLD_SOURCE_ID,
    dirX: 0,
    dirY: 0,
    knockback: 0,
    owner: OWNER.world,
  });
}
