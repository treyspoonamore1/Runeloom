/**
 * Room format additions the Fen rooms needed (CONTENT §6.1, §6.2, notes/m8-rooms-decisions.md):
 * a second linked door `d` with its own @link lines, puzzle objects counting for the nearest door
 * that watches their kind, notes keyed by an object's own character, and loot chests `$` that pay
 * data/progression.ts roomChests once.
 */
import { describe, expect, it } from 'vitest';
import { OWNER } from '../../../data/materials';
import { fenRooms, roomChests } from '../../../data/progression';
import { applyElement, onRoomCleared, PLAYER_ID, type GameState } from '../../../src/sim';
import { onBossDefeated } from '../../../src/sim/world/rift/rewards';
import { adventure, inlineRoom, run, T, teleport } from './worldHelpers';

function storm(s: GameState, tx: number, ty: number): void {
  applyElement(s, {
    element: 'storm',
    shape: { kind: 'circle', x: T(tx), y: T(ty), r: 1.5 },
    owner: OWNER.player,
    sourceId: PLAYER_ID,
    hitDamage: 10,
    durationMult: 1,
  });
}
const door = (s: GameState, ch: string) => s.objects.find((o) => o.kind === 'door' && o.link === ch)!;

describe('two linked doors, D and d', () => {
  const TWO = `@id t/two
@level 1
@link D switch:S
@link d switch:S
@note d The side door opens.
@note D The main door opens.
###########
#x........#
#.mQ...Qm.#
#.........#
##D#####d##
#.........#
###########
`;

  it("each door counts only the switch nearest to it; notes use the object's own character", () => {
    const s = inlineRoom(TWO);
    const sw = s.objects.filter((o) => o.kind === 'sealed_switch');
    expect(sw.map((o) => `${o.tx}:${o.link}`)).toEqual(['3:D', '7:d']);
    storm(s, 2, 2); // the metal beside the west switch
    run(s, 2);
    expect(door(s, 'D').on).toBe(true);
    expect(door(s, 'd').on).toBe(false);
    storm(s, 8, 2);
    const seen: string[] = [];
    for (let k = 0; k < 2; k++) {
      run(s, 1);
      for (const e of s.events) if (e.type === 'note') seen.push(e.text);
    }
    expect(door(s, 'd').on).toBe(true);
    expect(seen).toEqual(['The side door opens.']);
  });

  it('a room with one switch door keeps every switch on it (pre-M8 behaviour)', () => {
    const s = inlineRoom(TWO.replace('@link d switch:S\n', '').replace('d##', '###'));
    expect(s.objects.filter((o) => o.kind === 'sealed_switch').every((o) => o.link === 'D')).toBe(true);
    storm(s, 2, 2);
    run(s, 2);
    expect(door(s, 'D').on).toBe(false);
    storm(s, 8, 2);
    run(s, 2);
    expect(door(s, 'D').on).toBe(true);
  });

  it('different kinds pick their own door: G7 braziers open D, its wind vane d', () => {
    const s = adventure(fenRooms.g7);
    for (const o of s.objects.filter((o) => o.kind === 'brazier')) expect(o.link).toBe('D');
    expect(s.objects.find((o) => o.kind === 'wind_vane')!.link).toBe('d');
  });
});

describe('loot chests ($)', () => {
  it('the Windward Cache pays a Pattern Seed once, and stays open on re-entry', () => {
    expect(roomChests[fenRooms.g7]).toEqual([{ kind: 'pattern_seed' }]);
    const s = adventure(fenRooms.g7);
    s.cheats.noAI = true;
    // Open the vane door the way Gale would (the test is about the chest).
    for (const o of s.objects) if (o.kind === 'wind_vane') o.on = true;
    run(s, 2);
    const chest = s.objects.find((o) => o.kind === 'loot_chest')!;
    const seeds = s.hero.patternSeeds;
    teleport(s, T(chest.tx), (chest.ty + 1) * 4 + 1.6);
    run(s, 2);
    expect(chest.on).toBe(true);
    expect(s.hero.patternSeeds).toBe(seeds + 1);
    run(s, 30);
    expect(s.hero.patternSeeds).toBe(seeds + 1);
  });

  it('the F1 alcove chest pays a Fuse part and three currency', () => {
    const s = adventure(fenRooms.f1);
    s.cheats.noAI = true;
    const chest = s.objects.find((o) => o.kind === 'loot_chest')!;
    const parts = s.hero.parts.length;
    const coin = () => Object.values(s.hero.currency).reduce((a, b) => a + (b ?? 0), 0);
    const before = coin();
    teleport(s, T(chest.tx), (chest.ty + 1) * 4 + 1.6);
    run(s, 2);
    expect(chest.on).toBe(true);
    expect(s.hero.parts.length).toBe(parts + 1);
    expect(coin()).toBe(before + 3);
  });
});

describe('Fen reward hooks for the bosses work', () => {
  it("the Coil's first death drops a tier 9 sigil (the Warden's stays tier 1)", () => {
    const s = adventure(fenRooms.f10);
    const before = s.loot.length;
    onBossDefeated(s, 'glasswater_coil', T(15), T(11));
    const sigils = s.loot.slice(before).filter((d) => d.content.kind === 'sigil');
    expect(sigils.map((d) => (d.content.kind === 'sigil' ? d.content.sigil.tier : 0))).toEqual([9]);
  });

  it('F5 and F10 pay nothing on room clear: their bosses pay (world/fenBossRewards.ts), so nothing is paid twice', () => {
    const s = adventure(fenRooms.f10);
    onRoomCleared(s, fenRooms.f10, { x: T(15), y: T(11), source: 'boss' });
    onRoomCleared(s, fenRooms.f5);
    expect(
      s.hero.runes.filter((r) => ['gale', 'nova', 'on_hit', 'infuse'].includes(r.rune) && r.level === 10),
    ).toEqual([]);
  });
});
