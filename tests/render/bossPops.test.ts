/**
 * Playtest 8 ("I think I was using frost to strand it, but I couldn't really tell"): one pop label
 * over the Coil when it enters Stranded, Iced or Overloaded; none for the states it moves through
 * on its own, none for a boss just seen, none for the Bellwether's ring (the shared ring effect
 * shows "RUNG!" over anything rung).
 */
import { describe, expect, it } from 'vitest';
import { roomTexts } from '../../src/app/rooms';
import { BossPopTracker } from '../../src/render/bossPops';
import { createAdventure, type Enemy, type GameState } from '../../src/sim';

function setup(roomId: string): { s: GameState; e: Enemy; pops: BossPopTracker } {
  const s = createAdventure({ seed: 1, rooms: roomTexts, startRoomId: roomId });
  return { s, e: s.enemies.find((x) => x.boss)!, pops: new BossPopTracker() };
}

const shown = (pops: BossPopTracker): string[] => pops.live.map((p) => p.label);

describe('boss pop labels', () => {
  it('pops STRANDED and ICED over the Coil, and nothing for surfacing or a boss just seen', () => {
    const { s, e, pops } = setup('test/boss_coil');
    const f = e.boss!.fen!;
    f.coil = 'stranded';
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual([]);
    f.coil = 'submerged';
    pops.update(s, 1 / 60);
    f.coil = 'surfaced';
    pops.update(s, 1 / 60);
    f.coil = 'exposed';
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual([]);
    f.coil = 'iced';
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual(['ICED']);
    // A new state replaces the boss's pop, which goes after popSeconds.
    f.coil = 'stranded';
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual(['STRANDED']);
    expect(pops.live[0]!.id).toBe(e.id);
    for (let i = 0; i < Math.ceil(s.tuning.bossReadout.popSeconds * 60) + 1; i++) pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual([]);
    f.coil = 'overloaded';
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual(['OVERLOADED']);
  });

  it('adds no pop for the Bellwether rolling or rung open', () => {
    const { s, e, pops } = setup('test/boss_bellwether');
    pops.update(s, 1 / 60);
    e.special.dashSpeed = 40;
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual([]);
    e.special.dashSpeed = 0;
    e.special.openLeft = 5;
    pops.update(s, 1 / 60);
    expect(shown(pops)).toEqual([]);
  });
});
