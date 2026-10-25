/**
 * Pure character-sheet logic (no DOM): the stat rows HeroMods add up to, and "if you equip this"
 * comparisons that diff the rows of the hero against a copy with one item swapped in.
 */
import { isSpindleId, spindles } from '../../../data/spindles';
import type { Tuning } from '../../../data/tuning';
import type { HeroMods } from '../../sim/hero/mods';
import type { EquipSlot, HeroState, Item } from '../../sim/hero/types';

export type StatGroup = 'Vitals' | 'Offense' | 'Weaving' | 'Defense' | 'Ailments & terrain';

export interface StatRow {
  key: string;
  group: StatGroup;
  label: string;
  value: number;
  /** Display text for the value. */
  text: string;
  /** Whether more is better (mana cost reduced: more is better too). */
  higherIsBetter: boolean;
}

const pct = (v: number, plus = false): string => `${plus && v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const num = (v: number): string =>
  Number.isInteger(Math.round(v * 100) / 100) ? String(Math.round(v)) : v.toFixed(2);

export function equippedItem(hero: Readonly<HeroState>, slot: EquipSlot): Item | null {
  const uid = hero.equipped[slot];
  return uid === null ? null : (hero.items.find((i) => i.uid === uid) ?? null);
}

/**
 * Every row of the character sheet, in display order. Rows that are 0 and optional are left out
 * unless `all` (the sheet's hover preview uses it to place rows that appear when an item is swapped in).
 */
export function statRows(
  hero: Readonly<HeroState>,
  m: Readonly<HeroMods>,
  t: Tuning,
  all = false,
): StatRow[] {
  const c = t.combat;
  const sp = equippedItem(hero, 'spindle');
  const base = sp && isSpindleId(sp.base) ? spindles[sp.base] : null;
  const life =
    (c.playerBaseLife + c.playerLifePerLevel * (hero.level - 1) + m.maxLifeAdd) * (1 + m.maxLifeInc);
  const mana =
    (c.playerBaseMana + c.playerManaPerLevel * (hero.level - 1) + m.maxManaAdd) * (1 + m.maxManaInc);
  const rows: StatRow[] = [];
  const row = (
    key: string,
    group: StatGroup,
    label: string,
    value: number,
    text: string,
    opt = false,
    higherIsBetter = true,
  ) => {
    if (opt && value === 0 && !all) return;
    rows.push({ key, group, label, value, text, higherIsBetter });
  };
  row('life', 'Vitals', 'Maximum life', Math.round(life), String(Math.round(life)));
  row('mana', 'Vitals', 'Maximum mana', Math.round(mana), String(Math.round(mana)));
  const regen = mana * c.manaRegen + m.manaRegenAdd;
  row('regen', 'Vitals', 'Mana regeneration', Math.round(regen * 10) / 10, `${num(regen)} / s`);
  row('fireInc', 'Offense', 'Increased Fire damage', m.damageInc.fire, pct(m.damageInc.fire), true);
  row('frostInc', 'Offense', 'Increased Frost damage', m.damageInc.frost, pct(m.damageInc.frost), true);
  row('stormInc', 'Offense', 'Increased Storm damage', m.damageInc.storm, pct(m.damageInc.storm), true);
  row(
    'physInc',
    'Offense',
    'Increased Physical damage',
    m.damageInc.physical,
    pct(m.damageInc.physical),
    true,
  );
  row('branchInc', 'Offense', 'Increased branch damage', m.branchDamageInc, pct(m.branchDamageInc), true);
  row('strikeFlat', 'Offense', 'Strike base damage', m.strikeFlatAdd, `+${m.strikeFlatAdd}`, true);
  row('crit', 'Offense', 'Added crit chance', m.critChanceAdd, pct(m.critChanceAdd, true), true);
  const capacity = (base?.capacity ?? 0) + m.capacityAdd;
  row('capacity', 'Weaving', 'Capacity', capacity, String(capacity));
  const castSpeed = (base?.castSpeed ?? t.player.castSpeed) * (1 + m.castSpeedInc);
  row('castSpeed', 'Weaving', 'Cast speed', Math.round(castSpeed * 100) / 100, `×${castSpeed.toFixed(2)}`);
  row('manaCost', 'Weaving', 'Reduced mana cost', m.manaCostReduced, pct(m.manaCostReduced), true);
  const cap = c.resistCap;
  for (const [k, label] of [
    ['fire', 'Fire'],
    ['frost', 'Frost'],
    ['storm', 'Storm'],
  ] as const) {
    const raw = m.resistAdd[k];
    const v = Math.min(cap, raw);
    row(`${k}Res`, 'Defense', `${label} resistance`, v, `${pct(v)}${raw > cap ? ` (${pct(raw)})` : ''}`);
  }
  row('move', 'Defense', 'Increased move speed', m.moveSpeedInc, pct(m.moveSpeedInc), true);
  const dodges = t.player.dodgeCharges + m.dodgeChargesAdd;
  row('dodges', 'Defense', 'Dodge charges', dodges, String(dodges));
  row('dodgeRecharge', 'Defense', 'Faster dodge recharge', m.dodgeRechargeInc, pct(m.dodgeRechargeInc), true);
  row(
    'projLess',
    'Defense',
    'Less projectile damage taken',
    m.projectileDamageTakenLess,
    pct(m.projectileDamageTakenLess),
    true,
  );
  row(
    'ailDur',
    'Ailments & terrain',
    'Increased ailment duration',
    m.ailmentDurationInc,
    pct(m.ailmentDurationInc),
    true,
  );
  row(
    'igniteEff',
    'Ailments & terrain',
    'Increased Ignite effect',
    m.igniteEffectInc,
    pct(m.igniteEffectInc),
    true,
  );
  row(
    'chillGain',
    'Ailments & terrain',
    'Increased chill build-up',
    m.chillGainInc,
    pct(m.chillGainInc),
    true,
  );
  row(
    'freezeDur',
    'Ailments & terrain',
    'Increased Freeze duration',
    m.freezeDurationInc,
    pct(m.freezeDurationInc),
    true,
  );
  row(
    'terrainDur',
    'Ailments & terrain',
    'Increased terrain duration',
    m.terrainDurationInc,
    pct(m.terrainDurationInc),
    true,
  );
  row('spread', 'Ailments & terrain', 'Increased fire spread', m.fireSpreadInc, pct(m.fireSpreadInc), true);
  return rows;
}

export interface StatDelta {
  /** The sheet row's key (StatRow.key). */
  key: string;
  label: string;
  /** The row's text before and after ("174", "12%"); "–" when the row is absent on that side. */
  from: string;
  to: string;
  /** "+12", "−8%", "×1.06 → ×1.12". */
  text: string;
  good: boolean;
}

/** The rows that differ between `before` and `after` (rows missing on one side count as 0). */
export function diffStats(before: readonly StatRow[], after: readonly StatRow[]): StatDelta[] {
  const keys: string[] = [];
  const b = new Map(before.map((r) => [r.key, r]));
  const a = new Map(after.map((r) => [r.key, r]));
  for (const r of [...after, ...before]) if (!keys.includes(r.key)) keys.push(r.key);
  const out: StatDelta[] = [];
  for (const k of keys) {
    const x = b.get(k);
    const y = a.get(k);
    const ref = (y ?? x)!;
    const d = (y?.value ?? 0) - (x?.value ?? 0);
    if (Math.abs(d) < 1e-9) continue;
    const isPct = ref.text.includes('%') && !ref.text.startsWith('×');
    const mag = isPct
      ? `${Math.round(Math.abs(d) * 100)}%`
      : ref.text.startsWith('×')
        ? Math.abs(d).toFixed(2)
        : num(Math.abs(d));
    if (mag === '0%' || mag === '0') continue;
    out.push({
      key: k,
      label: ref.label,
      from: x?.text ?? '–',
      to: y?.text ?? '–',
      text: `${d > 0 ? '+' : '−'}${mag}`,
      good: d > 0 === ref.higherIsBetter,
    });
  }
  return out;
}

/** A copy of the hero with `item` equipped in `slot` (the copy is shallow except `equipped`). */
export function withEquipped(hero: Readonly<HeroState>, item: Item, slot: EquipSlot): HeroState {
  const equipped = { ...hero.equipped };
  for (const s of Object.keys(equipped) as EquipSlot[]) if (equipped[s] === item.uid) equipped[s] = null;
  equipped[slot] = item.uid;
  return { ...hero, equipped };
}

/** The slot an unequipped item goes to on a click: its only slot, else the first empty one, else the first. */
export function targetSlot(hero: Readonly<HeroState>, slots: readonly EquipSlot[]): EquipSlot | null {
  if (slots.length === 0) return null;
  return slots.find((s) => hero.equipped[s] === null) ?? slots[0]!;
}

export interface Comparison {
  slot: EquipSlot;
  /** What is in that slot now (null: empty). */
  current: Item | null;
  deltas: StatDelta[];
}

/** "If you equip this": the target slot, what is there, and how the sheet would change. */
export function compareItem(
  hero: Readonly<HeroState>,
  item: Item,
  slots: readonly EquipSlot[],
  modsFor: (h: Readonly<HeroState>) => HeroMods,
  t: Tuning,
  /** The slot to compare in (the better swap for charms, upgrade.ts bestSlot); default: targetSlot. */
  into?: EquipSlot | null,
): Comparison | null {
  if (slots.some((s) => hero.equipped[s] === item.uid)) return null;
  const slot = into ?? targetSlot(hero, slots);
  if (!slot) return null;
  const after = withEquipped(hero, item, slot);
  const deltas = diffStats(statRows(hero, modsFor(hero), t), statRows(after, modsFor(after), t));
  return { slot, current: equippedItem(hero, slot), deltas };
}

/** A sheet row while an item is hovered: its change if equipped, and whether the row only exists after. */
export interface SheetRow extends StatRow {
  delta?: StatDelta;
  /** The row is absent now and appears when the item is equipped (its text shows "–"). */
  ghost?: boolean;
}

/**
 * The character sheet's rows, with each stat's change when `preview` (a hypothetical hero with the
 * hovered item swapped in) is given. Rows that only exist on one side are kept, in sheet order.
 */
export function sheetRows(
  hero: Readonly<HeroState>,
  mods: Readonly<HeroMods>,
  t: Tuning,
  preview?: { hero: Readonly<HeroState>; mods: Readonly<HeroMods> } | null,
): SheetRow[] {
  const now = statRows(hero, mods, t);
  if (!preview) return now;
  const then = statRows(preview.hero, preview.mods, t);
  const deltas = new Map(diffStats(now, then).map((d) => [d.key, d]));
  const a = new Map(now.map((r) => [r.key, r]));
  const b = new Map(then.map((r) => [r.key, r]));
  const out: SheetRow[] = [];
  for (const { key } of statRows(hero, mods, t, true)) {
    const cur = a.get(key);
    const nxt = b.get(key);
    if (!cur && !nxt) continue;
    const delta = deltas.get(key);
    out.push(cur ? { ...cur, delta } : { ...nxt!, text: '–', value: 0, ghost: true, delta });
  }
  return out;
}
