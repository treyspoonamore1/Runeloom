/**
 * Which elements each spell ends up with (DESIGN §5.3): its own, else its parent's (inherited),
 * plus any added by an ancestor's Infuse. Assumes every id in the tree is a rune of the right kind
 * (compiler pass 1).
 */
import { runes, type ElementId } from '../../../data/runes';
import type { SpellNode, WeaveTree } from './tree';

export interface EffectiveElement {
  id: ElementId;
  source: 'own' | 'inherited' | 'infused';
}

/** Effective elements for every spell in the tree. */
export function analyzeElements(tree: WeaveTree): Map<SpellNode, EffectiveElement[]> {
  const out = new Map<SpellNode, EffectiveElement[]>();
  const go = (spell: SpellNode, parent: EffectiveElement[] | null, infused: readonly ElementId[]) => {
    const eff: EffectiveElement[] = [];
    for (const id of spell.items) {
      const def = runes[id];
      if (def?.kind === 'element' && !eff.some((e) => e.id === def.id))
        eff.push({ id: def.id, source: 'own' });
    }
    if (eff.length === 0 && parent) for (const e of parent) eff.push({ id: e.id, source: 'inherited' });
    for (const id of infused) if (!eff.some((e) => e.id === id)) eff.push({ id, source: 'infused' });
    out.set(spell, eff);
    const infuses = spell.items.some((id) => {
      const def = runes[id];
      return def?.kind === 'modifier' && def.inherit;
    });
    const nextInfused = infuses
      ? [...infused, ...eff.map((e) => e.id).filter((id) => !infused.includes(id))]
      : infused;
    for (const b of spell.branches) go(b.spell, eff, nextInfused);
  };
  go(tree.root, null, []);
  return out;
}
