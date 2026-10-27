/**
 * What the item-get panel says (pure, no DOM): the new element rune's name, flavor, what it does
 * in the world (data/elementMoments.ts) and a concrete next step. The step suggests a new weave
 * (`Cast > Bolt[Frost]` in a free slot) when the hero has a free Cast rune, a free form rune and an
 * empty slot; otherwise it suggests swapping the element into an existing weave.
 */
import { elementMoments, suggestedForms } from '../../../data/elementMoments';
import { getRune, runes, type RuneId } from '../../../data/runes';
import { SLOT_LABELS, type RuneCounts } from '../../app/loadout';

export interface WeaveSuggestion {
  /** 'new': a fresh weave in an empty slot; 'swap': the element into an existing weave; 'none'. */
  kind: 'new' | 'swap' | 'none';
  /** The slot the Loom opens on (-1: keep the Loom's current slot). */
  slot: number;
  /** The suggested weave, or null. */
  notation: string | null;
  /**
   * 'new': the weave without its element (`Cast > Bolt[]`). "Open the Loom" puts it in the empty
   * slot with the new rune picked, so the player's one click is placing the element.
   */
  stub: string | null;
  /** The line the panel shows. */
  text: string;
  /** Why it is a swap (no free runes or slots), or ''. */
  why: string;
}

export interface ItemGetView {
  rune: RuneId;
  /** "Frost Rune". */
  title: string;
  flavor: string;
  does: readonly string[];
  suggestion: WeaveSuggestion;
}

export interface SuggestInput {
  /** Owned rune items per rune (src/app/loadout.ts getRuneCounts); ignored when `unlimited`. */
  counts: RuneCounts;
  /** Every rune is unlimited (sandbox). */
  unlimited: boolean;
  /** Canonical notation per slot, null when empty. */
  slots: readonly (string | null)[];
  /** The weave slot of each `slots` entry (the live bar's and R); default: its index. */
  slotIds?: readonly number[];
  /** Whether `notation` would compile in `slot` (Capacity, rune counts). Default: always. */
  fits?(notation: string, slot: number): boolean;
}

const LOOM = 'the Loom (Tab)';
const ELEMENT_NOTATIONS = new Set(
  Object.values(runes)
    .filter((r) => r.kind === 'element')
    .map((r) => r.notation),
);

const free = (inp: SuggestInput, id: RuneId): boolean => inp.unlimited || (inp.counts[id]?.free ?? 0) > 0;

/** `notation` with `element` in its root form's brackets: replacing its first element, else added first. */
export function withElement(
  notation: string,
  element: string,
): { notation: string; replaced: string | null } | null {
  const open = notation.indexOf('[');
  const close = open < 0 ? -1 : notation.indexOf(']', open);
  if (open < 0 || close < 0) return null;
  const inner = notation.slice(open + 1, close).trim();
  const parts = inner === '' ? [] : inner.split(',').map((t) => t.trim());
  const i = parts.findIndex((t) => ELEMENT_NOTATIONS.has(t));
  const replaced = i >= 0 ? parts[i]! : null;
  if (i >= 0) parts[i] = element;
  else parts.unshift(element);
  return { notation: `${notation.slice(0, open + 1)}${parts.join(', ')}${notation.slice(close)}`, replaced };
}

/** The next step for a new element rune: a new weave if the hero can make one, else a swap. */
export function suggestWeave(rune: RuneId, inp: SuggestInput): WeaveSuggestion {
  const el = runes[rune].notation;
  const fits = inp.fits ?? (() => true);
  const id = (i: number): number => inp.slotIds?.[i] ?? i;
  const emptyAt = inp.slots.findIndex((n) => n === null);
  const empty = emptyAt < 0 ? -1 : id(emptyAt);
  const form = suggestedForms.find((f) => free(inp, f));
  const newOk = empty >= 0 && free(inp, 'cast') && form !== undefined;
  if (newOk) {
    const notation = `Cast > ${runes[form].notation}[${el}]`;
    if (fits(notation, empty))
      return {
        kind: 'new',
        slot: empty,
        notation,
        stub: `Cast > ${runes[form].notation}[]`,
        text: `Weave it in ${LOOM} — try ${notation} in ${SLOT_LABELS[empty] ?? empty + 1}`,
        why: '',
      };
  }
  // Swap: Cast weaves first, then the rest; replacing an element before adding one.
  const order = inp.slots
    .map((n, i) => ({ n, slot: id(i) }))
    .filter((x): x is { n: string; slot: number } => x.n !== null)
    .sort((a, b) => Number(!a.n.startsWith('Cast')) - Number(!b.n.startsWith('Cast')));
  const candidates = order
    .map((x) => ({ ...x, w: withElement(x.n, el) }))
    .filter((x) => x.w !== null)
    .sort((a, b) => Number(a.w!.replaced === null) - Number(b.w!.replaced === null));
  const why =
    empty < 0 ? 'All four weave slots are in use.' : 'Every Cast and form rune you own is already woven.';
  for (const c of candidates) {
    const w = c.w!;
    if (!fits(w.notation, c.slot)) continue;
    const label = SLOT_LABELS[c.slot] ?? String(c.slot + 1);
    const instead = w.replaced ? ` (instead of ${w.replaced})` : '';
    return {
      kind: 'swap',
      slot: c.slot,
      notation: w.notation,
      stub: null,
      text: `Swap it into a weave in ${LOOM} — try ${w.notation} in ${label}${instead}`,
      why,
    };
  }
  return {
    kind: 'none',
    slot: -1,
    notation: null,
    stub: null,
    text: `Weave it in ${LOOM}`,
    why: newOk ? '' : why,
  };
}

/** The whole panel for `rune`. */
export function itemGetView(rune: RuneId, inp: SuggestInput): ItemGetView {
  const def = getRune(rune);
  const text = (elementMoments as Partial<Record<RuneId, { flavor: string; does: readonly string[] }>>)[rune];
  return {
    rune,
    title: `${def?.name ?? rune} Rune`,
    flavor: text?.flavor ?? def?.description ?? '',
    does: text?.does ?? [],
    suggestion: suggestWeave(rune, inp),
  };
}
