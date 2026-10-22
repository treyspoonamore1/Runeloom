/** M6: each rift modifier's runtime effect (CONTENT §10), one test per modifier. */
import { describe, expect, it } from 'vitest';
import { AIR, MAT, OWNER } from '../../../data/materials';
import type { RiftModId } from '../../../data/rift';
import {
  applyHit,
  enemyAttackPacket,
  enterRoom,
  rollKillLoot,
  spawnEnemy,
  step,
  NEUTRAL_INPUT,
  type GameState,
  type LootContent,
} from '../../../src/sim';
import { enemyDef } from '../../../data/enemies';
import { moveAlong } from '../../../src/sim/ai/common';
import { stepGrid } from '../../../src/sim/grid/tick';
import { WORLD_SOURCE_ID } from '../../../src/sim/grid/cells';
import { riftRules, rulesOf } from '../../../src/sim/world/rift/rules';
import { circle, hit, cellShape } from '../grid/helpers';
import { inlineRoom, run, T, teleport } from './worldHelpers';

/** A 16×10 test room under a rift id, so rift rules apply; `fill` is its floor tile. */
function roomText(fill = '.', extra = ''): string {
  const rows = ['################'];
  for (let y = 1; y < 9; y++) rows.push(`#${fill.repeat(14)}#`);
  rows.push('################');
  return `@id rift/9/test\n@name Test\n@level 10\n${extra}${rows.join('\n')}\n`;
}

/** A game in the test room with a rift of `mods` open (entered again so spawns see the rules). */
function inRift(mods: RiftModId[], text = roomText()): GameState {
  const s = inlineRoom(text);
  s.world.rift = {
    spec: { index: 9, seed: 1, tier: 5, mods, home: { roomId: 'rift/9/test', key: 'x' } },
    bossDead: false,
  };
  enterRoom(s, 'rift/9/test', { kind: 'default' });
  return s;
}

describe('rift rules', () => {
  it('sum the modifiers, and are neutral outside a rift room', () => {
    const r = rulesOf(['brutal', 'hardened', 'drought', 'tinderbox']);
    expect(r.monsterDamageMore).toBe(0.25);
    expect(r.monsterLifeMore).toBe(0.4);
    expect(r.fireSpreadMult).toBe(2);
    expect(r.monstersOiled).toBe(true);
    expect(r.quantity).toBeCloseTo(0.15);
    expect(r.rarity).toBeCloseTo(0.15 + 0.2 + 0.25);
    const s = inlineRoom(roomText().replace('rift/9/test', 'test/not_rift'));
    s.world.rift = inRift(['brutal']).world.rift;
    expect(riftRules(s).monsterDamageMore).toBe(0);
  });

  it('Hardened: monsters have 40% more life', () => {
    const a = spawnEnemy(inRift([]), 'shieldbearer', T(5), T(5));
    const b = spawnEnemy(inRift(['hardened']), 'shieldbearer', T(5), T(5));
    expect(b.maxLife).toBeCloseTo(a.maxLife * 1.4);
  });

  it('Resolute: monsters have +20% Fire, Frost and Storm resistance', () => {
    const e = spawnEnemy(inRift(['resolute']), 'shieldbearer', T(5), T(5));
    const base = enemyDef('shieldbearer').resist;
    expect(e.resist.fire).toBeCloseTo(base.fire + 0.2);
    expect(e.resist.frost).toBeCloseTo(base.frost + 0.2);
    expect(e.resist.storm).toBeCloseTo(base.storm + 0.2);
    expect(e.resist.physical).toBe(base.physical);
  });

  it('Hasty: monsters move 20% faster', () => {
    const e = spawnEnemy(inRift(['hasty']), 'shieldbearer', T(5), T(5));
    moveAlong(e, 1, 0, 1);
    expect(e.vx).toBeCloseTo(enemyDef('shieldbearer').speed * 1.2);
  });

  it('Teeming: packs and enemy lines have 40% more members', () => {
    const text = (n: number) => roomText('.', `@spawn 1 enemy:shieldbearer ${n}\n`).replace('#....', '#..1.');
    expect(inRift([], text(5)).enemies.length).toBe(5);
    expect(inRift(['teeming'], text(5)).enemies.length).toBe(7);
    const pack = roomText('.', '@spawn 1 pack:tinderling_swarm\n').replace('#....', '#..1.');
    expect(inRift(['teeming'], pack).enemies.length).toBeGreaterThan(inRift([], pack).enemies.length);
  });

  it("Brutal: monsters' hits on the player deal 25% more; world hazards don't", () => {
    const hitBy = (mods: RiftModId[], world: boolean) => {
      const s = inRift(mods);
      s.cheats.noAI = true;
      const e = spawnEnemy(s, 'shieldbearer', T(10), T(5));
      const packet = enemyAttackPacket(s, e, enemyDef('shieldbearer').attack!);
      const r = applyHit(s, s.player, packet, {
        sourceId: world ? WORLD_SOURCE_ID : e.id,
        dirX: 0,
        dirY: 0,
        knockback: 0,
        owner: world ? OWNER.world : undefined,
      });
      return r!.total;
    };
    expect(hitBy(['brutal'], false)).toBeCloseTo(hitBy([], false) * 1.25);
    expect(hitBy(['brutal'], true)).toBeCloseTo(hitBy([], true));
  });

  it('Drought: fire spreads twice as fast', () => {
    const burned = (mods: RiftModId[]) => {
      let total = 0;
      for (let seed = 0; seed < 6; seed++) {
        const s = inRift(mods, roomText('"'));
        s.gridRng = new (s.gridRng.constructor as new (n: number) => typeof s.gridRng)(seed + 1);
        hit(s, 'fire', cellShape(T(7), T(5)));
        for (let k = 0; k < 20; k++) stepGrid(s);
        total += s.grid.fire.reduce((n, f) => n + (f > 0 ? 1 : 0), 0);
      }
      return total;
    };
    expect(burned(['drought'])).toBeGreaterThan(burned([]) * 1.3);
  });

  it('Permafrost: ice lasts twice as long', () => {
    const timer = (mods: RiftModId[]) => {
      const s = inRift(mods, roomText('~'));
      const x = Math.floor(T(7));
      const y = Math.floor(T(5));
      hit(s, 'frost', cellShape(x, y));
      const i = y * s.grid.width + x;
      expect(s.grid.ground[i]).toBe(MAT.ice);
      return s.grid.timer[i]!;
    };
    const base = timer([]);
    const frozen = timer(['permafrost']);
    expect(frozen).toBeGreaterThan(base * 1.7);
  });

  it("Choking Smoke: smoke lasts twice as long and doesn't Blind monsters", () => {
    const smoke = (mods: RiftModId[]) => {
      const s = inRift(mods, roomText('"'));
      hit(s, 'fire', circle(T(7), T(5), 3));
      stepGrid(s);
      const i = Math.floor(T(5)) * s.grid.width + Math.floor(T(7));
      expect(s.grid.air[i]).toBe(AIR.smoke);
      return { s, t: s.grid.airTimer[i]! };
    };
    expect(smoke(['choking_smoke']).t).toBe(smoke([]).t * 2);
    for (const [mods, blind] of [
      [[], true],
      [['choking_smoke'], false],
    ] as const) {
      const { s } = smoke([...mods]);
      s.cheats.noAI = true;
      spawnEnemy(s, 'shieldbearer', T(7), T(5));
      step(s, NEUTRAL_INPUT);
      expect(s.enemies[0]!.terrain.blind).toBe(blind);
    }
  });

  it('Tinderbox: every monster is Oiled, the player is not', () => {
    const s = inRift(['tinderbox']);
    s.cheats.noAI = true;
    const e = spawnEnemy(s, 'shieldbearer', T(10), T(5));
    run(s, 2);
    expect(e.terrain.oiledLeft).toBeGreaterThan(0);
    expect(s.player.terrain.oiledLeft).toBe(0);
    const plain = inRift([]);
    const f = spawnEnemy(plain, 'shieldbearer', T(10), T(5));
    run(plain, 2);
    expect(f.terrain.oiledLeft).toBe(0);
  });

  it('Live Wires: every pylon pulses Storm every 4 s, hurting player and monsters near it', () => {
    const text = roomText().replace(
      '#..............#\n#..............#\n#..............#\n#....',
      '#..............#\n#..............#\n#..............#\n#..M.',
    );
    const s = inRift(['live_wires'], text);
    s.cheats.noAI = true;
    const e = spawnEnemy(s, 'shieldbearer', T(3), T(6));
    teleport(s, T(4), T(4));
    const life = s.player.life;
    const pulses: number[] = [];
    for (let k = 0; k < 60 * 4 + 6; k++) {
      step(s, NEUTRAL_INPUT);
      if (s.events.some((ev) => ev.type === 'pylonPulse')) pulses.push(s.tick);
    }
    expect(pulses.length).toBe(1);
    expect(s.player.life).toBeLessThan(life);
    expect(e.life).toBeLessThan(e.maxLife);
    const quiet = inRift([], text);
    teleport(quiet, T(4), T(4));
    const q = quiet.player.life;
    for (let k = 0; k < 60 * 5; k++) step(quiet, NEUTRAL_INPUT);
    expect(quiet.player.life).toBe(q);
  });
});

describe('rift loot', () => {
  const drops = (mods: RiftModId[], kills = 600) => {
    const s = inRift(mods);
    const out: LootContent[] = [];
    for (let i = 0; i < kills; i++) {
      const e = spawnEnemy(s, 'tinderling', T(10), T(5));
      out.push(...rollKillLoot(s, e));
      e.dead = true;
    }
    return out;
  };

  it('item quantity adds drops; Rift Sigils drop at the tier or one above', () => {
    const plain = drops([]);
    const more = drops(['teeming', 'brutal', 'hasty']);
    expect(more.length).toBeGreaterThan(plain.length * 1.2);
    const sigils = plain.filter((c) => c.kind === 'sigil');
    expect(sigils.length).toBeGreaterThan(0);
    for (const c of sigils) if (c.kind === 'sigil') expect([5, 6]).toContain(c.sigil.tier);
  });

  it('item rarity makes Magic and Rare gear more likely', () => {
    const share = (mods: RiftModId[]) => {
      const items = drops(mods, 3000).flatMap((c) => (c.kind === 'item' ? [c.item] : []));
      return items.filter((it) => it.rarity !== 'normal').length / items.length;
    };
    expect(share(['tinderbox', 'drought', 'live_wires', 'hardened'])).toBeGreaterThan(share([]));
  });
});
