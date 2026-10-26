import type { Sprite } from 'pixi.js';
import { guaranteedRunes, type WorldRoomId } from '../../../data/progression';
import { getRune } from '../../../data/runes';
import type { WorldObject } from '../../sim/world/objects';
import type { Atlas } from '../atlas';
import { rand } from '../ailmentBursts';
import { mixRgb } from '../ailmentPalette';
import { smoothstep } from '../mathx';
import { Look, type Frame } from './objectLooks';
import { glyphName } from './runeShapes';
import { OBJ as C, RUNE_GET as R, RUNE_LOOK } from './worldPalette';

const TAU = Math.PI * 2;

/** The rune a room's shrine holds: its first element rune, else its first guaranteed rune. */
export function shrineRune(roomId: string): string {
  const list = guaranteedRunes[roomId as WorldRoomId] ?? [];
  return list.find((r) => getRune(r)?.kind === 'element') ?? list[0] ?? 'frost';
}

/** Light and deep colors of a rune (element runes have their own). */
export function runeColors(rune: string): { light: number; deep: number } {
  return rune in RUNE_LOOK ? RUNE_LOOK[rune as keyof typeof RUNE_LOOK] : RUNE_LOOK.other;
}

/**
 * A rune shrine (`R`): a stone altar with the room's dungeon item floating over a lit socket under a
 * soft light pillar, motes rising. Once taken, the socket goes dark and the altar stands empty.
 */
export class ShrineLook extends Look {
  private readonly pillar: Sprite;
  private readonly glow: Sprite;
  private readonly socket: Sprite;
  private readonly tablet: Sprite;
  private readonly glyph: Sprite;
  private readonly light: number;

  constructor(atlas: Atlas, o: WorldObject, rune: string) {
    super(atlas, o);
    const c = runeColors(rune);
    this.light = c.light;
    this.pillar = this.add('glow', 0, -8);
    this.pillar.tint = c.light;
    this.pillar.blendMode = 'add';
    this.add('shrine_base');
    this.socket = this.add('shrine_socket');
    this.glow = this.add('glow', 0, -R.shrineHeight);
    this.glow.tint = c.light;
    this.glow.blendMode = 'add';
    this.tablet = this.add('rune_tablet', 0, -R.shrineHeight);
    this.tablet.tint = c.light;
    this.glyph = this.add(glyphName(rune), 0, -R.shrineHeight);
    this.glyph.tint = c.deep;
    this.tablet.scale.set(R.shrineTablet);
    this.glyph.scale.set(R.shrineTablet);
    this.root.scale.set(R.shrineScale);
  }

  protected override speed(): number {
    return 0.4;
  }

  protected pose(o: WorldObject, f: Frame): void {
    const full = 1 - smoothstep(0, 1, this.k);
    const pulse = 0.5 + 0.5 * Math.sin(f.t * 2.4);
    const bob = Math.sin(f.t * 1.7) * 0.18;
    // Taken: the tablet rises and fades as it leaves for the hero's hands.
    const y = -R.shrineHeight + bob - (1 - full) * 2.5;
    for (const s of [this.tablet, this.glyph]) {
      s.position.y = y;
      s.alpha = full;
      s.visible = full > 0.01;
    }
    this.tablet.rotation = this.glyph.rotation = Math.sin(f.t * 1.1) * 0.08;
    this.glow.position.y = y;
    this.glow.alpha = full * (0.55 + 0.25 * pulse);
    this.glow.scale.set(2.6 + 0.5 * pulse);
    this.socket.tint = mixRgb(C.stoneDark, this.light, full * (0.75 + 0.25 * pulse));
    this.pillar.alpha = full * R.pillarAlpha * (0.8 + 0.2 * pulse);
    this.pillar.scale.set(1.3, 6);
    if (!o.on && Math.random() < R.motes * f.dt) {
      const a = rand(0, TAU);
      const p = f.fx.one(
        f.fx.top,
        f.fx.t.dot,
        this.x + Math.cos(a) * 1.6,
        this.y - 1.2 + Math.sin(a) * 0.6,
        1.6,
        this.light,
        0.35,
        0.06,
      );
      if (p) {
        p.vy = -rand(2.5, 4);
        p.vx = -Math.cos(a) * 0.5;
      }
    }
  }
}
