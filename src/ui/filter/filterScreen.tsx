/**
 * The loot filter editor (L, M5): an ordered rule list where the first match decides whether a
 * drop is shown, highlighted (a light beam and a chime) or hidden (not drawn, no toast, still
 * picked up). Presets to start from, and a preview of how the filter treats each kind of drop.
 * Presentation only: rules live in app/lootFilterStore.ts, not in the sim or the save.
 */
import type { Session } from '../../app/session';
import { lootFilter, setLootFilter } from '../../app/lootFilterStore';
import { currencies, currencyIds, type CurrencyId } from '../../../data/currency';
import { itemKindNames, itemKinds, type ItemKind } from '../../../data/items';
import {
  lootAction,
  lootActions,
  lootFilterPresets,
  lootWhats,
  rarityOrder,
  type LootAction,
  type LootRule,
  type LootWhat,
} from '../../sim/items/lootFilter';
import type { LootContent } from '../../sim/items/loot';
import type { ItemRarity } from '../../sim/hero/types';
import { MenuFrame, note, type MenuId } from '../menus/frame';
import { injectFilterStyle } from './filterStyle';

const WHAT: Record<LootWhat, string> = {
  any: 'Anything',
  item: 'Gear',
  rune: 'Runes',
  part: 'Fuse parts',
  currency: 'Currency',
  scrap: 'Thread Scrap',
  sigil: 'Rift Sigils',
};
const ACTION: Record<LootAction, string> = { show: 'Show', highlight: 'Highlight', hide: 'Hide' };
const RARITY: Record<ItemRarity, string> = {
  normal: 'Normal',
  magic: 'Magic',
  rare: 'Rare',
  unique: 'Unique',
};

function update(i: number, patch: Partial<LootRule> | null): void {
  const rules = [...lootFilter.value.rules];
  if (patch === null) rules.splice(i, 1);
  else {
    const r = { ...rules[i]!, ...patch };
    // Fields that don't apply to the rule's kind are dropped.
    if (r.what !== 'item') {
      delete r.maxRarity;
      delete r.itemKind;
    }
    if (r.what !== 'currency') delete r.currency;
    rules[i] = r;
  }
  setLootFilter({ rules });
}

function move(i: number, by: number): void {
  const rules = [...lootFilter.value.rules];
  const j = i + by;
  if (j < 0 || j >= rules.length) return;
  [rules[i], rules[j]] = [rules[j]!, rules[i]!];
  setLootFilter({ rules });
}

function Select<T extends string>(p: {
  label: string;
  value: T | '';
  options: readonly (readonly [T | '', string])[];
  onChange(v: T | ''): void;
}) {
  return (
    <label class="lf-field">
      <span>{p.label}</span>
      <select
        value={p.value}
        onChange={(e) => p.onChange((e.currentTarget as HTMLSelectElement).value as T | '')}
      >
        {p.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function RuleRow({ rule, i, n }: { rule: LootRule; i: number; n: number }) {
  return (
    <li class={`lf-rule a-${rule.action}`}>
      <span class="lf-num">{i + 1}</span>
      <Select
        label="When"
        value={rule.what}
        options={lootWhats.map((w) => [w, WHAT[w]] as const)}
        onChange={(v) => update(i, { what: (v || 'any') as LootWhat })}
      />
      {rule.what === 'item' ? (
        <>
          <Select<ItemRarity>
            label="Rarity up to"
            value={rule.maxRarity ?? ''}
            options={[['', 'Any'], ...rarityOrder.map((r) => [r, RARITY[r]] as const)]}
            onChange={(v) => update(i, { maxRarity: v || undefined })}
          />
          <Select<ItemKind>
            label="Slot"
            value={rule.itemKind ?? ''}
            options={[['', 'Any'], ...itemKinds.map((k) => [k, itemKindNames[k]] as const)]}
            onChange={(v) => update(i, { itemKind: v || undefined })}
          />
        </>
      ) : null}
      {rule.what === 'currency' ? (
        <Select<CurrencyId>
          label="Which"
          value={rule.currency ?? ''}
          options={[['', 'Any'], ...currencyIds.map((c) => [c, currencies[c].name] as const)]}
          onChange={(v) => update(i, { currency: v || undefined })}
        />
      ) : null}
      <Select<LootAction>
        label="Then"
        value={rule.action}
        options={lootActions.map((a) => [a, ACTION[a]] as const)}
        onChange={(v) => update(i, { action: (v || 'show') as LootAction })}
      />
      <span class="lf-acts">
        <button
          type="button"
          class="lf-mini"
          aria-label="Move up"
          disabled={i === 0}
          onClick={() => move(i, -1)}
        >
          ▲
        </button>
        <button
          type="button"
          class="lf-mini"
          aria-label="Move down"
          disabled={i === n - 1}
          onClick={() => move(i, 1)}
        >
          ▼
        </button>
        <button type="button" class="lf-mini del" aria-label="Delete rule" onClick={() => update(i, null)}>
          ×
        </button>
      </span>
    </li>
  );
}

/** One sample of every kind of drop, for the preview. */
function samples(): { label: string; c: LootContent }[] {
  const item = (rarity: ItemRarity, base: string, kind: string) => ({
    label: `${RARITY[rarity]} ${kind}`,
    c: { kind: 'item', item: { uid: 0, base, rarity, itemLevel: 1, affixes: [], fused: [] } } as LootContent,
  });
  return [
    ...rarityOrder.map((r) => item(r, 'travelers_cloak', 'cloak')),
    ...rarityOrder.map((r) => item(r, 'twig', 'spindle')),
    { label: 'Rune', c: { kind: 'rune', rune: { uid: 0, rune: 'bolt', level: 1, xp: 0, quality: 0 } } },
    { label: 'Fuse part', c: { kind: 'part', part: { uid: 0, part: 'tinder_tooth', tier: 1 } } },
    { label: 'Thread Scrap', c: { kind: 'scrap', amount: 1 } },
    { label: 'Rift Sigil', c: { kind: 'sigil', sigil: { uid: 0, tier: 1, mods: [] } } },
    ...currencyIds.map((id) => ({
      label: currencies[id].name,
      c: { kind: 'currency', currency: id, amount: 1 } as LootContent,
    })),
  ];
}

export function FilterScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectFilterStyle();
  const filter = lootFilter.value;
  const rules = filter.rules;
  return (
    <MenuFrame id="filter" title="Loot Filter" onTab={p.onTab} onClose={p.onClose} bodyClass="lf-body">
      <section class="mn-panel lf-rules" aria-label="Rules">
        <h3>
          Rules <small>the first match decides; no match: show</small>
        </h3>
        <div class="mn-scroll">
          {rules.length === 0 ? <p class="mn-muted">No rules: every drop shows.</p> : null}
          <ol class="lf-list">
            {rules.map((r, i) => (
              <RuleRow key={i} rule={r} i={i} n={rules.length} />
            ))}
          </ol>
          <button
            type="button"
            class="mn-btn"
            onClick={() =>
              setLootFilter({ rules: [...rules, { what: 'item', maxRarity: 'normal', action: 'hide' }] })
            }
          >
            + Add rule
          </button>
        </div>
        <p class="mn-help">
          Hidden drops aren't drawn or announced, but you still pick them up. Highlighted drops stand in a
          light beam.
        </p>
      </section>
      <aside class="mn-panel lf-side" aria-label="Presets and preview">
        <h3>Presets</h3>
        <div class="lf-presets">
          {lootFilterPresets.map((pr) => (
            <button
              key={pr.name}
              type="button"
              class="mn-btn"
              onClick={() => {
                setLootFilter(pr.filter);
                note(`Filter: ${pr.name}`, true);
              }}
            >
              {pr.name}
            </button>
          ))}
        </div>
        <h3 class="lf-prev-h">Preview</h3>
        <div class="mn-scroll">
          <ul class="lf-preview">
            {samples().map((s) => {
              const a = lootAction(filter, s.c);
              return (
                <li key={s.label} class={`a-${a}`}>
                  <span>{s.label}</span>
                  <b>{ACTION[a]}</b>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>
    </MenuFrame>
  );
}
