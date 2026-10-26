import { Container, type GraphicsContext } from 'pixi.js';
import type { GameState } from '../../sim';
import type { WorldObject } from '../../sim/world/objects';
import type { Atlas } from '../atlas';
import { buildFlame } from '../ambientView';
import type { WorldFx } from './worldFx';
import { ShrineLook, shrineRune } from './shrineLook';
import { SealedSwitchLook, VaneLook } from './fenObjectLooks';
import {
  BlockLook,
  BrazierLook,
  ChestLook,
  DoorLook,
  HiddenLook,
  LoomStoneLook,
  PickupLook,
  PlateLook,
  SwitchLook,
  type Frame,
  type Look,
} from './objectLooks';

const WALL = 35; // '#'

export class ObjectView {
  readonly root = new Container();
  private readonly looks = new Map<string, Look>();
  private roomId = '';
  private flameCtx: GraphicsContext | null = null;
  private time = 0;

  constructor(
    private readonly atlas: Atlas,
    private readonly fx: WorldFx,
  ) {
    this.root.sortableChildren = true;
  }

  /** Tile centers (cells) of an object, for cues. */
  pos(key: string): { x: number; y: number } | null {
    const l = this.looks.get(key);
    return l ? { x: l.x, y: l.y } : null;
  }

  reset(): void {
    for (const l of this.looks.values()) l.root.destroy({ children: true });
    this.looks.clear();
    this.roomId = '';
  }

  update(s: GameState, dt: number): void {
    this.time += dt;
    if (s.room.id !== this.roomId) {
      this.reset();
      this.roomId = s.room.id;
    }
    const f: Frame = { t: this.time, dt, fx: this.fx, grid: s.grid };
    for (const o of s.objects) {
      let l = this.looks.get(o.key);
      if (!l) {
        l = this.make(s, o);
        this.looks.set(o.key, l);
        this.root.addChild(l.root);
      }
      l.update(o, f);
      // Lower tiles draw over higher ones.
      const z = Math.round(l.y * 4);
      if (l.root.zIndex !== z) l.root.zIndex = z;
    }
    if (this.looks.size > s.objects.length) {
      const keys = new Set(s.objects.map((o) => o.key));
      for (const [k, l] of this.looks)
        if (!keys.has(k)) {
          l.root.destroy({ children: true });
          this.looks.delete(k);
        }
    }
  }

  private make(s: GameState, o: WorldObject): Look {
    switch (o.kind) {
      case 'brazier':
        return new BrazierLook(this.atlas, o, (this.flameCtx ??= buildFlame()));
      case 'door':
      case 'locked_door':
      case 'big_key_door': {
        const r = s.room;
        const at = (x: number, y: number): number =>
          x < 0 || y < 0 || x >= r.tilesW || y >= r.tilesH ? WALL : r.tiles[y * r.tilesW + x]!;
        const side = at(o.tx - 1, o.ty) === WALL || at(o.tx + 1, o.ty) === WALL;
        const vertical = !side && (at(o.tx, o.ty - 1) === WALL || at(o.tx, o.ty + 1) === WALL);
        return new DoorLook(this.atlas, o, vertical);
      }
      case 'key_chest':
      case 'big_key_chest':
        return new ChestLook(this.atlas, o);
      case 'push_block':
      case 'ice_block':
        return new BlockLook(this.atlas, o);
      case 'conduit_switch':
        return new SwitchLook(this.atlas, o);
      case 'sealed_switch':
        return new SealedSwitchLook(this.atlas, o);
      case 'wind_vane':
        return new VaneLook(this.atlas, o);
      case 'pressure_plate':
        return new PlateLook(this.atlas, o);
      case 'heart_seed':
      case 'loom_shard':
        return new PickupLook(this.atlas, o);
      case 'loom_stone':
        return new LoomStoneLook(this.atlas, o);
      case 'rune_shrine':
        return new ShrineLook(this.atlas, o, shrineRune(s.room.id));
      default:
        // Hearth stations: the hub layer draws them.
        return new HiddenLook(this.atlas, o);
    }
  }
}

/** Tiles (ty·w + tx) whose objects this layer draws, from the objects' file tiles (`kind@tx,ty`). */
export function ownedTiles(objects: readonly WorldObject[], tilesW: number): Set<number> {
  const out = new Set<number>();
  for (const o of objects) {
    const m = /@(\d+),(\d+)$/.exec(o.key);
    const tx = m ? Number(m[1]) : o.tx;
    const ty = m ? Number(m[2]) : o.ty;
    out.add(ty * tilesW + tx);
  }
  return out;
}
