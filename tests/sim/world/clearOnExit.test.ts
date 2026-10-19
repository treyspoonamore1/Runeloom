import { describe, expect, it } from 'vitest';
import { createAdventure, enterRoom, processTransition, roomFlags, type GameState } from '../../../src/sim';
import { parseRoom, RoomParseError } from '../../../src/sim/world/room';
import { loadAllRooms } from '../../../tools/lib/rooms';

const E2 = 'emberwood/e2_thicket';
const E3 = 'emberwood/e3_riverbend';
const E4 = 'emberwood/e4_old_mill';

/** In E3 having walked in from E2, its enemies alive. */
function inRiverbend(): GameState {
  const s = createAdventure({ seed: 1, rooms: loadAllRooms() });
  enterRoom(s, E3, { kind: 'edge', from: 'e' });
  expect(s.enemies.length).toBeGreaterThan(0);
  return s;
}

function leave(s: GameState, roomId: string, from: 'w' | 'e' | 'n' | 's'): void {
  s.world.pending = { roomId, arrival: { kind: 'edge', from } };
  processTransition(s);
}

describe('@clear exit (E3: a burnt bridge strands part of the pack)', () => {
  it('parses the edge and rejects anything else', () => {
    expect(parseRoom('@id t/a\n@clear exit s\n#').header.clearOnExit).toBe('s');
    expect(parseRoom('@id t/a\n#').header.clearOnExit).toBeNull();
    expect(() => parseRoom('@id t/a\n@clear exit\n#')).toThrow(RoomParseError);
    expect(() => parseRoom('@id t/a\n@clear exit x\n#')).toThrow(RoomParseError);
  });

  it('leaving back west pays nothing', () => {
    const s = inRiverbend();
    leave(s, E2, 'w');
    expect(roomFlags(s.world, E3).rewardsPaid).toBe(false);
    expect(s.hero.unlockedRunes).not.toContain('lob');
  });

  it('leaving south with enemies alive pays Lob and On Expire once, without clearing the room', () => {
    const s = inRiverbend();
    leave(s, E4, 's');
    const f = roomFlags(s.world, E3);
    expect(f.rewardsPaid).toBe(true);
    expect(f.cleared).toBe(false);
    expect(s.hero.unlockedRunes).toContain('lob');
    expect(s.hero.unlockedRunes).toContain('on_expire');
    const lobs = s.hero.runes.filter((r) => r.rune === 'lob').length;
    enterRoom(s, E3, { kind: 'edge', from: 'n' });
    leave(s, E4, 's');
    expect(s.hero.runes.filter((r) => r.rune === 'lob').length).toBe(lobs);
  });
});
