/**
 * The rift generator (DESIGN §10.4, M6): a seeded layout of 6–10 rooms on a grid plus a boss room,
 * each room a room-chunk template (data/rooms/rift/) whose sockets (an exit on every edge) are
 * joined to its neighbors' or walled off. Pure and deterministic per RiftSpec: the same spec and
 * templates always give the same room texts, so a save keeps only the spec.
 *
 * Layout: the entry sits at (0, 0) with its south socket leading home. Rooms are added one at a
 * time next to an existing one (the last one added with riftLayout.chainChance, else any),
 * forming a tree. The boss arena goes north of the deepest room with a free north cell; its
 * north exit leads home behind a door that opens when the boss dies.
 *
 * Room ids: `rift/<index>/entry`, `rift/<index>/r<k>`, `rift/<index>/boss`.
 */
import {
  riftAreaLevel,
  riftBosses,
  riftChunks,
  riftEntryChunk,
  riftLayout,
  riftRarity,
  riftSpawns,
  type RiftSpawn,
} from '../../../../data/rift';
import { hashString } from '../../core/hash';
import { Rng } from '../../core/rng';
import { EXIT_CHAR, OPPOSITE } from '../exits';
import { parseRoom } from '../room';
import type { Edge, RoomSource } from '../worldState';
import { applyRiftTerrain } from './terrain';
import { riftRoomPrefix, type RiftSpec } from './types';

export interface RiftRoomPlan {
  id: string;
  /** Template id under data/rooms (rift/chunks/<x> or rift/bosses/<x>). */
  template: string;
  gx: number;
  gy: number;
  depth: number;
  /** Room id behind each used socket. */
  exits: Partial<Record<Edge, string>>;
}

export interface GeneratedRift {
  spec: RiftSpec;
  entryId: string;
  bossId: string;
  bossKind: string;
  /** Entry first, then rooms in the order they were added, then the boss room. */
  plan: RiftRoomPlan[];
  /** Room texts by id. */
  rooms: Record<string, string>;
}

const DIRS: readonly { edge: Edge; dx: number; dy: number }[] = [
  { edge: 'n', dx: 0, dy: -1 },
  { edge: 'e', dx: 1, dy: 0 },
  { edge: 's', dx: 0, dy: 1 },
  { edge: 'w', dx: -1, dy: 0 },
];

export { isRiftRoomId, riftRoomPrefix } from './types';

/** Builds the rift a spec describes from the templates in `templates`. */
export function generateRift(spec: RiftSpec, templates: RoomSource): GeneratedRift {
  const rng = new Rng((spec.seed ^ hashString('rift')) >>> 0);
  const prefix = riftRoomPrefix(spec.index);
  const plan = layout(rng, prefix);
  const boss = riftBosses[rng.int(riftBosses.length)]!;
  attachBoss(plan, prefix, boss.arena);
  assignChunks(plan, rng);
  const rooms: Record<string, string> = {};
  for (const room of plan) {
    const text = templates[room.template];
    if (text === undefined) throw new Error(`generateRift: no template "${room.template}"`);
    const roomRng = new Rng((spec.seed ^ hashString(room.id)) >>> 0);
    rooms[room.id] = roomText(spec, room, text, roomRng, room.id === `${prefix}boss` ? boss.boss : null);
  }
  return { spec, entryId: `${prefix}entry`, bossId: `${prefix}boss`, bossKind: boss.boss, plan, rooms };
}

const key = (x: number, y: number) => `${x},${y}`;

function layout(rng: Rng, prefix: string): RiftRoomPlan[] {
  const n = riftLayout.minRooms + rng.int(riftLayout.maxRooms - riftLayout.minRooms + 1);
  const plan: RiftRoomPlan[] = [{ id: `${prefix}entry`, template: '', gx: 0, gy: 0, depth: 0, exits: {} }];
  // The entry's south socket leads home: nothing may sit there.
  const taken = new Set<string>([key(0, 0), key(0, 1)]);
  while (plan.length < n) {
    const order = plan.map((_, i) => i);
    const first = rng.chance(riftLayout.chainChance) ? plan.length - 1 : rng.int(plan.length);
    order.splice(order.indexOf(first), 1);
    order.unshift(first);
    let added = false;
    for (const from of order) {
      const p = plan[from]!;
      const dirs = shuffled(rng, DIRS);
      for (const d of dirs) {
        const x = p.gx + d.dx;
        const y = p.gy + d.dy;
        if (taken.has(key(x, y))) continue;
        const id = `${prefix}r${plan.length}`;
        taken.add(key(x, y));
        p.exits[d.edge] = id;
        plan.push({
          id,
          template: '',
          gx: x,
          gy: y,
          depth: p.depth + 1,
          exits: { [OPPOSITE[d.edge]]: p.id },
        });
        added = true;
        break;
      }
      if (added) break;
    }
    if (!added) break; // Unreachable on an unbounded grid; guards against a malformed tuning.
  }
  return plan;
}

function attachBoss(plan: RiftRoomPlan[], prefix: string, arena: string): void {
  const taken = new Set(plan.map((p) => key(p.gx, p.gy)));
  taken.add(key(0, 1));
  let best: RiftRoomPlan | null = null;
  for (const p of plan) {
    if (p.exits.n !== undefined || taken.has(key(p.gx, p.gy - 1))) continue;
    if (best === null || p.depth > best.depth) best = p;
  }
  const at = best!;
  const id = `${prefix}boss`;
  at.exits.n = id;
  plan.push({
    id,
    template: `rift/bosses/${arena}`,
    gx: at.gx,
    gy: at.gy - 1,
    depth: at.depth + 1,
    exits: { s: at.id },
  });
}

/** Entry gets the entry chunk; every other room a random chunk different from its neighbors'. */
function assignChunks(plan: RiftRoomPlan[], rng: Rng): void {
  plan[0]!.template = `rift/chunks/${riftEntryChunk}`;
  const byId = new Map(plan.map((p) => [p.id, p]));
  for (const p of plan) {
    if (p.template !== '') continue;
    const near = new Set(Object.values(p.exits).map((id) => byId.get(id!)?.template));
    const options = riftChunks.map((c) => `rift/chunks/${c}`).filter((t) => !near.has(t));
    p.template = options[rng.int(options.length)]!;
  }
}

function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pickSpawn(rng: Rng, tier: number, chunk: string): RiftSpawn {
  const list = riftSpawns.filter(
    (s) => (s.fromTier ?? 1) <= tier && !(s.notIn as readonly string[] | undefined)?.includes(chunk),
  );
  let total = 0;
  for (const s of list) total += s.weight;
  let r = rng.float() * total;
  for (const s of list) {
    r -= s.weight;
    if (r < 0) return s;
  }
  return list[list.length - 1]!;
}

function spawnLine(rng: Rng, marker: string, tier: number, chunk: string): string {
  const s = pickSpawn(rng, tier, chunk);
  const rare = riftRarity.rare.base + riftRarity.rare.perTier * (tier - 1);
  const magic = riftRarity.magic.base + riftRarity.magic.perTier * (tier - 1);
  const r = rng.float();
  const rarity = r < rare ? ' rare' : r < rare + magic ? ' magic' : '';
  return 'pack' in s
    ? `@spawn ${marker} pack:${s.pack}${rarity}`
    : `@spawn ${marker} enemy:${s.enemy} ${s.count}${rarity}`;
}

/** A template's text with the rift's headers, its unused sockets walled and the terrain suffixes applied. */
function roomText(
  spec: RiftSpec,
  room: RiftRoomPlan,
  template: string,
  rng: Rng,
  bossKind: string | null,
): string {
  const data = parseRoom(template);
  const rows = data.rows.map((r) => r.split(''));
  const w = data.tilesW;
  const h = data.tilesH;
  for (const { edge } of DIRS) {
    if (room.exits[edge] !== undefined || (edge === 's' && room.id.endsWith('/entry'))) continue;
    if (bossKind !== null && edge === 'n') continue;
    const ch = EXIT_CHAR[edge];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (rows[y]![x] === ch) rows[y]![x] = '#';
  }
  const entry = room.id.endsWith('/entry');
  applyRiftTerrain(rows, spec.mods, rng, entry ? { x: Math.floor(w / 2), y: Math.floor(h / 2) } : null);
  const lines = [`@id ${room.id}`, `@name ${data.header.name}`, `@level ${riftAreaLevel(spec.tier)}`];
  for (const { edge } of DIRS)
    if (room.exits[edge] !== undefined) lines.push(`@exit ${edge} ${room.exits[edge]}`);
  if (room.id.endsWith('/entry') || bossKind !== null)
    lines.push(`@exit ${bossKind !== null ? 'n' : 's'} ${spec.home.roomId}`);
  const markers = new Set<string>();
  for (const r of rows) for (const ch of r) if (ch >= '1' && ch <= '9') markers.add(ch);
  for (const m of [...markers].sort()) {
    if (bossKind !== null) lines.push(`@spawn ${m} enemy:${bossKind}`);
    else lines.push(spawnLine(rng, m, spec.tier, room.template.replace(/^rift\/chunks\//, '')));
  }
  if (bossKind !== null) lines.push('@link D cleared');
  return `${lines.join('\n')}\n${rows.map((r) => r.join('')).join('\n')}\n`;
}
