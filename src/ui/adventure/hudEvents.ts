/**
 * Pure adventure-HUD logic (no DOM): which sim events the HUD reacts to, and the toasts and
 * banners they become.
 *
 * HUD_EVENT names the events the HUD listens for: the world's (src/sim/world/worldEvents.ts)
 * and the hero's (src/sim/hero/events.ts). The fields each one reads are listed with it.
 */
import { currencies } from '../../../data/currency';
import type { LootContent } from '../../sim/items/loot';
import type { ItemRarity } from '../../sim/hero/types';

export const HUD_EVENT = {
  // ---- World (WorldEvent) ----
  /** { id, name, level, firstVisit }: after a transition, state.room is the new room. */
  roomEnter: 'roomEnter',
  /** { id, first }: the room's enemies are all dead; first: its rewards were paid now. */
  roomCleared: 'roomCleared',
  /** { dungeon, big, count }: a chest gave a small key (or the dungeon's big key). */
  chestOpened: 'chestOpened',
  /** { dungeon, big, left }: a key opened a locked door. */
  keyUsed: 'keyUsed',
  /** { kind: 'heart_seed' | 'loom_shard', total }: a Heart Seed or Loom Shard was taken. */
  pickup: 'pickup',
  /** { roomId, key, first }: the player touched a Loom Stone (first: activated now). */
  loomStone: 'loomStoneActivated',
  /** { kind, link }: a door opened (puzzle condition met, or a key). */
  doorOpened: 'doorOpened',
  /** { text }: an object with an @note activated (K10's "The Fen isn't woven yet."). */
  note: 'note',
  /** { roomId, key }: rested at a Loom Stone. */
  rested: 'rested',
  /** { kind, roomId }: a boss died. */
  bossDefeated: 'bossDefeated',
  // ---- Hero (HeroEvent) ----
  /** { amount, xp, level }: the XP bar reads the hero each frame; no toast. */
  xpGained: 'xpGained',
  /** { level }: the hero reached this level. */
  levelUp: 'levelUp',
  /** { rune, level }: a socketed rune item leveled up. */
  runeLevelUp: 'runeLevelUp',
  /** { rune }: random drops can now roll this rune. */
  runeUnlocked: 'runeUnlocked',
  /** { content }: a first-clear reward went straight into the pouch (guaranteed runes, CONTENT §9.1). */
  rewardGranted: 'rewardGranted',
  /** { rune, source }: a first element rune: the item-get panel shows it instead of a toast. */
  elementUnlocked: 'elementUnlocked',
  /** { content }: a drop landed on the floor (the renderer draws it; no toast). */
  lootDropped: 'lootDropped',
  /** { content, onExit }: a floor drop was collected. */
  lootPicked: 'lootPicked',
} as const;

/** An event as the HUD reads it: a type plus loosely typed fields. */
export type LooseEvent = { type: string } & Record<string, unknown>;

export type ToastKind =
  | 'rune'
  | 'item'
  | 'part'
  | 'scrap'
  | 'currency'
  | 'key'
  | 'bigKey'
  | 'heart'
  | 'shard'
  | 'level'
  | 'stone'
  | 'door';

export interface ToastSpec {
  kind: ToastKind;
  title: string;
  sub: string;
  rarity: ItemRarity | null;
  /** For merging repeated pickups ("+5 Thread Scrap"). */
  amount: number;
}

export interface ToastNames {
  rune(id: string): string;
  item(content: Extract<LootContent, { kind: 'item' }>['item']): { name: string; rarity: ItemRarity };
  part(content: Extract<LootContent, { kind: 'part' }>['part']): string;
}

const toast = (
  kind: ToastKind,
  title: string,
  sub = '',
  rarity: ItemRarity | null = null,
  amount = 1,
): ToastSpec => ({
  kind,
  title,
  sub,
  rarity,
  amount,
});

function contentToast(c: LootContent, names: ToastNames, runeSub: string): ToastSpec {
  if (c.kind === 'rune') return toast('rune', names.rune(c.rune.rune), runeSub);
  if (c.kind === 'item') {
    const d = names.item(c.item);
    return toast('item', d.name, `${cap(d.rarity)} item`, d.rarity);
  }
  if (c.kind === 'part') return toast('part', names.part(c.part), 'Fuse part');
  if (c.kind === 'currency')
    return toast(
      'currency',
      `${c.amount > 1 ? `${c.amount}× ` : ''}${currencies[c.currency].name}`,
      'Currency',
    );
  return toast('scrap', `+${c.amount} Thread Scrap`, '', null, c.amount);
}

/** The toasts one batch of events makes, in order. */
export function toastsFor(events: readonly LooseEvent[], names: ToastNames): ToastSpec[] {
  const out: ToastSpec[] = [];
  // A first-clear reward that also unlocks its rune makes one toast, not two; a first element
  // rune makes none (the item-get panel, src/ui/itemGet, is its moment).
  const rewarded = new Set<string>();
  const moments = new Set<string>();
  for (const e of events) {
    const c = e.content as LootContent | undefined;
    if (e.type === HUD_EVENT.rewardGranted && c?.kind === 'rune') rewarded.add(c.rune.rune);
    else if (e.type === HUD_EVENT.elementUnlocked) moments.add(String(e.rune));
  }
  for (const e of events) {
    switch (e.type) {
      case HUD_EVENT.lootPicked: {
        const c = e.content as LootContent | undefined;
        if (c) out.push(contentToast(c, names, 'Rune · into your pouch'));
        break;
      }
      case HUD_EVENT.rewardGranted: {
        const c = e.content as LootContent | undefined;
        if (c?.kind === 'rune' && moments.has(c.rune.rune)) break;
        if (c?.kind === 'rune')
          out.push(
            toast(
              'rune',
              `New rune: ${names.rune(c.rune.rune)}`,
              'In your pouch · weave it in the Loom (Tab)',
            ),
          );
        else if (c) out.push(contentToast(c, names, ''));
        break;
      }
      case HUD_EVENT.runeUnlocked:
        if (!rewarded.has(String(e.rune)) && !moments.has(String(e.rune)))
          out.push(toast('rune', names.rune(String(e.rune)), 'New rune unlocked'));
        break;
      case HUD_EVENT.runeLevelUp:
        out.push(toast('rune', `${names.rune(String(e.rune))} level ${Number(e.level)}`, 'Rune leveled up'));
        break;
      case HUD_EVENT.chestOpened:
        out.push(
          e.big
            ? toast('bigKey', 'Big key', 'Opens the boss door')
            : toast('key', 'Small key', 'Opens one locked door'),
        );
        break;
      case HUD_EVENT.keyUsed:
        if (!e.big)
          out.push(toast('key', 'Key used', plural(Number(e.left ?? 0), 'small key', 'small keys')));
        break;
      case HUD_EVENT.pickup:
        out.push(
          e.kind === 'heart_seed'
            ? toast('heart', 'Heart Seed', '+8 maximum life')
            : toast('shard', 'Loom Shard', '+1 Capacity on every spindle'),
        );
        break;
      case HUD_EVENT.loomStone:
        if (e.first) out.push(toast('stone', 'Loom Stone woken', 'Respawn point · rest and travel with M'));
        break;
      case HUD_EVENT.rested:
        out.push(toast('stone', 'Rested', 'Life and mana restored · enemies return'));
        break;
      case HUD_EVENT.doorOpened:
        out.push(toast('door', 'A door opened'));
        break;
      case HUD_EVENT.roomCleared:
        if (e.first) out.push(toast('level', 'Room cleared'));
        break;
      case HUD_EVENT.levelUp:
        out.push(toast('level', `Level ${Number(e.level)}`, 'Passive point available · press P'));
        break;
    }
  }
  return out;
}

/**
 * Center-screen banners besides the room banner: @note texts and boss kills. `bossName` turns
 * an enemy kind into a display name.
 */
export function bannersFor(
  events: readonly LooseEvent[],
  bossName: (kind: string) => string,
): { title: string; sub: string }[] {
  const out: { title: string; sub: string }[] = [];
  for (const e of events) {
    if (e.type === HUD_EVENT.note) out.push({ title: String(e.text ?? ''), sub: '' });
    else if (e.type === HUD_EVENT.bossDefeated)
      out.push({ title: `${bossName(String(e.kind))} defeated`, sub: '' });
  }
  return out;
}

export interface LiveToast extends ToastSpec {
  id: number;
  /** Wall-clock seconds when it leaves. */
  until: number;
}

/**
 * Adds new toasts to the live list: a Thread Scrap pickup within `mergeWindow` of the last one
 * adds to it, and only the newest `max` stay.
 */
export function pushToasts(
  live: readonly LiveToast[],
  incoming: readonly ToastSpec[],
  now: number,
  opts: { seconds: number; levelSeconds: number; mergeWindow: number; max: number; nextId: () => number },
): LiveToast[] {
  let list = live.filter((t) => t.until > now);
  for (const t of incoming) {
    const last = list[list.length - 1];
    const life = t.kind === 'level' ? opts.levelSeconds : opts.seconds;
    if (t.kind === 'scrap' && last?.kind === 'scrap' && last.until - opts.seconds + opts.mergeWindow > now) {
      const amount = last.amount + t.amount;
      list = [...list.slice(0, -1), { ...last, amount, title: `+${amount} Thread Scrap`, until: now + life }];
      continue;
    }
    list = [...list, { ...t, id: opts.nextId(), until: now + life }];
  }
  return list.slice(-opts.max);
}

/** Banner for entering a room: its name, then the region and area level. */
export function roomBanner(name: string, region: string, level: number): { title: string; sub: string } {
  return { title: name, sub: `${region} · area level ${level}` };
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many} left`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
