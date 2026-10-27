import { describe, expect, it } from 'vitest';
import { applyHit, makePacket, PLAYER_ID, type Enemy, type GameState, type SimEvent } from '../../../src/sim';
import { eye, put } from '../enemies/coilHelpers';
import { arena, fromFile, paintRect, place, spawn } from '../enemies/helpers';

/**
 * Playtest 8: a hit cut a lot by the target's state says why ('hit' event `reduced`), so the
 * damage numbers and hints can show it. Shelled (Bellshell 90%, Old Bellwether 80%, until rung
 * open) and the Glasswater Coil Submerged (75% / 90%). Resistances never count.
 */

const physical = (s: GameState) => makePacket(100, { physical: 1 }, 0, s.tuning.combat.critMultiplier);

function hitEvent(s: GameState, e: Enemy, packet = physical(s)): Extract<SimEvent, { type: 'hit' }> {
  s.events.length = 0;
  applyHit(s, e, packet, { sourceId: PLAYER_ID, dirX: 0, dirY: 0, knockback: 0 });
  return s.events.find((ev): ev is Extract<SimEvent, { type: 'hit' }> => ev.type === 'hit')!;
}

describe("reduced hits ('hit' reduced)", () => {
  it('a shelled Bellshell: shelled; rung open: no reason', () => {
    const s = arena(140, 40, 1);
    paintRect(s, 20, 30, 59, 49, 'shallow_water');
    const b = spawn(s, 'bellshell', 30, 40);
    expect(hitEvent(s, b).reduced).toBe('shelled');
    b.special.openLeft = 3;
    const open = hitEvent(s, b);
    expect(open.reduced).toBeUndefined();
    expect('reduced' in open).toBe(false);
  });

  it('the Old Bellwether shares it', () => {
    const s = fromFile('test/boss_bellwether');
    place(s, 52, 72);
    const b = s.enemies.find((e) => e.kind === 'bellwether')!;
    expect(hitEvent(s, b).reduced).toBe('shelled');
    b.special.openLeft = 2;
    expect(hitEvent(s, b).reduced).toBeUndefined();
  });

  it('the Glasswater Coil: submerged in deep water, none in the shallows', () => {
    const { s, c } = eye();
    put(s, c, 62, 46);
    expect(hitEvent(s, c).reduced).toBe('submerged');
    put(s, c, 62, 25); // the rim
    expect(hitEvent(s, c).reduced).toBeUndefined();
  });

  it('resistances alone are not a reason (the Coil resists 75% Storm in the shallows)', () => {
    const { s, c } = eye();
    put(s, c, 62, 25);
    expect(hitEvent(s, c, makePacket(100, { storm: 1 }, 0, 1.5)).reduced).toBeUndefined();
  });

  it('other enemies never carry it', () => {
    const s = arena(140, 40, 1);
    const t = spawn(s, 'tinderling', 30, 40);
    expect('reduced' in hitEvent(s, t)).toBe(false);
  });
});
