import { spawnEnemy } from '../../sim';
import type { GameState } from '../../sim';
import { enemies as enemyDefs } from '../../../data/enemies';
import { CommandError, numArg, type CommandRegistry } from './commands';
import { killAllEnemies, startArenaWave } from './arenaAdapters';
import { findSpawnSpots } from './placement';

/** What the M1 commands need from the console environment (a subset of ConsoleEnv). */
export interface M1Env {
  session: { state: GameState; markEdited(): void };
  renderer: { screenToWorld(sx: number, sy: number): { x: number; y: number } };
  input: { mouse: { x: number; y: number } };
}

/** Most enemies one `spawn` may create. */
export const MAX_SPAWN = 60;
/** How far ahead of the player (cells) enemies appear when the mouse hasn't moved yet. */
const FALLBACK_AIM_DISTANCE = 24;

const KINDS = Object.keys(enemyDefs);

/** Resolves an enemy kind from an exact id, or a unique prefix or substring ("arch" → ember_archer). */
export function resolveKind(word: string | undefined): string {
  if (word === undefined) throw new CommandError(`Usage: spawn <enemy> [n]. Enemies: ${KINDS.join(', ')}`);
  const w = word.toLowerCase();
  if (KINDS.includes(w)) return w;
  for (const test of [(k: string) => k.startsWith(w), (k: string) => k.includes(w)]) {
    const hits = KINDS.filter(test);
    if (hits.length === 1) return hits[0]!;
    if (hits.length > 1) throw new CommandError(`"${word}" matches ${hits.join(', ')}.`);
  }
  throw new CommandError(`Unknown enemy "${word}". Enemies: ${KINDS.join(', ')}`);
}

/** The world point under the mouse, or ahead of the player if the mouse hasn't moved. */
export function cursorPoint(env: M1Env): { x: number; y: number } {
  const m = env.input.mouse;
  if (m.x !== 0 || m.y !== 0) {
    const p = env.renderer.screenToWorld(m.x, m.y);
    if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
  }
  const pl = env.session.state.player;
  return { x: pl.x + pl.aimDirX * FALLBACK_AIM_DISTANCE, y: pl.y + pl.aimDirY * FALLBACK_AIM_DISTANCE };
}

function parseCount(args: string[], i: number, usage: string, max: number): number {
  if (args[i] === undefined) return 1;
  const n = numArg(args, i, usage);
  if (!Number.isInteger(n) || n < 1 || n > max)
    throw new CommandError(`${usage}: n must be an integer from 1 to ${max}.`);
  return n;
}

const f1 = (v: number): string => v.toFixed(1);

export function registerM1Commands<C extends M1Env>(reg: CommandRegistry<C>): void {
  reg.register({
    name: 'spawn',
    usage: 'spawn <enemy> [n]',
    summary: `Spawn n enemies (default 1, max ${MAX_SPAWN}) around the cursor: ${KINDS.join(', ')}.`,
    run: (args, c) => {
      const kind = resolveKind(args[0]);
      const n = parseCount(args, 1, 'spawn <enemy> [n]', MAX_SPAWN);
      const state = c.session.state;
      const at = cursorPoint(c);
      const spots = findSpawnSpots(
        state.room,
        at.x,
        at.y,
        n,
        enemyDefs[kind as keyof typeof enemyDefs].radius,
        state.enemies,
      );
      for (const s of spots) spawnEnemy(state, kind, s.x, s.y);
      if (spots.length > 0) c.session.markEdited();
      if (spots.length === 0)
        throw new CommandError(`No room to spawn ${kind} near (${f1(at.x)}, ${f1(at.y)}).`);
      const short = spots.length < n ? ` (only ${spots.length} of ${n} fit)` : '';
      return `Spawned ${spots.length} ${kind} near (${f1(at.x)}, ${f1(at.y)})${short}.`;
    },
  });

  reg.register({
    name: 'killall',
    summary: 'Kill every enemy.',
    run: (_a, c) => {
      const n = killAllEnemies(c.session.state);
      c.session.markEdited();
      return `Killed ${n} enem${n === 1 ? 'y' : 'ies'}.`;
    },
  });

  reg.register({
    name: 'god',
    usage: 'god [on|off]',
    summary: 'Toggle god mode: the player takes no damage.',
    run: (args, c) => {
      const cheats = c.session.state.cheats;
      const arg = args[0]?.toLowerCase();
      if (arg !== undefined && arg !== 'on' && arg !== 'off') throw new CommandError('Usage: god [on|off]');
      cheats.god = arg === undefined ? !cheats.god : arg === 'on';
      c.session.markEdited();
      return `God mode ${cheats.god ? 'ON' : 'OFF'}.`;
    },
  });

  reg.register({
    name: 'wave',
    usage: 'wave <n>',
    summary: 'Arena: start wave n now.',
    run: (args, c) => {
      const n = numArg(args, 0, 'wave <n>');
      if (!Number.isInteger(n) || n < 1 || n > 999)
        throw new CommandError('Usage: wave <n> (n from 1 to 999).');
      const state = c.session.state;
      if (state.mode !== 'arena') throw new CommandError('Waves only run in the arena scene (?scene=arena).');
      if (!startArenaWave(state, n))
        throw new CommandError('This build has no arena wave logic yet. Use "spawn" instead.');
      c.session.markEdited();
      return `Wave ${n} started.`;
    },
  });
}
