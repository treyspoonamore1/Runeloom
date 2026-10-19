import type { M4Cue } from '../../app/m4Signals';
import { rand } from '../ailmentBursts';
import { ELEMENT, FX } from '../combatPalette';
import { PAL } from '../palette';
import type { WorldFx } from './worldFx';
import { OBJ as C } from './worldPalette';

/**
 * One-shot effects for puzzle-object cues: doors opening, chests, pickups, Loom Stones, plates,
 * switches, blocks and braziers. Render-only.
 */
export function objectCue(c: M4Cue, fx: WorldFx): void {
  const t = fx.t;
  switch (c.type) {
    case 'doorOpened': {
      fx.dust(c.x, c.y + 1.6, 3.6, 7);
      fx.burst(
        fx.top,
        t.chip,
        c.x,
        c.y + 0.5,
        5,
        [4, 9],
        [0.4, 0.7],
        [C.wood, C.woodDark],
        [0.45, 0.3],
        1.2,
        (p) => {
          p.spin = rand(-10, 10);
          p.grav = 18;
        },
      );
      if (c.kind === 'locked_door' || c.kind === 'big_key_door') {
        const big = c.kind === 'big_key_door';
        // The lock pops off and tumbles; the keyhole flashes gold.
        const lock = fx.one(
          fx.top,
          big ? t.lockBig : t.lockSmall,
          c.x,
          c.y + (big ? -0.4 : 0.95),
          0.7,
          0xffffff,
          1,
          0.8,
        );
        if (lock) {
          lock.vx = rand(-3, 3);
          lock.vy = -9;
          lock.grav = 30;
          lock.spin = rand(-8, 8);
          lock.hold = 0.6;
        }
        fx.one(fx.add, t.glow, c.x, c.y, 0.35, C.gold, 2, big ? 6 : 4, 0.8);
        fx.burst(
          fx.top,
          t.star,
          c.x,
          c.y,
          big ? 9 : 5,
          [3, 8],
          [0.3, 0.6],
          [C.gold, 0xffffff],
          [0.7, 0.1],
          0.6,
          (p) => (p.drag = 3),
        );
        if (big) fx.one(fx.top, t.ring, c.x, c.y, 0.45, C.gold, 1, 6, 0.9);
      }
      break;
    }
    case 'chestOpened': {
      const big = c.kind === 'big_key_chest';
      fx.one(fx.add, t.glow, c.x, c.y - 0.8, 0.5, C.gold, 1.5, big ? 7 : 5, 0.85);
      fx.one(fx.top, t.ring, c.x, c.y - 0.6, 0.4, C.gold, 1, big ? 6 : 4, 0.9);
      fx.burst(
        fx.top,
        t.star,
        c.x,
        c.y - 1,
        big ? 14 : 8,
        [4, 10],
        [0.4, 0.8],
        [C.gold, 0xffffff, 0xffe9a0],
        [0.8, 0.1],
        0.5,
        (p) => {
          p.vy -= 6;
          p.drag = 2;
        },
      );
      // A beam of light from the open lid.
      const beam = fx.one(fx.add, t.glow, c.x, c.y - 4, 0.8, C.gold, 1, 1, 0.5);
      if (beam) {
        beam.scaleX = beam.s0 = beam.s1 = 1.2;
        beam.aspect = 4;
      }
      break;
    }
    case 'pickup': {
      const heart = c.kind === 'heart_seed';
      const col = heart ? C.heart : C.shard;
      fx.one(fx.add, t.glow, c.x, c.y - 0.8, 0.5, col, 2, 6, 0.9);
      fx.one(fx.top, t.ring, c.x, c.y - 0.8, 0.45, col, 1, 5, 0.9);
      if (heart) {
        fx.burst(
          fx.top,
          t.heart,
          c.x,
          c.y - 0.8,
          6,
          [3, 7],
          [0.6, 0.9],
          [0xffffff],
          [0.45, 0.15],
          0.5,
          (p) => {
            p.vy -= 6;
            p.drag = 2;
            p.rotation = 0;
          },
        );
      } else {
        fx.spiral(c.x, c.y - 0.6, 14, 1.6, [C.thread, C.shardLight, C.shard], 6, 0.9);
      }
      fx.burst(
        fx.top,
        t.star,
        c.x,
        c.y - 0.8,
        6,
        [3, 8],
        [0.3, 0.6],
        [0xffffff, col],
        [0.7, 0.1],
        0.4,
        (p) => (p.drag = 3),
      );
      break;
    }
    case 'loomStoneActivated': {
      fx.one(fx.add, t.glow, c.x, c.y - 2, 0.9, C.loomRune, 3, 10, 0.9);
      for (let i = 0; i < 3; i++) {
        const r = fx.one(fx.ground, t.ring, c.x, c.y + 1.2, 0.8 + i * 0.25, C.loomRune, 1, 10 + i * 3, 0.9);
        if (r) r.aspect = 0.5;
      }
      fx.spiral(c.x, c.y, 24, 2.6, [C.loomRune, FX.thread, FX.threadBlue], 10, 1.3);
      fx.burst(
        fx.top,
        t.star,
        c.x,
        c.y - 2,
        10,
        [4, 10],
        [0.4, 0.8],
        [0xffffff, C.loomRune],
        [0.9, 0.1],
        1,
        (p) => (p.drag = 2),
      );
      break;
    }
    case 'plateClick':
      if (c.pressed) {
        fx.groundRing(c.x, c.y, 1.4, 3.2, 0.3, 0xd8c3a0, 0.8);
        fx.one(fx.top, t.star, c.x, c.y, 0.18, C.plateGlow, 1, 0.3, 0.9);
      } else fx.dust(c.x, c.y + 1, 2.5, 2);
      break;
    case 'switchPowered':
      if (c.on) {
        fx.one(fx.add, t.glow, c.x, c.y - 1.6, 0.4, ELEMENT.storm, 2, 5, 0.9);
        fx.one(fx.top, t.ring, c.x, c.y - 1.6, 0.3, ELEMENT.storm, 0.6, 4, 0.9);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const p = fx.one(
            fx.add,
            i % 2 ? t.zapA : t.zapB,
            c.x + Math.cos(a) * 1.5,
            c.y - 1.6 + Math.sin(a) * 1.5,
            0.15,
            ELEMENT.storm,
            1,
            0.6,
          );
          if (p) p.rotation = a;
        }
      } else
        fx.burst(
          fx.top,
          t.puff,
          c.x,
          c.y - 1.6,
          3,
          [1, 3],
          [0.4, 0.6],
          [0x8a8090],
          [0.4, 0.8],
          0.3,
          (p) => (p.a0 = 0.6),
        );
      break;
    case 'blockMoved':
      if (c.kind === 'ice_block') {
        fx.burst(
          fx.top,
          t.crystal,
          c.x,
          c.y + 1.6,
          c.stopped ? 8 : 5,
          [3, 8],
          [0.3, 0.5],
          [0xffffff, C.ice],
          [0.5, 0.2],
          1.4,
          (p) => (p.grav = 12),
        );
        if (c.stopped) fx.groundRing(c.x, c.y + 1, 2, 3.5, 0.3, C.ice, 0.7);
      } else {
        fx.dust(c.x, c.y + 1.8, 3.4, c.stopped ? 6 : 4);
        if (c.stopped) fx.groundRing(c.x, c.y + 1, 2.2, 3.8, 0.3, 0xd8c3a0, 0.7);
      }
      break;
    case 'brazierLit':
      if (c.lit) {
        fx.one(fx.add, t.glow, c.x, c.y - 0.5, 0.45, PAL.flameOuter, 2, 6, 0.9);
        fx.burst(
          fx.top,
          t.dot,
          c.x,
          c.y - 0.8,
          10,
          [4, 10],
          [0.4, 0.8],
          [PAL.flameOuter, PAL.flameInner, PAL.flameCore],
          [0.35, 0.06],
          0.5,
          (p) => {
            p.grav = -8;
            p.drag = 2;
          },
        );
        fx.one(fx.top, t.ring, c.x, c.y, 0.3, PAL.flameInner, 1, 4, 0.8);
      } else
        fx.burst(
          fx.top,
          t.puff,
          c.x,
          c.y - 0.6,
          4,
          [1, 3],
          [0.6, 0.9],
          [0x6a5a62],
          [0.4, 1.0],
          0.4,
          (p) => (p.grav = -4),
        );
      break;
    default:
  }
}
