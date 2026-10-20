import { describe, expect, it } from 'vitest';
import { applyLoadoutSpec, Button, spawnEnemy, spillOil } from '../../../src/sim';
import { flareReady, flareShot, fuseBlastRadius, oilAtRisk } from '../../../src/sim/bots/kiterTar';
import { fromFile, idx, place, run } from '../enemies/helpers';

/** The kiter bot's Tar Matriarch tactics (bots/kiterTar.ts). */

function pit() {
  const s = fromFile('kiln/k5_matriarch_pit');
  s.cheats.noAI = true;
  s.cheats.god = true;
  applyLoadoutSpec(s, {
    spindleId: 'test_spindle',
    capacity: 99,
    notations: ['Cast > Bolt[Fire]', 'Cast > Strike[]'],
  });
  const m = s.enemies.find((e) => e.kind === 'tar_matriarch')!;
  return { s, m };
}

describe('kiter bot vs the Tar Matriarch', () => {
  it('reads lit fuses as blasts: a Tar Hulk 6 cells, her flare 6 cells, unlit 0', () => {
    const { s, m } = pit();
    const h = spawnEnemy(s, 'tar_hulk', 20, 20);
    expect(fuseBlastRadius(h)).toBe(0);
    h.special.fuseLeft = 1;
    m.special.fuseLeft = 1;
    expect(fuseBlastRadius(h)).toBe(6);
    expect(fuseBlastRadius(m)).toBe(6);
  });

  it('lights her with LMB from past the flare, off the oil, when she is Oiled and ready', () => {
    const { s, m } = pit();
    spillOil(s, m.x, m.y, 4, true);
    place(s, m.x - 20, m.y);
    run(s, 1);
    expect(flareReady(m)).toBe(true);
    const out = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, buttons: Button.Cast2 };
    expect(flareShot(s, out, m)).toBe(true);
    expect(out.buttons).toBe(Button.Cast1);
    expect([out.aimX, out.aimY]).toEqual([m.x, m.y]);
    // Too close (inside the flare's reach): no shot.
    place(s, m.x - 7, m.y);
    expect(flareShot(s, { ...out, buttons: 0 }, m)).toBe(false);
    // Cooling down: not ready.
    m.boss!.flareCooldown = 3;
    expect(flareReady(m)).toBe(false);
  });

  it('keeps off oil near fire in her fight', () => {
    const { s, m } = pit();
    spillOil(s, 20, 20, 3);
    const i = idx(s, 20, 20);
    expect(oilAtRisk(s, i, m)).toBe(false);
    m.special.fuseLeft = 1;
    expect(oilAtRisk(s, i, m)).toBe(true);
    expect(oilAtRisk(s, i, null)).toBe(false);
  });
});
