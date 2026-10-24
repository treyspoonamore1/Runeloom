/**
 * M7 console commands for the Hearth: `embers <n>`, `ash <n>`, `building <id> <level>`,
 * `rifttier <n>`, `offline <hours>` and `hearth` (go to the hub). Adventure mode only; they mark
 * the session edited like the other debug commands. Argument parsing is in plain functions so
 * tests can check it without a game.
 */
import { BUILDING_IDS, buildings, hearthRoom, hearthStone, type BuildingId } from '../../../data/hearth';
import { RIFT_TIERS } from '../../../data/rift';
import type { Session } from '../../app/session';
import { enterRoom } from '../../sim/world/transition';
import {
  debugOffline,
  debugSetAsh,
  debugSetBuilding,
  debugSetEmbers,
  debugSetRiftTier,
} from '../../sim/meta/debug';
import { CommandError, type CommandRegistry } from './commands';

export interface HearthEnv {
  session: Session;
}

export const MAX_EMBERS = 1_000_000_000;
export const MAX_ASH = 100_000;
/** `offline` takes hours; a month is plenty for a debug command (the real cap is 8 h). */
export const MAX_OFFLINE_HOURS = 24 * 30;

/** A whole number in [min, max] or a usage error. */
export function wholeArg(raw: string | undefined, min: number, max: number, usage: string): number {
  const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new CommandError(`Usage: ${usage}`);
  return n;
}

/** A building id, or a unique prefix of one ("kin" → kindling_pit). */
export function buildingArg(raw: string | undefined, usage: string): BuildingId {
  const w = raw?.toLowerCase();
  if (!w) throw new CommandError(`Usage: ${usage}`);
  const hits = BUILDING_IDS.filter((b) => b === w || b.startsWith(w) || b.replace('_', '').startsWith(w));
  if (hits.length !== 1)
    throw new CommandError(
      `${hits.length ? 'Ambiguous' : 'Unknown'} building "${raw}". Known: ${BUILDING_IDS.join(', ')}`,
    );
  return hits[0]!;
}

/** Hours (fractions allowed) as whole seconds, at least 1. */
export function hoursArg(raw: string | undefined, usage: string): number {
  const h = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
  if (!Number.isFinite(h) || h <= 0 || h > MAX_OFFLINE_HOURS) throw new CommandError(`Usage: ${usage}`);
  return Math.max(1, Math.round(h * 3600));
}

function adventureOnly(session: Session): void {
  if (session.state.mode !== 'adventure') throw new CommandError('The Hearth exists in adventure mode only.');
}

/**
 * Moves the player to the Hearth's Loom Stone (lighting the Hearth first, as the Cinder Warden
 * would), whatever room they are in. Throws when the hub room isn't in the game.
 */
export function goToHearth(session: Session): void {
  const s = session.state;
  if (s.rooms[hearthRoom] === undefined)
    throw new CommandError(`The hub room "${hearthRoom}" isn't built yet.`);
  debugSetEmbers(s, s.hero.hearth.embers);
  s.world.respawn = { roomId: hearthRoom, key: hearthStone.key };
  enterRoom(s, hearthRoom, { kind: 'loomStone', key: hearthStone.key });
  session.syncRoom();
}

export function registerHearthCommands<C extends HearthEnv>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'embers',
    usage: 'embers <n>',
    summary: 'Adventure: set the Embers held (lights the Hearth if needed).',
    run: (args, c) => {
      const n = wholeArg(args[0], 0, MAX_EMBERS, `embers <n> (0 to ${MAX_EMBERS})`);
      adventureOnly(c.session);
      debugSetEmbers(c.session.state, n);
      c.session.markEdited();
      return `Embers ${n}.`;
    },
  });
  reg.register({
    name: 'ash',
    usage: 'ash <n>',
    summary: 'Adventure: set the Ash held.',
    run: (args, c) => {
      const n = wholeArg(args[0], 0, MAX_ASH, `ash <n> (0 to ${MAX_ASH})`);
      adventureOnly(c.session);
      debugSetAsh(c.session.state, n);
      c.session.markEdited();
      return `Ash ${n}.`;
    },
  });
  reg.register({
    name: 'building',
    usage: 'building <id> <level>',
    summary: `Adventure: set a Hearth building's level. Buildings: ${BUILDING_IDS.join(', ')}.`,
    run: (args, c) => {
      const usage = 'building <id> <level>, e.g. building kindling_pit 10';
      const id = buildingArg(args[0], usage);
      const max = buildings[id].maxLevel;
      const level = wholeArg(args[1], 0, max, `${usage} (0 to ${max} for ${id})`);
      adventureOnly(c.session);
      debugSetBuilding(c.session.state, id, level);
      c.session.markEdited();
      return `${id} level ${level}.`;
    },
  });
  reg.register({
    name: 'rifttier',
    usage: 'rifttier <n>',
    summary: 'Adventure: set the best rift tier completed this cycle (Rekindle unlocks at 8).',
    run: (args, c) => {
      const n = wholeArg(args[0], 0, RIFT_TIERS, `rifttier <n> (0 to ${RIFT_TIERS})`);
      adventureOnly(c.session);
      debugSetRiftTier(c.session.state, n);
      c.session.markEdited();
      return `Best rift tier ${n}.`;
    },
  });
  reg.register({
    name: 'offline',
    usage: 'offline <hours>',
    summary: 'Adventure: apply offline progress for <hours> now (no 8 h cap), e.g. offline 2.5.',
    run: (args, c) => {
      const seconds = hoursArg(args[0], 'offline <hours> (e.g. offline 2.5)');
      adventureOnly(c.session);
      if (!c.session.state.hero.hearth.lit)
        throw new CommandError('The Hearth is not lit. Try "embers 100" first.');
      debugOffline(c.session.state, seconds);
      c.session.markEdited();
      return `Applied ${(seconds / 3600).toFixed(2)} h of offline progress.`;
    },
  });
  reg.register({
    name: 'hearth',
    summary: 'Adventure: light the Hearth if needed and go to the hub.',
    run: (_args, c) => {
      adventureOnly(c.session);
      goToHearth(c.session);
      c.session.markEdited();
      return 'At the Hearth.';
    },
  });
}
