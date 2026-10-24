/**
 * Player-facing text for the Loom, HUD and console: slot labels, rune facts, the damage breakdown
 * of a compiled weave, and trigger timing. Pure; runs in Node tests.
 */
import type { CompileResult, SpellProgram, SpellSpec } from '../../sim/weave';
import { getRune, runes, type RuneDef, type RuneKind } from '../../../data/runes';
import { SLOT_LABELS } from '../../app/loadout';

/** "1".."5" or LMB/RMB/Q/E/R (any case) → slot index; null otherwise. Slot 5 (R) may be locked (Twin Threads). */
export function parseSlot(word: string | undefined): number | null {
  if (word === undefined) return null;
  const w = word.trim().toUpperCase();
  if (/^[1-5]$/.test(w)) return Number(w) - 1;
  const i = (SLOT_LABELS as readonly string[]).indexOf(w);
  return i >= 0 ? i : null;
}

export const KIND_ORDER: readonly RuneKind[] = ['trigger', 'form', 'element', 'modifier', 'branch'];
export const KIND_TITLE: Record<RuneKind, string> = {
  trigger: 'Triggers',
  form: 'Forms',
  element: 'Elements',
  modifier: 'Modifiers',
  branch: 'Branches',
};

/** "6.6", "4", "0.45". */
export function fmtNum(v: number, digits = 1): string {
  const p = 10 ** digits;
  const r = Math.round(v * p) / p;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits).replace(/0+$/, '');
}

export const fmtPct = (f: number): string => `${fmtNum(f * 100, 1)}%`;
export const fmtSec = (s: number): string => `${fmtNum(s, 2)} s`;

/** "30% more", "25% less" from a multiplier. */
export function moreLess(mult: number): string {
  const d = Math.round((mult - 1) * 1000) / 10;
  if (d === 0) return 'no change';
  return d > 0 ? `${fmtNum(d)}% more` : `${fmtNum(-d)}% less`;
}

const nameOf = (id: string): string => getRune(id)?.name ?? id;
const listNames = (ids: readonly string[]): string => ids.map(nameOf).join(', ');

/** Tooltip facts for a rune: [label, value] rows after the description. */
export function runeFacts(def: RuneDef): Array<[string, string]> {
  const cx: [string, string] = [
    'Complexity',
    def.kind === 'branch' ? `${def.cx} (+1 per depth past 1)` : String(def.cx),
  ];
  switch (def.kind) {
    case 'trigger': {
      const rows: Array<[string, string]> = [cx, ['Mana', `×${fmtNum(def.manaMult, 2)}`]];
      if (def.icd > 0) rows.push(['Cooldown', `${fmtSec(def.icd)} (internal)`]);
      rows.push([
        'Fires',
        def.automatic ? 'Automatically (its slot button does nothing)' : 'When you press the slot button',
      ]);
      return rows;
    }
    case 'form':
      return [
        cx,
        ['Mana', `${fmtNum(def.baseMana)} base`],
        ['Cast time', fmtSec(def.castTime)],
        ['Damage', def.damaging ? `${fmtNum(def.baseDamage)} base, ${fmtPct(def.crit)} crit` : 'None itself'],
        [
          'Needs',
          def.needsEmit
            ? 'An element and an Emit branch'
            : def.needsElement
              ? 'An element'
              : 'Nothing (physical)',
        ],
      ];
    case 'element':
      return [cx, ['Mana', `×${fmtNum(def.manaMult, 2)}`], ['Applies to', 'Any form']];
    case 'modifier': {
      const to = def.appliesTo;
      const text =
        to === 'any'
          ? 'Any form'
          : to === 'damaging'
            ? 'Damaging forms (not Sigil)'
            : to === 'elemental'
              ? 'Any spell with an element'
              : listNames(to);
      return [cx, ['Mana', `×${fmtNum(def.manaMult, 2)}`], ['Applies to', text], ['Limit', 'Once per spell']];
    }
    case 'branch':
      return [
        cx,
        ['Mana', 'Child spell costs half'],
        ['Damage', def.damageMult === 1 ? 'No penalty' : moreLess(def.damageMult)],
        ['Parents', def.parents === 'damaging' ? 'Damaging forms (not Sigil)' : listNames(def.parents)],
      ];
  }
}

/** Short slot summary from notation: "Cast · Bolt" (trigger and root form), or "Empty". */
export function weaveSummary(notation: string | null): string {
  if (!notation) return 'Empty';
  const m = /^\s*(\w+)\s*>\s*(\w+)/.exec(notation);
  if (!m) return 'Unreadable';
  const name = (n: string) =>
    Object.values(runes).find((r) => r.notation.toLowerCase() === n.toLowerCase())?.name ?? n;
  return `${name(m[1]!)} · ${name(m[2]!)}`;
}

/** The root form and first element of a notation, for HUD glyphs ("Cast > Bolt[Fire]" → bolt, fire). */
export function weaveGlyph(notation: string | null): { form: string | null; element: string | null } {
  if (!notation) return { form: null, element: null };
  const m = /^\s*\w+\s*>\s*(\w+)\s*\[([^\]]*)\]/.exec(notation);
  if (!m) return { form: null, element: null };
  const form = Object.values(runes).find((r) => r.notation.toLowerCase() === m[1]!.toLowerCase());
  const items = m[2]!.split(',').map((s) => s.trim().toLowerCase());
  const el = Object.values(runes).find(
    (r) => r.kind === 'element' && items.includes(r.notation.toLowerCase()),
  );
  return { form: form?.kind === 'form' ? form.id : null, element: el?.id ?? null };
}

/** HUD slot name: first element and root form ("Fire Bolt", "Strike", "Frost Nova"), or "Empty". */
export function weaveShortName(notation: string | null): string {
  if (!notation) return 'Empty';
  const g = weaveGlyph(notation);
  if (!g.form) return 'Weave';
  const f = getRune(g.form)!.name;
  return g.element ? `${getRune(g.element)!.name} ${f}` : f;
}

export interface BreakdownRow {
  path: SpellSpec['path'];
  depth: number;
  /** "Bolt" for the root, "On Hit → Nova" for a branch spell. */
  title: string;
  baseDamage: number;
  /** Element shares, e.g. [['Fire', '50%'], ['Storm', '50%']] or [['Physical', '100%']]. */
  shares: Array<{ label: string; share: number; inherited: boolean }>;
  more: Array<{ label: string; text: string; mult: number }>;
  moreProduct: number;
  /** Base damage × all more/less, before crit, resistances and "increased". */
  perHit: number;
  critChance: number;
  critMultiplier: number;
  instances: number;
  damaging: boolean;
}

/** Damage breakdown per spell in tree order (root first), from a compiled program. */
export function damageBreakdown(program: SpellProgram): BreakdownRow[] {
  const rows: BreakdownRow[] = [];
  const go = (spec: SpellSpec, via: string | null) => {
    const form = getRune(spec.form);
    const damaging = form?.kind === 'form' ? form.damaging : true;
    rows.push({
      path: spec.path,
      depth: spec.depth,
      title: via ? `${via} → ${form?.name ?? spec.form}` : (form?.name ?? spec.form),
      baseDamage: spec.baseDamage,
      shares:
        spec.elements.length > 0
          ? spec.elements.map((e) => ({
              label: nameOf(e.element),
              share: e.share,
              inherited: e.source !== 'own',
            }))
          : damaging
            ? [{ label: 'Physical', share: 1, inherited: false }]
            : [],
      more: spec.more.map((m) => ({ label: m.label, text: moreLess(m.mult), mult: m.mult })),
      moreProduct: spec.moreProduct,
      perHit: spec.baseDamage * spec.moreProduct,
      critChance: spec.critChance,
      critMultiplier: spec.critMultiplier,
      instances: spec.instances.count,
      damaging,
    });
    for (const c of spec.children) go(c.spec, nameOf(c.branch));
  };
  go(program.root, null);
  return rows;
}

/** How the weave fires: "Cast time 0.45 s" or "Fires automatically · every 2 s". */
export function timingText(program: SpellProgram): { label: string; value: string } {
  const t = program.trigger;
  if (!t.automatic) return { label: 'Cast time', value: fmtSec(program.castTime) };
  const parts = ['Fires automatically'];
  if (t.period !== null) parts.push(`every ${fmtSec(t.period)}`);
  if (t.icd > 0) parts.push(`at most every ${fmtSec(t.icd)}`);
  return { label: 'Timing', value: parts.join(' · ') };
}

/** One-line status of a compiled slot weave, for the console and tooltips. */
export function compiledLine(c: CompileResult | null): string {
  if (!c) return 'empty';
  if (!c.ok) return `doesn't work: ${c.error.message}`;
  return `cx ${c.costs.complexity}/${c.costs.capacity}, ${fmtNum(c.costs.mana)} mana`;
}

const TRIGGER_STORY: Record<string, (slot: string) => string> = {
  cast: (slot) => `Press ${slot}`,
  pulse: () => 'Every 2 s, at the nearest enemy',
  on_dodge: () => 'When you dodge',
  harvest: () => 'When you kill an enemy',
  on_crit: () => 'When you crit',
  on_hurt: () => 'When a big hit hurts you',
  channel: (slot) => `While you hold ${slot}`,
  shatter: () => 'When you shatter an enemy',
};
const BRANCH_STORY: Record<string, string> = {
  on_hit: 'On hit',
  on_expire: 'When it ends',
  on_kill: 'On each kill',
  emit: 'Every 0.5 s while it lives',
};

/**
 * The weave in plain words, one line per spell, for predicting what it does:
 * ["Press LMB → a Fire Lob", "When it ends → a Fire Nova (Wide)"]. Works on drafts with empty
 * spots ("?"). Branch lines carry their depth for indenting.
 */
export function weaveStory(
  tree: { trigger: string; root: StorySpell },
  slot: string,
): Array<{ depth: number; text: string }> {
  const out: Array<{ depth: number; text: string }> = [];
  const isEl = (id: string) => getRune(id)?.kind === 'element';
  const go = (spell: StorySpell, depth: number, lead: string, inherited: string[]) => {
    const own = spell.items.filter(isEl);
    const els = own.length > 0 ? own : inherited;
    const mods = spell.items.filter((id) => !isEl(id)).map(nameOf);
    const split = spell.items.includes('split') ? '3 × ' : 'a ';
    const form = spell.form ? nameOf(spell.form) : '?';
    const elText = els.length > 0 ? `${els.map(nameOf).join('/')} ` : '';
    const inh = own.length === 0 && inherited.length > 0 ? ' (inherited element)' : '';
    const modText = mods.length > 0 ? ` (${mods.join(', ')})` : '';
    out.push({ depth, text: `${lead} → ${split}${elText}${form}${modText}${inh}` });
    for (const b of spell.branches)
      go(b.spell, depth + 1, b.branch ? (BRANCH_STORY[b.branch] ?? nameOf(b.branch)) : '?', els);
  };
  const t = tree.trigger ? (TRIGGER_STORY[tree.trigger]?.(slot) ?? nameOf(tree.trigger)) : '?';
  go(tree.root, 0, t, []);
  return out;
}

interface StorySpell {
  form: string;
  items: readonly string[];
  branches: ReadonlyArray<{ branch: string; spell: StorySpell }>;
}
