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
  SAVE_VERSION,
  type GameState,
  type InputFrame,
} from '../../../src/sim';
import { makeSigil } from '../../../src/sim/items/sigils';
import { isRiftRoomId } from '../../../src/sim/world/rift/types';
import { rekindlesForTier } from '../../../src/sim/meta/view';
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
    s.hero.hearth.rekindles = rekindlesForTier(tier); // M7: past the Rekindle tier cap.
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

describe('rift room mend', () => {
  it('clearing a rift room restores tuning.rift.roomClearHeal of life and mana', () => {
    const { s, uid } = atStone();
    open(s, uid);
    s.world.pending = { roomId: 'rift/0/r1', arrival: { kind: 'edge', from: 'n' }, reason: 'exit' };
    run(s, 1);
    s.cheats.noAI = true;
    s.player.life = 10;
    s.player.mana = 0;
    // Dead without a kill (no XP, so no level-up heal).
    for (const e of s.enemies) e.dead = true;
    run(s, 1);
    expect(s.world.flags['rift/0/r1']!.cleared).toBe(true);
    expect(s.player.life).toBeCloseTo(Math.min(s.player.maxLife, 10 + s.player.maxLife * 0.3), 0);
    expect(s.player.mana).toBeGreaterThanOrEqual(s.player.maxMana * 0.3);
  });
});

describe('save version 2 (M6.5 affix tiers)', () => {
  it('a version 1 save moves stored affix tiers below the three new rift tiers', () => {
    const s = adventure('test/world_a');
    const old = makeSave(s) as unknown as {
      version: number;
      hero: { items: { affixes: { id: string; tier: number; value: number }[] }[] };
    };
    old.version = 1;
    old.hero.items[0]!.affixes = [
      { id: 'fire_damage', tier: 1, value: 20 },
      { id: 'capacity', tier: 1, value: 1 },
    ];
    const back = parseSave(JSON.stringify(old));
    expect(back.version).toBe(SAVE_VERSION);
    expect(back.hero.items[0]!.affixes).toEqual([
      { id: 'fire_damage', tier: 4, value: 20 },
      { id: 'capacity', tier: 1, value: 1 },
    ]);
  });
});

describe('free tier-1 sigil (M6.5)', () => {
  it('after the Warden, a hero with no sigils and no rift open can take one; otherwise not', () => {
    const s = adventure('test/world_a');
    run(s, 1);
    expect(applyHeroEdit(s, { kind: 'freeSigil' })).toMatch(/Warden/);
    s.world.bossesDefeated.push('cinder_warden');
    expect(applyHeroEdit(s, { kind: 'freeSigil' })).toBeNull();
    expect(s.hero.sigils.map((g) => [g.tier, g.mods])).toEqual([[1, []]]);
    expect(applyHeroEdit(s, { kind: 'freeSigil' })).toMatch(/still hold/);
    open(s, s.hero.sigils[0]!.uid);
    expect(applyHeroEdit(s, { kind: 'freeSigil' })).toMatch(/already open/);
  });
});
