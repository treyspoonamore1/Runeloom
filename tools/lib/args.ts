/** Tiny CLI argument parser shared by the tools. Pure, so it is unit tested. */
export type ArgKind = 'string' | 'number' | 'boolean';

export interface ArgSpec {
  [name: string]: { kind: ArgKind; default?: string | number | boolean; help?: string };
}

export type ParsedArgs<S extends ArgSpec> = {
  [K in keyof S]: S[K]['kind'] extends 'number'
    ? number | undefined
    : S[K]['kind'] extends 'boolean'
      ? boolean
      : string | undefined;
};

export class ArgError extends Error {}

/** Parses `--name value`, `--name=value` and boolean `--flag`. Unknown flags and bad numbers throw ArgError. */
export function parseArgs<S extends ArgSpec>(argv: readonly string[], spec: S): ParsedArgs<S> {
  const out: Record<string, string | number | boolean | undefined> = {};
  for (const [name, def] of Object.entries(spec))
    out[name] = def.default ?? (def.kind === 'boolean' ? false : undefined);

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]!;
    if (!raw.startsWith('--')) throw new ArgError(`Unexpected argument "${raw}"`);
    let name = raw.slice(2);
    let value: string | undefined;
    const eq = name.indexOf('=');
    if (eq >= 0) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    }
    const def = spec[name];
    if (!def)
      throw new ArgError(
        `Unknown option --${name}. Known: ${Object.keys(spec)
          .map((k) => `--${k}`)
          .join(', ')}`,
      );
    if (def.kind === 'boolean') {
      if (value !== undefined && value !== 'true' && value !== 'false')
        throw new ArgError(`--${name} takes no value`);
      out[name] = value !== 'false';
      continue;
    }
    if (value === undefined) {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new ArgError(`--${name} needs a value`);
      i++;
    }
    if (def.kind === 'number') {
      const n = Number(value);
      if (value.trim() === '' || !Number.isFinite(n))
        throw new ArgError(`--${name} must be a number, got "${value}"`);
      out[name] = n;
    } else out[name] = value;
  }
  return out as ParsedArgs<S>;
}

/** Throws unless `n` is an integer >= min. */
export function requireInt(name: string, n: number | undefined, min: number): number {
  if (n === undefined || !Number.isInteger(n) || n < min)
    throw new ArgError(`--${name} must be an integer >= ${min}, got ${n}`);
  return n;
}

/** Parses "1280x720". */
export function parseViewport(s: string): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(s);
  if (!m || Number(m[1]) < 1 || Number(m[2]) < 1)
    throw new ArgError(`--viewport must look like 1280x720, got "${s}"`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** Runs a CLI main, printing ArgError / Error messages cleanly with exit code 2. */
export function runCli(main: () => void | Promise<void>): void {
  Promise.resolve()
    .then(main)
    .catch((e: unknown) => {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(e instanceof ArgError ? 2 : 1);
    });
}
