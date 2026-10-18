/**
 * Weave text notation (DESIGN §5.2): parser and canonical printer.
 *
 *   weave    := TRIGGER " > " spell
 *   spell    := FORM "[" items? "]" branches?
 *   items    := item (", " item)*
 *   branches := " > " BRANCH " > " spell
 *             | " { " BRANCH " > " spell ("; " BRANCH " > " spell)* " }"
 *
 * Rune names are notation names (CONTENT §1 names without spaces), matched case-insensitively.
 * Whitespace between tokens is free. A single branch may also be written in braces; the printer
 * always writes one branch with " > " and two or more with braces.
 *
 * The parser checks syntax and that each name is a rune, nothing else: a known rune in the wrong
 * place is left for the compiler, so its validation order (DESIGN §5.3) decides the message.
 * It never throws.
 */
import { getRune, runeByNotation, type RuneId } from '../../../data/runes';
import type { BranchNode, SpellNode, WeaveTree } from './tree';

export interface ParseError {
  /** Player-facing, ending with "at <index>", e.g. "Unknown rune 'Fireball' at 12". */
  message: string;
  /** Character offset of the offending token in the input (input length for "the end"). */
  index: number;
  /** Length of the offending token (0 at the end of input). */
  length: number;
}

export type ParseResult = { ok: true; tree: WeaveTree } | { ok: false; error: ParseError };

/** Deepest branch nesting the parser accepts (far above any legal weave; guards the stack). */
const MAX_PARSE_NESTING = 32;

type Tok = { t: 'name' | 'punct' | 'end'; text: string; index: number };

class Fail {
  constructor(readonly error: ParseError) {}
}

export function parseWeave(text: string): ParseResult {
  const toks = tokenize(text);
  if (toks instanceof Fail) return { ok: false, error: toks.error };
  const p = new Parser(toks);
  try {
    return { ok: true, tree: p.weave() };
  } catch (e) {
    if (e instanceof Fail) return { ok: false, error: e.error };
    throw e;
  }
}

/** Canonical notation. Unknown ids (from a hand-built tree) are printed as they are. */
export function printWeave(tree: WeaveTree): string {
  return `${name(tree.trigger)} > ${printSpell(tree.root)}`;
}

/** Canonical notation of one spell and its branches. */
export function printSpell(spell: SpellNode): string {
  let s = `${name(spell.form)}[${spell.items.map(name).join(', ')}]`;
  if (spell.branches.length === 1) s += ` > ${printBranch(spell.branches[0]!)}`;
  else if (spell.branches.length > 1) s += ` { ${spell.branches.map(printBranch).join('; ')} }`;
  return s;
}

/** Canonical form of a notation string, or null if it doesn't parse. */
export function canonicalWeave(text: string): string | null {
  const r = parseWeave(text);
  return r.ok ? printWeave(r.tree) : null;
}

function printBranch(b: BranchNode): string {
  return `${name(b.branch)} > ${printSpell(b.spell)}`;
}

function name(id: string): string {
  return getRune(id)?.notation ?? id;
}

const PUNCT = '>[],{};';

function tokenize(text: string): Tok[] | Fail {
  const out: Tok[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (PUNCT.includes(c)) {
      out.push({ t: 'punct', text: c, index: i++ });
    } else if (/[A-Za-z0-9_]/.test(c)) {
      const start = i;
      while (i < text.length && /[A-Za-z0-9_]/.test(text[i]!)) i++;
      out.push({ t: 'name', text: text.slice(start, i), index: start });
    } else {
      return new Fail({ message: `Unexpected character '${c}' at ${i}`, index: i, length: 1 });
    }
  }
  out.push({ t: 'end', text: '', index: text.length });
  return out;
}

class Parser {
  private pos = 0;
  private nesting = 0;

  constructor(private readonly toks: Tok[]) {}

  weave(): WeaveTree {
    const first = this.peek();
    if (first.t === 'name' && runeByNotation(first.text) && this.peek(1).text === '[')
      this.fail(`Missing trigger: start with one, like 'Cast > ${first.text}[...]'`, first);
    const trigger = this.rune('a trigger rune');
    this.expectPunct('>', `'>' after '${trigger.text}'`);
    const root = this.spell();
    const end = this.peek();
    if (end.t !== 'end') this.fail(`Expected the end of the weave, found ${describe(end)}`, end);
    return { trigger: trigger.id, root };
  }

  private spell(): SpellNode {
    const form = this.rune('a form rune');
    this.expectPunct('[', `'[' after '${form.text}'`);
    const items: RuneId[] = [];
    if (!this.isPunct(']')) {
      items.push(this.rune(`a rune or ']'`).id);
      while (this.isPunct(',')) {
        this.pos++;
        items.push(this.rune(`a rune after ','`).id);
      }
    }
    this.expectPunct(']', items.length > 0 ? `',' or ']'` : `a rune or ']'`);
    return { form: form.id, items, branches: this.branches() };
  }

  private branches(): BranchNode[] {
    if (this.isPunct('>')) {
      this.pos++;
      return [this.branch()];
    }
    if (!this.isPunct('{')) return [];
    this.pos++;
    const out = [this.branch()];
    while (this.isPunct(';')) {
      this.pos++;
      out.push(this.branch());
    }
    this.expectPunct('}', `';' or '}'`);
    return out;
  }

  private branch(): BranchNode {
    const b = this.rune('a branch rune');
    this.expectPunct('>', `'>' after '${b.text}'`);
    if (++this.nesting > MAX_PARSE_NESTING) this.fail('Too many nested branches', this.peek());
    const spell = this.spell();
    this.nesting--;
    return { branch: b.id, spell };
  }

  /** Consumes a name token that is a rune. */
  private rune(expected: string): { id: RuneId; text: string } {
    const tok = this.peek();
    if (tok.t !== 'name') this.fail(`Expected ${expected}, found ${describe(tok)}`, tok);
    const def = runeByNotation(tok.text);
    if (!def) this.fail(`Unknown rune '${tok.text}'`, tok);
    this.pos++;
    return { id: def.id, text: tok.text };
  }

  private expectPunct(c: string, expected: string): void {
    const tok = this.peek();
    if (tok.t !== 'punct' || tok.text !== c) this.fail(`Expected ${expected}, found ${describe(tok)}`, tok);
    this.pos++;
  }

  private isPunct(c: string): boolean {
    const tok = this.peek();
    return tok.t === 'punct' && tok.text === c;
  }

  private peek(ahead = 0): Tok {
    return this.toks[Math.min(this.pos + ahead, this.toks.length - 1)]!;
  }

  private fail(message: string, tok: Tok): never {
    throw new Fail({ message: `${message} at ${tok.index}`, index: tok.index, length: tok.text.length });
  }
}

function describe(tok: Tok): string {
  return tok.t === 'end' ? 'the end' : `'${tok.text}'`;
}
