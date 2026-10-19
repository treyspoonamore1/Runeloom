import { describe, expect, it } from 'vitest';
import { scaleByLevel } from '../../../src/sim';
import { enemies, type AttackDef, type EnemyDef } from '../../../data/enemies';
import { defaultTuning } from '../../../data/tuning';
import { minTelegraph } from '../../../data/monsterMods';

/** DESIGN §14: an enemy attack dealing ≥ 15% of the player's life has a telegraph of at least 0.4 s. */

const c = defaultTuning.combat;
const playerLife = (level: number) => c.playerBaseLife + c.playerLifePerLevel * (level - 1);

describe('telegraphs (DESIGN §14)', () => {
  for (const [kind, def] of Object.entries(enemies) as [string, EnemyDef][]) {
    const attacks = [def.attack, ...(def.extraAttacks ?? [])].filter((a): a is AttackDef => a !== null);
    for (const a of attacks) {
      it(`${kind} ${a.name}: big hits wind up at least 0.4 s at every area level 1–12`, () => {
        for (let L = 1; L <= 12; L++) {
          const dmg = def.isBoss ? a.damage : scaleByLevel(a.damage, c.enemyDamageGrowth, L);
          // Bosses are fought at their own level; the player is about that level there.
          const life = playerLife(def.isBoss ? (def.level ?? L) : L);
          if (dmg >= 0.15 * life) expect(a.windup).toBeGreaterThanOrEqual(minTelegraph);
        }
      });
    }
  }
});
