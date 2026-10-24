/** M7: the Hearth's dev console helpers. */
import { describe, expect, it } from 'vitest';
import { buildings } from '../../../data/hearth';
import {
  debugHearthLine,
  debugOffline,
  debugSetAsh,
  debugSetBuilding,
  debugSetEmbers,
  debugSetRiftTier,
} from '../../../src/sim/meta/debug';
import { hub } from './helpers';

describe('Hearth debug helpers', () => {
  it('set Embers (lighting the Hearth), Ash, building levels within their max, the rift tier, and run offline time', () => {
    const s = hub({ lit: false });
    expect(debugHearthLine(s)).toMatch(/not lit/);
    debugSetEmbers(s, 500);
    expect(s.hero.hearth.lit).toBe(true);
    expect(s.hero.hearth.embers).toBe(500);
    debugSetAsh(s, 7);
    expect(s.hero.hearth.ash).toBe(7);
    debugSetBuilding(s, 'kindling_pit', 999);
    expect(s.hero.hearth.buildings.kindling_pit).toBe(buildings.kindling_pit.maxLevel);
    debugSetRiftTier(s, 8);
    expect(s.hero.riftTier).toBe(8);
    const g = debugOffline(s, 20 * 3600);
    expect(g.scrap).toBeGreaterThan(0);
    expect(debugHearthLine(s)).toMatch(/Embers 500/);
  });
});
