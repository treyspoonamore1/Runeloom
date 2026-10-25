/** The bag's Fuse parts and Rune pouch tabs: tiles like the Items tab (M7.5). */
import type { Session } from '../../app/session';
import { getRune } from '../../../data/runes';
import type { FusePart, HeroState, RuneItem } from '../../sim/hero/types';
import { parseWeave } from '../../sim/weave/notation';
import { PartArt } from '../items/itemArt';
import { KIND_ORDER } from '../loom/describe';
import { RuneGlyph } from '../loom/glyphs';
import { usedBy } from '../loom/pouchCounts';
import { tipFor } from '../menus/frame';
import { partName } from './adapter';
import { startDrag } from './equipment';
import { askSalvage, dragging, fuse, quickSalvage } from './slots';
import { PartTip, RuneTip } from './tips';

const ROMAN = ['', 'I', 'II', 'III'] as const;

export interface PartStack {
  key: string;
  parts: FusePart[];
}

/** Parts of the same kind and tier stack; highest tier first, then by name. */
export function stackParts(parts: readonly FusePart[]): PartStack[] {
  const by = new Map<string, FusePart[]>();
  for (const p of parts) by.set(`${p.part}:${p.tier}`, [...(by.get(`${p.part}:${p.tier}`) ?? []), p]);
  return [...by.entries()]
    .map(([key, list]) => ({ key, parts: list }))
    .sort((a, b) => {
      const x = a.parts[0]!;
      const y = b.parts[0]!;
      return y.tier - x.tier || x.part.localeCompare(y.part);
    });
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div class="inv-empty">
      <b>{title}</b>
      <span>{text}</span>
    </div>
  );
}

export function PartsTab({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  if (hero.parts.length === 0)
    return <Empty title="No Fuse parts yet" text="Monsters drop them. Fuse them into your spindle." />;
  return (
    <div class="inv-tiles labeled" role="group" aria-label="Fuse parts">
      {stackParts(hero.parts).map(({ key, parts }) => {
        const p = parts[0]!;
        return (
          <div class="inv-tilewrap" key={key}>
            <button
              type="button"
              class="inv-tile labeled r-magic"
              draggable
              aria-label={`${partName(p)}${parts.length > 1 ? `, ${parts.length} owned` : ''}. Click to fuse, Shift-click to salvage, Delete to ask`}
              onClick={(e) => (e.shiftKey ? quickSalvage(session, p) : fuse(session, p))}
              onKeyDown={(e) => {
                if (e.key === 'Delete' || e.key === 'Backspace') askSalvage(p);
              }}
              onDragStart={(e) => startDrag(e, { kind: 'part', uid: p.uid })}
              onDragEnd={() => (dragging.value = null)}
              {...tipFor('magic', () => <PartTip part={p} fused={false} />)}
            >
              <span class="inv-art">
                <PartArt part={p.part} tier={p.tier} size="md" />
              </span>
              <span class="inv-cap">{partName(p).replace(/ \([IV]+\)$| [IV]+$/, '')}</span>
              <span class="inv-sub">Tier {ROMAN[p.tier]}</span>
              {parts.length > 1 ? <span class="inv-n">×{parts.length}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function RunesTab({ session, hero }: { session: Session; hero: Readonly<HeroState>; rev: number }) {
  const used = new Map<string, number>();
  for (const s of session.state.weaves.slots) {
    const p = s.notation ? parseWeave(s.notation) : null;
    if (p?.ok) usedBy(p.tree, used);
  }
  const groups = new Map<string, RuneItem[]>();
  for (const r of hero.runes) groups.set(r.rune, [...(groups.get(r.rune) ?? []), r]);
  const ids = [...groups.keys()].sort((a, b) => {
    const ka = KIND_ORDER.indexOf(getRune(a)?.kind ?? 'trigger');
    const kb = KIND_ORDER.indexOf(getRune(b)?.kind ?? 'trigger');
    return ka - kb || a.localeCompare(b);
  });
  if (ids.length === 0)
    return <Empty title="No runes yet" text="Runes come from bosses, shrines and drops." />;
  return (
    <div class="inv-tiles labeled" role="group" aria-label="Runes">
      {ids.map((id) => {
        const copies = groups.get(id)!;
        const def = getRune(id);
        const inUse = used.get(id) ?? 0;
        const best = copies.reduce((a, b) => (b.level > a.level ? b : a));
        const kind = def?.kind ?? 'form';
        return (
          <div class="inv-tilewrap" key={id}>
            <button
              type="button"
              class={`inv-tile labeled rune k-${kind} r-${id}`}
              aria-label={`${def?.name ?? id}: ${copies.length} owned, ${inUse} in weaves, best level ${best.level}`}
              {...tipFor('normal', () => <RuneTip rune={best} copies={copies} inUse={inUse} />)}
            >
              <span class="inv-art">
                <span class={`lm-medal k-${kind} r-${id}`}>
                  <RuneGlyph id={id} />
                </span>
              </span>
              <span class="inv-cap">{def?.name ?? id}</span>
              <span class="inv-sub">
                lv {best.level} · {inUse}/{copies.length} used
              </span>
              {copies.length > 1 ? <span class="inv-n">×{copies.length}</span> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}
