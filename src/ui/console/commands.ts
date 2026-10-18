/**
 * Dev console command registry. Pure (no DOM), generic over the context handed to
 * commands, so later milestones can register commands and tests can use a fake ctx.
 */

export interface Command<C> {
  name: string;
  /** One-line description shown by `help`. */
  summary: string;
  /** e.g. "seed <n>". Defaults to the name. */
  usage?: string;
  /** Returns text to print (string or lines). Throw CommandError for user mistakes. */
  run(args: string[], ctx: C): string | string[] | void;
}

/** A user-facing failure: printed as an error line without a stack trace. */
export class CommandError extends Error {}

export interface ExecResult {
  ok: boolean;
  lines: string[];
}

/** Splits a command line on whitespace; double or single quotes group words. */
export function parseLine(line: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
}

export function longestCommonPrefix(words: readonly string[]): string {
  if (words.length === 0) return '';
  let p = words[0]!;
  for (const w of words) while (!w.startsWith(p)) p = p.slice(0, -1);
  return p;
}

export interface Completion {
  /** New text for the input line. */
  text: string;
  /** Candidates to list when ambiguous. */
  candidates: string[];
}

export class CommandRegistry<C> {
  private readonly cmds = new Map<string, Command<C>>();

  register(cmd: Command<C>): void {
    this.cmds.set(cmd.name, cmd);
  }

  get(name: string): Command<C> | undefined {
    return this.cmds.get(name);
  }

  names(): string[] {
    return [...this.cmds.keys()].sort();
  }

  execute(line: string, ctx: C): ExecResult {
    const [name, ...args] = parseLine(line);
    if (name === undefined) return { ok: true, lines: [] };
    const cmd = this.cmds.get(name.toLowerCase());
    if (!cmd) {
      const near = this.names().filter((n) => n.startsWith(name.toLowerCase().slice(0, 2)));
      const hint = near.length > 0 ? ` Did you mean: ${near.join(', ')}?` : '';
      return { ok: false, lines: [`Unknown command "${name}".${hint} Type "help".`] };
    }
    try {
      const res = cmd.run(args, ctx);
      return { ok: true, lines: res === undefined ? [] : Array.isArray(res) ? res : [res] };
    } catch (e) {
      if (e instanceof CommandError) return { ok: false, lines: [e.message] };
      return { ok: false, lines: [`${cmd.name} failed: ${e instanceof Error ? e.message : String(e)}`] };
    }
  }

  /** Tab completion of the command name (first word only). */
  complete(line: string): Completion {
    if (/\s/.test(line.trimStart())) return { text: line, candidates: [] };
    const prefix = line.trim().toLowerCase();
    const matches = this.names().filter((n) => n.startsWith(prefix));
    if (matches.length === 0) return { text: line, candidates: [] };
    if (matches.length === 1) return { text: matches[0] + ' ', candidates: matches };
    return { text: longestCommonPrefix(matches), candidates: matches };
  }

  helpLines(name?: string): string[] {
    if (name !== undefined) {
      const c = this.cmds.get(name.toLowerCase());
      if (!c) throw new CommandError(`No such command "${name}".`);
      return [`${c.usage ?? c.name}  -  ${c.summary}`];
    }
    const width = Math.max(...this.names().map((n) => (this.cmds.get(n)!.usage ?? n).length));
    return this.names().map((n) => {
      const c = this.cmds.get(n)!;
      return `${(c.usage ?? n).padEnd(width)}  ${c.summary}`;
    });
  }
}

/** Parses a number argument or throws a usage error. */
export function numArg(args: string[], i: number, usage: string): number {
  const v = Number(args[i]);
  if (args[i] === undefined || args[i] === '' || !Number.isFinite(v))
    throw new CommandError(`Usage: ${usage}`);
  return v;
}
