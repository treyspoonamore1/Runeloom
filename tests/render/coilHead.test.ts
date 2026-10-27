/**
 * Regression (pt8 playtest: "its head pretty much detached from the rest of its snake/eel body and
 * moved off of the screen"): the Glasswater Coil's drawn head (EnemyView's lift, which holds the
 * head sprite) stays on its sim body and on the drawn neck through a fight full of Lunges. The
 * rig pulled the head back through each Lunge windup with `lift.position.x -= …` every frame, and
 * nothing reset lift.position.x, so every windup moved the head ~18 art units × the facing's x (36
 * cells for a Lunge straight east or west) and it never came back. The sim head never left the arena (tests/sim covers its moves); this was render only.
 */
import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { Button, step } from '../../src/sim';
import { setupFenBossFight } from '../../src/sim/bots/fenBossBot';
import { EnemyView } from '../../src/render/enemyView';
import { BeastFx } from '../../src/render/bestiary/beastFx';
import type { Atlas } from '../../src/render/atlas';
import { loadAllRooms } from '../../tools/lib/rooms';

const atlas = { get: () => Texture.WHITE } as unknown as Atlas;

describe('Glasswater Coil drawn head', () => {
  it('stays on its sim body and its neck through repeated Lunges', () => {
    // A player on the stone past the west sluice's end, in Lunge reach, firing at it: its Lunges
    // come out of the channel heading west, the facing the drift ran along (lift.position.x).
    const { state, boss } = setupFenBossFight({
      rooms: loadAllRooms(),
      roomId: 'test/boss_coil',
      seed: 1,
      tide: 'none',
      start: { x: 10, y: 48 },
    });
    state.cheats.god = true;
    const view = new EnemyView('glasswater_coil', atlas);
    const fx = new BeastFx(atlas);
    view.bind(boss);
    const art = view.lift.parent!;
    let lunges = 0;
    let wasWinding = false;
    let worst = 0;
    for (let t = 0; t < 60 * 60 && !boss.dead; t++) {
      step(state, { moveX: 0, moveY: 0, aimX: boss.x, aimY: boss.y, buttons: Button.Cast1 });
      const winding = boss.attack.name === 'coil_lunge' && boss.attack.phase === 'windup';
      if (winding && !wasWinding) lunges++;
      wasWinding = winding;
      fx.update(1 / 60);
      view.update(state, boss.x, boss.y, 1 / 60, undefined, fx);
      // The head's center relative to the root (where the neck starts), in cells.
      const L = view.lift;
      const dx = (L.position.x - L.pivot.x) * art.scale.x;
      const dy = (L.position.y - L.pivot.y) * art.scale.y;
      worst = Math.max(worst, Math.hypot(dx, dy));
    }
    expect(lunges).toBeGreaterThanOrEqual(1);
    // The windup pull-back (0.6 art units × art scale 2) and the bob, never more.
    expect(worst).toBeLessThan(2);
  });
});
