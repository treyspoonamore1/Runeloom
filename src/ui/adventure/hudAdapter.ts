/**
 * Adventure HUD adapter: the numbers the HUD additions show, read once per frame.
 *
 * EXPECTED: hero.level / xp (hero agent; xpToNext from data/progression.ts), world.keys and
 * world.bigKeys per dungeon id (world agent; the dungeon id is the room id's region prefix, and
 * DUNGEONS lists which regions are dungeons), hero.heartSeeds / loomShards, boss enemies of kind
 * bossKinds (data/progression.ts) in state.enemies with life / maxLife (enemies agent; phase
 * marks below are DESIGN §10.3 and CONTENT §5), world.respawn for the death screen.
 * The events the HUD reacts to are listed in hudEvents.ts (HUD_EVENT).
 */
import { bossKinds, xpToNext } from '../../../data/progression';
import type { Session } from '../../app/session';
import { heroOf } from '../heroAdapter';
import { fixturesOn } from '../fixtures/mode';
import { fixtureProgress } from '../fixtures/regionMap';
import { quantize } from '../hudModel';
import { regionLayout } from '../map/adapter';
import { riftSummary } from '../map/riftModel';
import { readHearthSummary, stationNow } from '../hearth/adapter';
import { stations, type StationId } from '../../../data/hearth';

/** Regions that are dungeons with small keys. */
export const DUNGEONS: readonly string[] = ['kiln'];

/** Boss bar names and the life fractions where phases change. */
export const BOSS_INFO: Record<string, { name: string; marks: number[] }> = {
  tar_matriarch: { name: 'Tar Matriarch', marks: [0.5] },
  cinder_warden: { name: 'The Cinder Warden', marks: [0.66, 0.33] },
  rift_matriarch: { name: 'Rift Matriarch', marks: [0.5] },
  rift_warden: { name: 'Rift Warden', marks: [0.66, 0.33] },
};

export const REGION_NAMES: Record<string, string> = {
  emberwood: 'Emberwood',
  kiln: 'The Sunken Kiln',
  test: 'Test grounds',
  rift: 'Rift',
};

export interface BossSnap {
  name: string;
  lifeFrac: number;
  marks: number[];
  /** 1-based phase: marks passed + 1. */
  phase: number;
}

export interface AdventureSnap {
  level: number;
  xp: number;
  xpNext: number;
  xpFrac: number;
  /** Small keys for the current dungeon; null outside dungeons. */
  keys: number | null;
  bigKey: boolean;
  heartSeeds: number;
  loomShards: number;
  boss: BossSnap | null;
  rift: RiftSnap | null;
  /** The lit Hearth's counters (M7); null until it is lit. */
  hearth: HearthSnap | null;
  /** The hub station the player stands at (Interact opens it), for the small prompt. */
  station: { id: StationId; name: string } | null;
}

/** Embers, Ash and returned expeditions on the HUD. */
export interface HearthSnap {
  embers: number;
  ash: number;
  ready: number;
}

/** The open rift on the HUD (M6). */
export interface RiftSnap {
  tier: number;
  /** Modifier names, "Brutal · of Drought", or '' with none. */
  mods: string;
  rooms: number;
  cleared: number;
  bossDead: boolean;
}

// Room ids only change when a rift opens or closes (state.rooms is replaced then).
let roomIds: { rooms: object; ids: string[] } | null = null;

function riftOf(session: Session): RiftSnap | null {
  const s = session.state;
  if (!s.world.rift) return null;
  if (roomIds?.rooms !== s.rooms) roomIds = { rooms: s.rooms, ids: Object.keys(s.rooms) };
  const r = riftSummary(s.world, roomIds.ids);
  if (!r) return null;
  return {
    tier: r.tier,
    mods: r.mods.map((m) => m.name).join(' · '),
    rooms: r.rooms,
    cleared: r.cleared,
    bossDead: r.bossDead,
  };
}

/** Screenshots set a fixture boss (`?boss=cinder_warden`). */
let fixtureBoss: BossSnap | null = null;
export function setFixtureBoss(kind: string | null, lifeFrac = 0.58): void {
  const info = kind ? BOSS_INFO[kind] : undefined;
  fixtureBoss = info ? { ...info, lifeFrac, phase: phaseOf(info.marks, lifeFrac) } : null;
}

const phaseOf = (marks: readonly number[], f: number): number => 1 + marks.filter((m) => f < m).length;

export const regionOf = (roomId: string): string => roomId.split('/')[0] ?? '';

export function readAdventure(session: Session): AdventureSnap {
  const s = session.state;
  const hero = heroOf(session);
  const next = xpToNext(hero.level);
  const dungeon = fixturesOn.peek() ? 'kiln' : regionOf(s.world.roomId);
  const inDungeon = DUNGEONS.includes(dungeon);
  const keys = fixturesOn.peek() ? (fixtureProgress.keys[dungeon] ?? 0) : (s.world.keys[dungeon] ?? 0);
  return {
    level: hero.level,
    xp: Math.floor(hero.xp),
    xpNext: next,
    xpFrac: quantize(next > 0 ? hero.xp / next : 0, 200),
    keys: inDungeon ? keys : null,
    bigKey: s.world.bigKeys.includes(dungeon),
    heartSeeds: hero.heartSeeds,
    loomShards: hero.loomShards,
    boss: fixtureBoss ?? bossOf(session),
    rift: riftOf(session),
    hearth: hearthOf(session),
    station: stationOf(session),
  };
}

function hearthOf(session: Session): HearthSnap | null {
  const h = readHearthSummary(session);
  return h.lit ? { embers: h.embers, ash: h.ash, ready: h.expeditionsReady } : null;
}

function stationOf(session: Session): AdventureSnap['station'] {
  const id = stationNow(session);
  return id ? { id, name: stations[id].name } : null;
}

function bossOf(session: Session): BossSnap | null {
  for (const e of session.state.enemies) {
    if (!bossKinds.includes(e.kind) || e.dead) continue;
    const info = BOSS_INFO[e.kind] ?? { name: e.kind, marks: [] };
    const f = quantize(e.maxLife > 0 ? e.life / e.maxLife : 0, 300);
    return { name: info.name, marks: info.marks, lifeFrac: f, phase: phaseOf(info.marks, f) };
  }
  return null;
}

/** A room's display name: the map layout's, else the current room's @name, else its id. */
export function roomName(session: Session, roomId: string): string {
  if (session.state.room.id === roomId && session.state.room.name) return session.state.room.name;
  return regionLayout(session).rooms.find((r) => r.id === roomId)?.name ?? roomId;
}

/** Where the death screen says you'll wake up. */
export function respawnName(session: Session): string | null {
  const r = session.state.world.respawn;
  return r ? roomName(session, r.roomId) : null;
}
