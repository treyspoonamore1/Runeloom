/**
 * Turns sim state changes and events into M4 cues (doors, chests, pickups, plates, blocks, loot,
 * level ups, room entries, boss moments) for render and audio. Presentation only: reads state,
 * never writes it. Each consumer (renderer, audio) owns one detector and feeds it the same frame
 * of events, so both see the same cues without sharing state.
 *
 * Which cues come from events and which from state diffs is set in m4Wiring.ts (M4_EVENTS).
 */
import { lookKind } from '../../data/enemies';
import { TILE_CELLS, type Enemy, type GameState, type SimEvent } from '../sim';
import type { ObjectKind, WorldObject } from '../sim/world/objects';
import type { LootContent } from '../sim/items/loot';
import {
  BOSS_KINDS,
  eventPos,
  HULK_FUSE,
  M4_EVENTS,
  M4_STATE,
  m4AttackKey,
  type M4AttackKey,
  type M4CueType,
} from './m4Wiring';

interface At {
  x: number;
  y: number;
}

export type M4Cue =
  | ({ type: 'roomEnter'; roomId: string } & At)
  | ({ type: 'levelUp'; level: number } & At)
  | ({ type: 'lootDropped' | 'lootPicked'; id: number; content: LootContent | null } & At)
  | ({
      type: 'doorOpened' | 'chestOpened' | 'pickup' | 'loomStoneActivated';
      kind: ObjectKind;
      key: string;
    } & At)
  | ({ type: 'plateClick'; key: string; pressed: boolean } & At)
  | ({ type: 'switchPowered'; key: string; on: boolean } & At)
  | ({ type: 'brazierLit'; key: string; lit: boolean } & At)
  | ({ type: 'blockMoved'; kind: ObjectKind; key: string; sliding: boolean; stopped: boolean } & At)
  | ({ type: 'bossPhase'; id: number; kind: string; phase: number } & At)
  | ({ type: 'bossAppear' | 'bossDeath'; id: number; kind: string } & At)
  | ({ type: 'superheatChanged'; id: number; on: boolean } & At)
  | ({ type: 'flood' } & At)
  | ({ type: 'kilnSpawn'; id: number } & At)
  | ({ type: 'hulkFuse'; id: number } & At)
  | ({ type: 'attackWindup' | 'attackLanded'; attack: M4AttackKey; id: number } & At)
  | ({ type: 'playerDeath' | 'playerRespawn' } & At);

/** Per-enemy derived looks the views read (render side). */
export interface EnemySignal {
  /** Seconds since the Tar Hulk's fuse was lit, or -1. */
  fuse: number;
  /** Superheated right now (Warden). */
  superheat: boolean;
  phase: number;
  /** Seconds since the kiln last spawned mites, or -1 before the first. */
  sinceSpawn: number;
}

interface ObjSnap {
  on: boolean;
  tx: number;
  ty: number;
  moving: boolean;
}

interface EnemyMemo extends EnemySignal {
  frozenAt: number;
}

const OBJECT_CUE: Partial<Record<ObjectKind, M4CueType>> = {
  door: 'doorOpened',
  locked_door: 'doorOpened',
  big_key_door: 'doorOpened',
  key_chest: 'chestOpened',
  big_key_chest: 'chestOpened',
  heart_seed: 'pickup',
  loom_shard: 'pickup',
  loom_stone: 'loomStoneActivated',
  pressure_plate: 'plateClick',
  conduit_switch: 'switchPowered',
  sealed_switch: 'switchPowered',
  brazier: 'brazierLit',
};

/** Superheat breaks for this long after a freeze (DESIGN §10.3). */
const SUPERHEAT_BREAK = 4;

function center(o: { tx: number; ty: number }): At {
  return { x: (o.tx + 0.5) * TILE_CELLS, y: (o.ty + 0.5) * TILE_CELLS };
}

export class M4Signals {
  private state: GameState | null = null;
  private roomId = '';
  private level = 0;
  private readonly objects = new Map<string, ObjSnap>();
  private readonly loot = new Map<number, { x: number; y: number; content: LootContent }>();
  private readonly memo = new Map<number, EnemyMemo>();
  private readonly seen = new Set<number>();
  private readonly out: M4Cue[] = [];

  /** Derived per-enemy looks (fuse, Superheat, phase, kiln timer), or undefined if never seen. */
  enemy(id: number): EnemySignal | undefined {
    return this.memo.get(id);
  }

  /** The cues for one frame: `events` are every sim event since the last call. */
  update(s: GameState, events: readonly SimEvent[], dt = 1 / 60): M4Cue[] {
    const out = this.out;
    out.length = 0;
    if (s !== this.state) {
      // A new session state (reset): take it as it is, without cues.
      this.state = s;
      this.roomId = s.room.id;
      this.level = s.hero.level;
      this.snapshot(s);
      this.memo.clear();
      this.seen.clear();
    }
    if (s.room.id !== this.roomId) {
      this.roomId = s.room.id;
      this.snapshot(s);
      this.memo.clear();
      this.seen.clear();
      if (M4_EVENTS.roomEnter === null)
        out.push({ type: 'roomEnter', roomId: s.room.id, x: s.player.x, y: s.player.y });
    }
    if (s.hero.level > this.level && M4_EVENTS.levelUp === null)
      out.push({ type: 'levelUp', level: s.hero.level, x: s.player.x, y: s.player.y });
    this.level = s.hero.level;
    this.diffObjects(s);
    this.diffLoot(s);
    this.enemies(s, dt);
    this.fromEvents(s, events);
    return out;
  }

  private snapshot(s: GameState): void {
    this.objects.clear();
    for (const o of s.objects) this.objects.set(o.key, snap(o));
    this.loot.clear();
    for (const d of s.loot) this.loot.set(d.id, { x: d.x, y: d.y, content: d.content });
  }

  private diffObjects(s: GameState): void {
    for (const o of s.objects) {
      const prev = this.objects.get(o.key);
      const now = snap(o);
      this.objects.set(o.key, now);
      if (!prev) continue;
      const at = center(o);
      if (prev.on !== now.on) {
        const type = OBJECT_CUE[o.kind];
        if (type && M4_EVENTS[type] === null) this.objectCue(type, o, now.on, at);
      }
      if ((o.kind === 'push_block' || o.kind === 'ice_block') && M4_EVENTS.blockMoved === null) {
        const moved = prev.tx !== now.tx || prev.ty !== now.ty;
        if ((now.moving && !prev.moving) || (moved && !now.moving && !prev.moving))
          this.out.push({
            type: 'blockMoved',
            kind: o.kind,
            key: o.key,
            sliding: o.kind === 'ice_block',
            stopped: false,
            ...at,
          });
        else if (prev.moving && !now.moving)
          this.out.push({
            type: 'blockMoved',
            kind: o.kind,
            key: o.key,
            sliding: o.kind === 'ice_block',
            stopped: true,
            ...at,
          });
      }
    }
  }

  private objectCue(type: M4CueType, o: WorldObject, on: boolean, at: At): void {
    const out = this.out;
    if (type === 'plateClick') out.push({ type, key: o.key, pressed: on, ...at });
    else if (type === 'switchPowered') out.push({ type, key: o.key, on, ...at });
    else if (type === 'brazierLit') out.push({ type, key: o.key, lit: on, ...at });
    else if (
      on &&
      (type === 'doorOpened' || type === 'chestOpened' || type === 'pickup' || type === 'loomStoneActivated')
    )
      out.push({ type, kind: o.kind, key: o.key, ...at });
  }

  private diffLoot(s: GameState): void {
    const live = new Set<number>();
    for (const d of s.loot) {
      live.add(d.id);
      if (!this.loot.has(d.id) && M4_EVENTS.lootDropped === null)
        this.out.push({ type: 'lootDropped', id: d.id, content: d.content, x: d.x, y: d.y });
      this.loot.set(d.id, { x: d.x, y: d.y, content: d.content });
    }
    for (const [id, d] of this.loot) {
      if (live.has(id)) continue;
      this.loot.delete(id);
      if (M4_EVENTS.lootPicked === null)
        this.out.push({ type: 'lootPicked', id, content: d.content, x: d.x, y: d.y });
    }
  }

  private enemies(s: GameState, dt: number): void {
    const t = s.tick / 60;
    for (const e of s.enemies) {
      if (e.dead) continue;
      let m = this.memo.get(e.id);
      const boss = BOSS_KINDS.has(e.kind);
      const look = lookKind(e.kind);
      if (!m) {
        m = { fuse: -1, superheat: false, phase: M4_STATE.bossPhase(e), sinceSpawn: -1, frozenAt: -99 };
        this.memo.set(e.id, m);
        if (boss && !this.seen.has(e.id)) {
          this.seen.add(e.id);
          this.out.push({ type: 'bossAppear', id: e.id, kind: look, x: e.x, y: e.y });
        }
      }
      if (m.sinceSpawn >= 0) m.sinceSpawn += dt;
      if (look === 'tar_hulk' || look === 'tar_matriarch') this.fuse(e, m, dt);
      if (!boss) continue;
      const phase = M4_STATE.bossPhase(e);
      if (phase > m.phase && M4_EVENTS.bossPhase === null)
        this.out.push({ type: 'bossPhase', id: e.id, kind: look, phase, x: e.x, y: e.y });
      m.phase = phase;
      const frozen = M4_STATE.frozen(e);
      if (frozen) m.frozenAt = t;
      const given = M4_STATE.superheated(e);
      const heat =
        given ?? (look === 'cinder_warden' && phase >= 2 && !frozen && t - m.frozenAt >= SUPERHEAT_BREAK);
      if (heat !== m.superheat && M4_EVENTS.superheatChanged === null)
        this.out.push({ type: 'superheatChanged', id: e.id, on: heat, x: e.x, y: e.y });
      m.superheat = heat;
    }
    if (this.memo.size > s.enemies.length * 2 + 64) {
      const live = new Set(s.enemies.map((e) => e.id));
      for (const id of this.memo.keys()) if (!live.has(id)) this.memo.delete(id);
    }
  }

  private fuse(e: Enemy, m: EnemyMemo, dt: number): void {
    const left = M4_STATE.fuseLeft(e);
    const was = m.fuse;
    if (left !== undefined) m.fuse = left > 0 ? HULK_FUSE.seconds - left : -1;
    else if (m.fuse >= 0) {
      m.fuse += dt;
      // Past its blast and no longer burning: a stale fuse (the sim let it live), so re-arm.
      if (m.fuse > HULK_FUSE.seconds + 0.5 && !M4_STATE.fuseCondition(e)) m.fuse = -1;
    } else if (M4_STATE.fuseCondition(e)) m.fuse = 0;
    if (was < 0 && m.fuse >= 0) this.out.push({ type: 'hulkFuse', id: e.id, x: e.x, y: e.y });
  }

  private fromEvents(s: GameState, events: readonly SimEvent[]): void {
    const out = this.out;
    const kilns = new Set<number>();
    const named = new Map<string, M4CueType>();
    for (const k of Object.keys(M4_EVENTS) as M4CueType[]) {
      const n = M4_EVENTS[k];
      if (n !== null) named.set(n, k);
    }
    for (const ev of events) {
      switch (ev.type) {
        case 'telegraph':
        case 'attack': {
          const key = m4AttackKey(ev.attack);
          if (!key) break;
          const e = s.enemies.find((en) => en.id === ev.id);
          const at =
            ev.type === 'attack'
              ? { x: ev.x, y: ev.y }
              : e
                ? { x: e.x, y: e.y }
                : { x: s.player.x, y: s.player.y };
          out.push({
            type: ev.type === 'attack' ? 'attackLanded' : 'attackWindup',
            attack: key,
            id: ev.id,
            ...at,
          });
          break;
        }
        case 'death':
          if (BOSS_KINDS.has(ev.kind))
            out.push({ type: 'bossDeath', id: ev.id, kind: lookKind(ev.kind), x: ev.x, y: ev.y });
          break;
        case 'playerDeath':
        case 'playerRespawn':
          out.push({ type: ev.type, x: ev.x, y: ev.y });
          break;
        case 'volatileArmed':
          // A Volatile monster's blast is a fuse like the Tar Hulk's: same sizzle and sparks.
          out.push({ type: 'hulkFuse', id: -1, x: ev.x, y: ev.y });
          break;
        case 'enemySpawn': {
          if (ev.kind !== 'kiln_mite' || M4_EVENTS.kilnSpawn !== null) break;
          // The kiln that spawned it: the nearest Brood Kiln within 8 cells.
          let best: Enemy | null = null;
          let bd = 64;
          for (const k of s.enemies) {
            if (k.kind !== ('brood_kiln' as string)) continue;
            const d = (k.x - ev.x) ** 2 + (k.y - ev.y) ** 2;
            if (d < bd) {
              bd = d;
              best = k;
            }
          }
          if (best && !kilns.has(best.id)) {
            kilns.add(best.id);
            const m = this.memo.get(best.id);
            if (m) m.sinceSpawn = 0;
            out.push({ type: 'kilnSpawn', id: best.id, x: best.x, y: best.y });
          }
          break;
        }
        default: {
          const cue = named.get(ev.type);
          if (cue) this.namedEvent(s, cue, ev as unknown as Record<string, unknown>);
        }
      }
    }
  }

  /** A cue the sim now sends as an event (M4_EVENTS names it). Reads the fields loosely. */
  private namedEvent(s: GameState, type: M4CueType, ev: Record<string, unknown>): void {
    const at = eventPos(s, ev);
    const num = (k: string, d: number): number => (typeof ev[k] === 'number' ? (ev[k] as number) : d);
    const key = typeof ev.key === 'string' ? ev.key : '';
    const kind = (s.objects.find((o) => o.key === key)?.kind ?? 'door') as ObjectKind;
    const out = this.out;
    switch (type) {
      case 'roomEnter':
        out.push({ type, roomId: s.room.id, ...at });
        break;
      case 'levelUp':
        out.push({ type, level: num('level', s.hero.level), x: s.player.x, y: s.player.y });
        break;
      case 'lootDropped':
      case 'lootPicked': {
        const id = num('id', -1);
        out.push({ type, id, content: s.loot.find((d) => d.id === id)?.content ?? null, ...at });
        break;
      }
      case 'doorOpened':
      case 'chestOpened':
      case 'pickup':
      case 'loomStoneActivated':
        out.push({ type, kind, key, ...at });
        break;
      case 'plateClick':
        out.push({ type, key, pressed: ev.pressed !== false, ...at });
        break;
      case 'switchPowered':
        out.push({ type, key, on: ev.on !== false, ...at });
        break;
      case 'brazierLit':
        out.push({ type, key, lit: ev.lit !== false, ...at });
        break;
      case 'blockMoved':
        out.push({ type, kind, key, sliding: kind === 'ice_block', stopped: ev.stopped === true, ...at });
        break;
      case 'bossPhase':
        out.push({
          type,
          id: num('id', -1),
          kind: lookKind(String(ev.kind ?? '')),
          phase: num('phase', 1),
          ...at,
        });
        break;
      case 'superheatChanged': {
        // enemyEvents.ts: `superheated`; the memo follows so the derived check doesn't repeat it.
        const on = ev.superheated !== undefined ? ev.superheated !== false : ev.on !== false;
        const m = this.memo.get(num('id', -1));
        if (m) m.superheat = on;
        out.push({ type, id: num('id', -1), on, ...at });
        break;
      }
      case 'flood': {
        // enemyEvents.ts: the flooded cells' bounds; the cue sits at their center.
        const b = ['minX', 'minY', 'maxX', 'maxY'].every((k) => typeof ev[k] === 'number');
        const pos = b
          ? { x: (num('minX', 0) + num('maxX', 0)) / 2, y: (num('minY', 0) + num('maxY', 0)) / 2 }
          : at;
        out.push({ type, ...pos });
        break;
      }
      case 'kilnSpawn': {
        const m = this.memo.get(num('id', -1));
        if (m) m.sinceSpawn = 0;
        out.push({ type, id: num('id', -1), ...at });
        break;
      }
    }
  }
}

function snap(o: WorldObject): ObjSnap {
  return { on: o.on, tx: o.tx, ty: o.ty, moving: o.vx !== 0 || o.vy !== 0 };
}
