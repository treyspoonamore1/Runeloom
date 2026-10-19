import { describe, expect, it } from 'vitest';
import { M4Signals } from '../../src/app/m4Signals';
import { createBossState, createGame, spawnEnemy, type GameState } from '../../src/sim';
import { HULK_FUSE } from '../../src/app/m4Wiring';
import type { WorldObject } from '../../src/sim/world/objects';
import type { EnemyKind } from '../../data/enemies';
import arenaText from '../../data/rooms/test/arena.txt?raw';

const game = (): GameState => createGame({ seed: 1, roomText: arenaText, spawnRoomEnemies: false });
const obj = (kind: WorldObject['kind'], tx: number, ty: number, on = false): WorldObject => ({
  key: `${kind}@${tx},${ty}`,
  kind,
  tx,
  ty,
  on,
  timer: 0,
  vx: 0,
  vy: 0,
  link: '',
  push: 0,
  pushDir: 0,
});

describe('M4Signals', () => {
  it('takes a new state silently, then reports object changes at tile centers', () => {
    const s = game();
    s.objects.push(obj('door', 3, 2), obj('pressure_plate', 5, 5), obj('heart_seed', 7, 1, false));
    const sig = new M4Signals();
    expect(sig.update(s, [])).toEqual([]);
    s.objects[0]!.on = true;
    s.objects[1]!.on = true;
    s.objects[2]!.on = true;
    const cues = sig.update(s, []);
    expect(cues.map((c) => c.type)).toEqual(['doorOpened', 'plateClick', 'pickup']);
    expect(cues[0]).toMatchObject({ kind: 'door', x: 14, y: 10 });
    expect(cues[1]).toMatchObject({ pressed: true });
    s.objects[1]!.on = false;
    expect(sig.update(s, [])).toMatchObject([{ type: 'plateClick', pressed: false }]);
    // A door closing again sends nothing.
    s.objects[0]!.on = false;
    expect(sig.update(s, [])).toEqual([]);
  });

  it('reports block pushes and stops', () => {
    const s = game();
    const b = obj('push_block', 4, 4);
    s.objects.push(b);
    const sig = new M4Signals();
    sig.update(s, []);
    b.tx = 5;
    b.vx = 4;
    expect(sig.update(s, [])).toMatchObject([{ type: 'blockMoved', stopped: false, sliding: false }]);
    b.tx = 6;
    expect(sig.update(s, [])).toEqual([]);
    b.vx = 0;
    expect(sig.update(s, [])).toMatchObject([{ type: 'blockMoved', stopped: true }]);
  });

  it('reports loot drops, pickups, level ups and room entries; a room change takes its loot silently', () => {
    const s = game();
    const sig = new M4Signals();
    sig.update(s, []);
    s.loot.push({ id: 9, x: 1, y: 2, age: 0, content: { kind: 'scrap', amount: 3 } });
    expect(sig.update(s, [])).toMatchObject([{ type: 'lootDropped', id: 9 }]);
    s.loot.length = 0;
    expect(sig.update(s, [])).toMatchObject([{ type: 'lootPicked', id: 9, x: 1, y: 2 }]);
    s.hero.level += 1;
    expect(sig.update(s, [])).toMatchObject([{ type: 'levelUp', level: 2 }]);
    s.room.id = 'test/elsewhere';
    s.loot.push({ id: 10, x: 1, y: 2, age: 0, content: { kind: 'scrap', amount: 3 } });
    expect(sig.update(s, []).map((c) => c.type)).toEqual(['roomEnter']);
  });

  it('times a Tar Hulk fuse from its special state, and follows the Warden phase and Superheat events', () => {
    const s = game();
    const hulk = spawnEnemy(s, 'dummy', 10, 10);
    hulk.kind = 'tar_hulk' as EnemyKind;
    const warden = spawnEnemy(s, 'dummy', 30, 10);
    warden.kind = 'cinder_warden' as EnemyKind;
    warden.boss = createBossState();
    const sig = new M4Signals();
    expect(sig.update(s, []).map((c) => c.type)).toEqual(['bossAppear']);
    hulk.special.fuseLeft = HULK_FUSE.seconds;
    expect(sig.update(s, [], 0.1).map((c) => c.type)).toEqual(['hulkFuse']);
    hulk.special.fuseLeft = HULK_FUSE.seconds - 0.5;
    sig.update(s, [], 0.5);
    expect(sig.enemy(hulk.id)!.fuse).toBeCloseTo(0.5);
    warden.boss.phase = 2;
    warden.boss.superheated = true;
    const at = { id: warden.id, x: warden.x, y: warden.y };
    const cues = sig.update(s, [
      { type: 'bossPhase', kind: 'cinder_warden', phase: 2, ...at },
      { type: 'superheatChanged', superheated: true, seconds: 0, ...at },
      { type: 'flood', id: warden.id, count: 4, minX: 10, minY: 20, maxX: 30, maxY: 40 },
    ]);
    expect(cues).toMatchObject([
      { type: 'bossPhase', phase: 2 },
      { type: 'superheatChanged', on: true },
      { type: 'flood', x: 20, y: 30 },
    ]);
    expect(sig.enemy(warden.id)).toMatchObject({ phase: 2, superheat: true });
    warden.boss.superheated = false;
    expect(
      sig.update(s, [{ type: 'superheatChanged', superheated: false, seconds: 4, ...at }]),
    ).toMatchObject([{ type: 'superheatChanged', on: false }]);
  });

  it('maps boss deaths, M4 attack events and kiln hatches', () => {
    const s = game();
    const kiln = spawnEnemy(s, 'dummy', 20, 20);
    kiln.kind = 'brood_kiln' as EnemyKind;
    const sig = new M4Signals();
    sig.update(s, []);
    const cues = sig.update(s, [
      {
        type: 'death',
        id: 50,
        kind: 'tar_matriarch',
        x: 1,
        y: 1,
        killerId: 0,
        cause: 'hit',
        shattered: false,
      },
      { type: 'telegraph', id: kiln.id, attack: 'lightning_strike', windup: 1 },
      { type: 'attack', id: kiln.id, attack: 'shield_bash', x: 0, y: 0 },
      { type: 'enemySpawn', id: 77, kind: 'kiln_mite', x: 21, y: 22 },
      { type: 'enemySpawn', id: 78, kind: 'kiln_mite', x: 19, y: 22 },
      { type: 'kilnSpawn', id: kiln.id, spawned: [77, 78], x: kiln.x, y: kiln.y },
    ]);
    expect(cues.map((c) => c.type)).toEqual(['bossDeath', 'attackWindup', 'kilnSpawn']);
    expect(sig.enemy(kiln.id)!.sinceSpawn).toBe(0);
  });
});
