import { hashHex, hashState } from '../../sim';
import { cloneTuning, defaultTuning } from '../../../data/tuning';
import { assignDeep } from '../tuningRanges';
import type { DebugContext } from '../debug';
import { CommandError, numArg, type CommandRegistry } from './commands';
import { registerM1Commands } from './m1';
import { registerM2Commands } from './m2';
import { registerLabCommands } from './lab';

/** Context for console commands: the debug context plus actions owned by the UI layer. */
export interface ConsoleEnv extends DebugContext {
  roomIds(): string[];
  saveReplay(): void;
  /** Re-reads the live tuning object into the F2 panel. */
  refreshTuning(): void;
  clearOutput(): void;
}

const STUBS: Array<[string, string, string]> = [
  ['give', 'give <rune>', 'M2'],
  ['level', 'level <n>', 'M2'],
];

export function registerBuiltins(reg: CommandRegistry<ConsoleEnv>): void {
  reg.register({
    name: 'help',
    usage: 'help [cmd]',
    summary: 'List commands, or describe one.',
    run: (args) => reg.helpLines(args[0]),
  });
  reg.register({
    name: 'clear',
    summary: 'Clear the console output.',
    run: (_a, c) => c.clearOutput(),
  });
  reg.register({
    name: 'seed',
    usage: 'seed <n>',
    summary: 'Reset the run with a new seed.',
    run: (args, c) => {
      const n = numArg(args, 0, 'seed <n>');
      if (!Number.isInteger(n) || n < 0) throw new CommandError('Seed must be a non-negative integer.');
      c.session.reset({ seed: n });
      return `Seed ${c.session.seed}. Hash ${hashHex(hashState(c.session.state))}`;
    },
  });
  reg.register({
    name: 'room',
    usage: 'room <id>',
    summary: 'Reset into another room.',
    run: (args, c) => {
      const ids = c.roomIds();
      const id = args[0];
      if (id === undefined || !ids.includes(id))
        throw new CommandError(
          `${id === undefined ? 'Usage: room <id>.' : `Unknown room "${id}".`} Known: ${ids.join(', ')}`,
        );
      c.session.reset({ roomId: id });
      return `Room ${id}.`;
    },
  });
  reg.register({
    name: 'reset',
    summary: 'Reset the run (same seed and room).',
    run: (_a, c) => c.session.reset(),
  });
  reg.register({
    name: 'timescale',
    usage: 'timescale <x>',
    summary: 'Sim speed multiplier, 0.05 to 4.',
    run: (args, c) => {
      const x = numArg(args, 0, 'timescale <x> (0.05 to 4)');
      if (x < 0.05 || x > 4) throw new CommandError('timescale must be between 0.05 and 4.');
      c.loop.timescale = x;
      return `timescale ${x}`;
    },
  });
  reg.register({ name: 'pause', summary: 'Pause the sim.', run: (_a, c) => void (c.loop.paused = true) });
  reg.register({ name: 'resume', summary: 'Resume the sim.', run: (_a, c) => void (c.loop.paused = false) });
  reg.register({
    name: 'step',
    usage: 'step [n]',
    summary: 'While paused, advance n ticks (default 1).',
    run: (args, c) => {
      if (!c.loop.paused) throw new CommandError('Not paused. Use "pause" first.');
      const n = args[0] === undefined ? 1 : numArg(args, 0, 'step [n]');
      if (!Number.isInteger(n) || n < 1 || n > 10000)
        throw new CommandError('n must be an integer from 1 to 10000.');
      for (let i = 0; i < n; i++) c.loop.stepOnce();
      return `Stepped ${n}. Tick ${c.session.state.tick}`;
    },
  });
  reg.register({
    name: 'hash',
    summary: 'Print the current state hash.',
    run: (_a, c) => `tick ${c.session.state.tick}  ${hashHex(hashState(c.session.state))}`,
  });
  reg.register({
    name: 'tuning',
    usage: 'tuning reset',
    summary: 'Restore default tuning values.',
    run: (args, c) => {
      if (args[0] !== 'reset') throw new CommandError('Usage: tuning reset');
      assignDeep(c.session.state.tuning, cloneTuning(defaultTuning));
      c.refreshTuning();
      return 'Tuning restored to defaults.';
    },
  });
  reg.register({ name: 'replay', summary: 'Save a replay (same as F9).', run: (_a, c) => c.saveReplay() });
  registerM1Commands(reg);
  registerM2Commands(reg);
  registerLabCommands(reg);
  for (const [name, usage, ms] of STUBS)
    reg.register({ name, usage, summary: `(${ms})`, run: () => `"${name}" is available in ${ms}.` });
}
