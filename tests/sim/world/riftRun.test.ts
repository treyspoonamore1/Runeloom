/** M6: opening a rift with a sigil, leaving it, dying in it, and saving inside it. */
import { describe, expect, it } from 'vitest';
import { applyHeroEdit } from '../../../src/sim/hero/edits';
import {
  createAdventure,
  killEnemy,
  killPlayer,
  loadSave,
  makeSave,
  parseSave,
  PLAYER_ID,
  type GameState,
  type InputFrame,
} from '../../../src/sim';
import { makeSigil } from '../../../src/sim/items/sigils';
import { isRiftRoomId } from '../../../src/sim/world/rift/types';
import { adventure, ROOMS, run, runUntil, T, teleport } from './worldHelpers';

const SOUTH: InputFrame = { moveX: 0, moveY: 1, aimX: 0, aimY: 0, buttons: 0 };
const NORTH: InputFrame = { moveX: 0, moveY: -1, aimX: 0, aimY: 0, buttons: 0 };

/** An adventure at test/world_a's Loom Stone (activated) holding a sigil of `tier`. */
function atStone(tier = 1): { s: GameState; uid: number } {
  const s = adventure('test/world_a');
  run(s, 1);
  const g = makeSigil(s.hero, tier, ['hardened']);
  s.hero.sigils.push(g);
  return { s, uid: g.uid };
}

function open(s: GameState, uid: number): void {
  expect(applyHeroEdit(s, { kind: 'openRift', uid })).toBeNull();
}

describe('opening a rift', () => {
  it('uses the sigil and puts the player at the center of the entry', () => {
    const { s, uid } = atStone();
    open(s, uid);
    expect(s.hero.sigils).toEqual([]);
    expect(s.room.id).toBe('rift/0/entry');
    expect([s.player.x, s.player.y]).toEqual([s.room.width / 2, s.room.height / 2]);
    expect(s.world.rift!.spec).toMatchObject({ index: 0, tier: 1, mods: ['hardened'] });
    expect(s.world.rift!.spec.home).toEqual({ roomId: 'test/world_a', key: 'loom_stone@3,2' });
    expect(s.world.respawn).toEqual({ roomId: 'test/world_a', key: 'loom_stone@3,2' });
    expect(Object.keys(s.rooms).filter(isRiftRoomId).length).toBeGreaterThanOrEqual(7);
    expect(s.world.riftCount).toBe(1);
  });

  it('is refused away from a Loom Stone, with a rift open, or above the tier ladder', () => {
    const { s, uid } = atStone(3);
    expect(applyHeroEdit(s, { kind: 'openRift', uid })).toMatch(/tier 2/);
    s.hero.riftTier = 2;
    teleport(s, T(8), T(5));
    expect(applyHeroEdit(s, { kind: 'openRift', uid })).toMatch(/Loom Stone/);
    teleport(s, T(3), T(2));
    open(s, uid);
    const g = makeSigil(s.hero, 1, []);
    s.hero.sigils.push(g);
    expect(applyHeroEdit(s, { kind: 'openRift', uid: g.uid })).toMatch(/already open/);
  });

  it('is deterministic: the same game opens the same rift', () => {
    const a = atStone();
    const b = atStone();
    open(a.s, a.uid);
    open(b.s, b.uid);
    expect(a.s.world.rift).toEqual(b.s.world.rift);
    expect(a.s.rooms).toEqual(b.s.rooms);
  });
});

describe('leaving a rift', () => {
  it("walking out of the entry's south exit goes home to the Loom Stone and closes it", () => {
    const { s, uid } = atStone();
    open(s, uid);
    teleport(s, s.room.width / 2, s.room.height - 6);
    const seen = runUntil(s, (st) => st.room.id === 'test/world_a', 300, SOUTH);
    expect(s.room.id).toBe('test/world_a');
    expect([s.player.x, s.player.y]).toEqual([T(3), T(2)]);
    expect(s.world.rift).toBeNull();
    expect(Object.keys(s.rooms).some(isRiftRoomId)).toBe(false);
    expect(Object.keys(s.world.flags).some(isRiftRoomId)).toBe(false);
    expect(seen).toContainEqual({ type: 'riftClosed', tier: 1, completed: false, reason: 'left' });
  });

  it('dying in a rift respawns at the Loom Stone and fails it', () => {
    const { s, uid } = atStone();
    open(s, uid);
    killPlayer(s);
    const seen = runUntil(s, (st) => st.room.id === 'test/world_a', 300);
    expect(s.world.rift).toBeNull();
    expect(seen).toContainEqual({ type: 'riftClosed', tier: 1, completed: false, reason: 'died' });
  });

  it("killing the boss opens the arena's door home and completes the rift", () => {
    const { s, uid } = atStone();
    open(s, uid);
    const bossId = 'rift/0/boss';
    // Walk in through the boss room's south socket.
    s.world.pending = { roomId: bossId, arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
    run(s, 1);
    expect(s.room.id).toBe(bossId);
    s.cheats.noAI = true;
    const boss = s.enemies.find((e) => e.kind === s.room.header.spawns[0]!.id)!;
    killEnemy(s, boss, PLAYER_ID, 'hit');
    run(s, 2);
    expect(s.world.rift!.bossDead).toBe(true);
    expect(s.world.bossesDefeated).toEqual([]);
    expect(s.world.flags[bossId]!.cleared).toBe(true);
    const door = s.objects.find((o) => o.kind === 'door')!;
    expect(door.on).toBe(true);
    teleport(s, s.room.width / 2, 6);
    const seen = runUntil(s, (st) => st.room.id === 'test/world_a', 300, NORTH);
    expect(s.room.id).toBe('test/world_a');
    expect(seen).toContainEqual({ type: 'riftClosed', tier: 1, completed: true, reason: 'completed' });
  });
});

describe('saves and rifts', () => {
  it('a save inside a rift loads in the same rift room', () => {
    const { s, uid } = atStone();
    open(s, uid);
    const saved = parseSave(JSON.stringify(makeSave(s)));
    const t = loadSave(saved, (init) => createAdventure({ ...init, rooms: ROOMS }));
    expect(t.room.id).toBe('rift/0/entry');
    expect(t.world.rift).toEqual(s.world.rift);
    expect(t.rooms['rift/0/entry']).toBe(s.rooms['rift/0/entry']);
  });

  it("a save in a rift's boss arena with the boss alive loads at the rift entry", () => {
    const { s, uid } = atStone();
    open(s, uid);
    s.world.pending = { roomId: 'rift/0/boss', arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
    run(s, 1);
    const t = loadSave(parseSave(JSON.stringify(makeSave(s))), (init) =>
      createAdventure({ ...init, rooms: ROOMS }),
    );
    expect(t.room.id).toBe('rift/0/entry');
  });

  it('sigils and the tier ladder round-trip; a pre-M6 save past the Warden gets a tier-1 sigil', () => {
    const { s } = atStone(2);
    s.hero.riftTier = 1;
    const back = parseSave(JSON.stringify(makeSave(s)));
    expect(back.hero.sigils).toEqual(s.hero.sigils);
    expect(back.hero.riftTier).toBe(1);
    const old = makeSave(s) as unknown as {
      hero: Record<string, unknown>;
      world: { bossesDefeated: string[] };
    };
    delete old.hero.sigils;
    delete old.hero.riftTier;
    old.world.bossesDefeated = ['tar_matriarch', 'cinder_warden'];
    const migrated = parseSave(JSON.stringify(old));
    expect(migrated.hero.sigils.map((g) => [g.tier, g.mods])).toEqual([[1, []]]);
  });
});

describe('rift bosses and rewards', () => {
  /** The test rift's boss arena, entered with the boss alive. */
  function inArena(tier: number): GameState {
    const { s, uid } = atStone(tier);
    s.hero.riftTier = tier - 1;
    open(s, uid);
    s.world.pending = { roomId: 'rift/0/boss', arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
    run(s, 1);
    s.cheats.noAI = true;
    return s;
  }
  const bossOf = (s: GameState) => s.enemies.find((e) => e.kind.startsWith('rift_'))!;

  it("fight at the rift's area level: life and damage grow with the tier", () => {
    const low = bossOf(inArena(1));
    const high = bossOf(inArena(16));
    expect(low.areaLevel).toBe(11);
    expect(high.areaLevel).toBe(30);
    expect(high.maxLife).toBeGreaterThan(low.maxLife * 5);
  });

  it('completing a rift raises the ladder and drops a next-tier sigil and currency', () => {
    const s = inArena(4);
    killEnemy(s, bossOf(s), PLAYER_ID, 'hit');
    const seen = runUntil(s, () => false, 2);
    expect(seen).toContainEqual({ type: 'riftCompleted', tier: 4, newBest: true });
    expect(s.hero.riftTier).toBe(4);
    const sigils = s.loot.filter((d) => d.content.kind === 'sigil');
    expect(sigils.map((d) => (d.content.kind === 'sigil' ? d.content.sigil.tier : 0))).toContain(5);
    expect(s.loot.filter((d) => d.content.kind === 'currency').length).toBeGreaterThanOrEqual(2);
  });

  it('a lower tier completed later leaves the ladder where it is', () => {
    const s = inArena(2);
    s.hero.riftTier = 6;
    killEnemy(s, bossOf(s), PLAYER_ID, 'hit');
    run(s, 2);
    expect(s.hero.riftTier).toBe(6);
  });

  it("the Cinder Warden's first death drops the first Rift Sigil", () => {
    const s = createAdventure({ seed: 1, rooms: ROOMS, startRoomId: 'kiln/k10_wardens_hearth' });
    s.cheats.noAI = true;
    const warden = s.enemies.find((e) => e.kind === 'cinder_warden')!;
    expect(warden.maxLife).toBe(5000);
    killEnemy(s, warden, PLAYER_ID, 'hit');
    run(s, 2);
    const sigils = s.loot.filter((d) => d.content.kind === 'sigil');
    expect(sigils.length).toBe(1);
    expect(sigils[0]!.content).toMatchObject({ kind: 'sigil', sigil: { tier: 1, mods: [] } });
  });
});
