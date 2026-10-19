/**
 * Gallery exhibits that aren't enemies: puzzle objects (each state, plus ones that change on cue
 * so their one-shot effects show), loot drops, and the moments (level up, boss death, player death
 * and respawn, room transition). Writes only the gallery's own fake state.
 */
import type { Container } from 'pixi.js';
import { TILE_CELLS as T, type GameState, type SimEvent } from '../../sim';
import type { ObjectKind, WorldObject } from '../../sim/world/objects';
import type { Renderer } from '../../render/renderer';
import { label } from './galleryLabel';
import { sectionTile, type SectionId } from './galleryRoom';
import { lootSpecs, type LootExhibit } from './galleryLoot';
import { MomentDirector } from './galleryMoments';

interface ObjSpec {
  kind: ObjectKind;
  at: [number, number];
  label: string;
  on?: boolean;
  /** Flip `on` at this time (seconds after the section is shown). */
  flip?: number;
  /** Pushed or slid: moves to this tile from `flip`, at `speed` tiles/s. */
  to?: [number, number];
  speed?: number;
}

const OBJECTS: Partial<Record<SectionId, ObjSpec[]>> = {
  objects: [
    { kind: 'brazier', at: [1, 1], label: 'Brazier: unlit' },
    { kind: 'brazier', at: [4, 1], label: 'lit', on: true },
    { kind: 'brazier', at: [7, 1], label: 'lighting', flip: 1.95 },
    { kind: 'conduit_switch', at: [10, 1], label: 'Conduit switch: off' },
    { kind: 'conduit_switch', at: [13, 1], label: 'powered', on: true },
    { kind: 'conduit_switch', at: [16, 1], label: 'powering', flip: 2.0 },
    { kind: 'pressure_plate', at: [1, 4], label: 'Plate: up' },
    { kind: 'pressure_plate', at: [4, 4], label: 'pressed', on: true },
    { kind: 'pressure_plate', at: [7, 4], label: 'click', flip: 2.1 },
    { kind: 'push_block', at: [11, 4], label: 'Push block' },
    { kind: 'push_block', at: [14, 4], label: 'pushed', flip: 2.0, to: [17, 4], speed: 4 },
    { kind: 'door', at: [1, 8], label: 'Door: closed' },
    { kind: 'door', at: [4, 8], label: 'opening', flip: 2.0 },
    { kind: 'door', at: [7, 8], label: 'open', on: true },
    { kind: 'locked_door', at: [10, 8], label: 'Locked door' },
    { kind: 'locked_door', at: [13, 8], label: 'unlocking', flip: 2.05 },
    { kind: 'big_key_door', at: [16, 8], label: 'Big-key door' },
  ],
  objects2: [
    { kind: 'big_key_door', at: [1, 1], label: 'big-key: opening', flip: 2.0 },
    { kind: 'big_key_door', at: [4, 1], label: 'open', on: true },
    { kind: 'key_chest', at: [9, 1], label: 'Key chest' },
    { kind: 'key_chest', at: [12, 1], label: 'opening', flip: 2.0 },
    { kind: 'door', at: [17, 2], label: 'door in a N-S wall' },
    { kind: 'heart_seed', at: [1, 5], label: 'Heart Seed' },
    { kind: 'loom_shard', at: [4, 5], label: 'Loom Shard' },
    { kind: 'heart_seed', at: [7, 5], label: 'taken', flip: 2.0 },
    { kind: 'loom_shard', at: [10, 5], label: 'taken', flip: 2.0 },
    { kind: 'big_key_chest', at: [13, 5], label: 'Big-key chest' },
    { kind: 'big_key_chest', at: [16, 5], label: 'open', on: true },
    { kind: 'ice_block', at: [2, 9], label: 'Ice block sliding', flip: 1.9, to: [11, 9], speed: 10 },
  ],
  moments2: [
    { kind: 'loom_stone', at: [4, 5], label: 'Loom Stone: inactive' },
    { kind: 'loom_stone', at: [10, 5], label: 'activating', flip: 1.7 },
    { kind: 'loom_stone', at: [16, 5], label: 'active (respawn)', on: true },
  ],
};

interface Live {
  spec: ObjSpec;
  o: WorldObject;
  section: SectionId;
}

export class GalleryWorld {
  private readonly objs: Live[] = [];
  private readonly loot: LootExhibit[];
  private readonly moments: MomentDirector;
  private events: SimEvent[] = [];
  private section: SectionId = 'beasts';

  constructor(
    readonly state: GameState,
    readonly renderer: Renderer,
    readonly labels: Container,
  ) {
    for (const [id, specs] of Object.entries(OBJECTS) as Array<[SectionId, ObjSpec[]]>) {
      const base = sectionTile(id);
      for (const spec of specs) {
        const tx = base.tx + spec.at[0];
        const ty = base.ty + spec.at[1];
        const o: WorldObject = {
          key: `${spec.kind}@${tx},${ty}`,
          kind: spec.kind,
          tx,
          ty,
          on: spec.on ?? false,
          timer: 0,
          vx: 0,
          vy: 0,
          link: '',
        };
        state.objects.push(o);
        this.objs.push({ spec, o, section: id });
        labels.addChild(label(spec.label, (tx + 0.5) * T, (ty + 0.5) * T + 2.4));
      }
    }
    this.loot = lootSpecs(state, labels);
    this.moments = new MomentDirector(state, labels);
    // The objects own their tiles now: rebuild the room bake without them.
    renderer.setRoom(state);
  }

  show(id: SectionId): void {
    this.section = id;
    for (const l of this.objs) this.reset(l);
    for (const d of this.loot) d.reset();
    this.moments.show(id);
  }

  private reset(l: Live): void {
    const base = sectionTile(l.section);
    l.o.tx = base.tx + l.spec.at[0];
    l.o.ty = base.ty + l.spec.at[1];
    l.o.on = l.spec.on ?? false;
    l.o.vx = l.o.vy = 0;
  }

  update(t: number, dt: number): void {
    for (const l of this.objs) {
      const s = l.spec;
      if (s.flip === undefined || l.section !== this.section) continue;
      const flipped = t >= s.flip;
      if (!s.to) {
        l.o.on = flipped ? !(s.on ?? false) : (s.on ?? false);
        continue;
      }
      if (!flipped) continue;
      // A moving block: steps tile by tile at its speed, then stops.
      const base = sectionTile(l.section);
      const from = base.tx + s.at[0];
      const to = base.tx + s.to[0];
      const speed = s.speed ?? 4;
      const tiles = Math.min(Math.abs(to - from), Math.floor((t - s.flip) * speed) + 1);
      const dir = Math.sign(to - from);
      l.o.tx = from + dir * tiles;
      l.o.vx = l.o.tx !== to ? dir * speed : 0;
    }
    for (const d of this.loot) d.update(t, this.section);
    this.events.push(...this.moments.update(t, dt));
  }

  /** A room transition shortly after `t` (the fade from black). */
  roomFade(t: number): void {
    this.moments.roomFade(t, 0.05);
  }

  takeEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
