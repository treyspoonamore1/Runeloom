import { expect } from 'vitest';
import { testSpindle } from '../../../data/spindles';
import {
  compileWeave,
  parseWeave,
  spindleContext,
  type CompileContext,
  type CompileError,
  type SpellProgram,
  type WeaveCosts,
  type WeaveTree,
} from '../../../src/sim';

/** A context on the dev-only test spindle (CONTENT §2) with every milestone's runes allowed. */
export function testCtx(capacity = 99, extra: Partial<CompileContext> = {}): CompileContext {
  return { ...spindleContext(testSpindle(capacity), { allowShips: 'all' }), ...extra };
}

export function parsed(notation: string): WeaveTree {
  const r = parseWeave(notation);
  if (!r.ok) throw new Error(`parse failed: ${r.error.message}`);
  return r.tree;
}

export function compiled(
  notation: string,
  ctx: CompileContext = testCtx(),
): { program: SpellProgram; costs: WeaveCosts } {
  const r = compileWeave(parsed(notation), ctx);
  if (!r.ok) throw new Error(`compile failed for ${notation}: ${r.error.message}`);
  return r;
}

export function program(notation: string, ctx: CompileContext = testCtx()): SpellProgram {
  return compiled(notation, ctx).program;
}

export function compileError(notation: string, ctx: CompileContext = testCtx()): CompileError {
  const r = compileWeave(parsed(notation), ctx);
  if (r.ok) throw new Error(`compiled but should fail: ${notation}`);
  return r.error;
}

export function expectClose(actual: number, expected: number, digits = 12): void {
  expect(actual).toBeCloseTo(expected, digits);
}
