/** Chemistry Lab console commands: `lab <rule|#index|name|nearest|all>` and `lab list`. */
import { labStations, type LabStation } from '../../../data/lab';
import { nearestStation, runAllStations, runStation, type GameState } from '../../sim';
import { CommandError, type CommandRegistry } from './commands';

export interface LabEnv {
  session: { state: GameState; markEdited(): void };
}

const USAGE = 'lab <rule | #index | name | nearest | all>   or   lab list';

/** Station indices matching a query: a rule number, "#index", "all", "nearest", or part of a label. */
export function findLabStations(
  query: string,
  state: GameState,
  stations: readonly LabStation[] = labStations,
): number[] {
  const q = query.trim().toLowerCase();
  if (q === 'all') return stations.map((_, i) => i);
  if (q === 'nearest') {
    const i = nearestStation(state, stations);
    return i < 0 ? [] : [i];
  }
  if (q.startsWith('#')) {
    const i = Number(q.slice(1));
    return Number.isInteger(i) && i >= 0 && i < stations.length ? [i] : [];
  }
  if (/^\d+$/.test(q)) {
    const rule = Number(q);
    return stations.flatMap((s, i) => (s.rule === rule ? [i] : []));
  }
  return stations.flatMap((s, i) => (s.label.toLowerCase().includes(q) ? [i] : []));
}

export function labListLines(stations: readonly LabStation[] = labStations): string[] {
  return stations.map((s, i) => `#${String(i).padEnd(2)} ${s.label}`);
}

/** Runs the stations (or all of them) on the live game and tells the session. Returns a message. */
export function runLabStations(
  env: LabEnv,
  indices: readonly number[],
  stations: readonly LabStation[] = labStations,
): string {
  const state = env.session.state;
  if (indices.length === stations.length && indices.length > 1) runAllStations(state, stations);
  else for (const i of indices) runStation(state, i, stations);
  env.session.markEdited();
  return indices.length === 1
    ? `Running: ${stations[indices[0]!]!.label}`
    : `Running ${indices.length} stations.`;
}

export function registerLabCommands<C extends LabEnv>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'lab',
    usage: 'lab <rule|#index|name|nearest|all>',
    summary:
      'Chemistry Lab: reset and run a station (rule 7, #12, "oil", nearest, all). "lab list" lists them.',
    run: (args, c) => {
      const query = args.join(' ').trim();
      if (query === '') throw new CommandError(`Usage: ${USAGE}`);
      if (query.toLowerCase() === 'list') return labListLines();
      if (c.session.state.room.id !== 'test/lab')
        throw new CommandError('The lab only exists in the lab scene (?scene=lab).');
      const hits = findLabStations(query, c.session.state);
      if (hits.length === 0) throw new CommandError(`No station matches "${query}". Try "lab list".`);
      return runLabStations(c, hits);
    },
  });
}
