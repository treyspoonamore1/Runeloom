/**
 * Pure adventure-HUD logic (no DOM): which sim events the HUD reacts to, and the toasts and
 * banners they become.
 *
 * The M4 events don't exist yet; the hero/items and world agents add them. Their names and
 * fields aren't final, so every name the HUD listens for is in HUD_EVENT, with the fields it
 * reads. Rename here when the real events land.
 */
import type { LootContent } from '../../sim/items/loot';
import type { ItemRarity } from '../../sim/hero/types';

export const HUD_EVENT = {
  /** { roomId: string }: after a transition, state.room is the new room. */
  roomEnter: 'roomEnter',
  /** { content: LootContent }: a floor drop was collected. */
  lootPicked: 'lootPicked',
  /** { rune: RuneId }: a guaranteed first-clear rune (CONTENT §9.1), straight into the pouch. */
  runeGranted: 'runeGranted',
  /** { level: number }: the hero reached this level. */
  levelUp: 'levelUp',
  /** { dungeon: string, big?: boolean }: a small key (or the big key) was taken from a chest. */
  keyPicked: 'keyPicked',
  /** {}: a Heart Seed was taken (+8 max life). */
  heartSeed: 'heartSeedTaken',
  /** {}: a Loom Shard was taken (+1 Capacity). */
  loomShard: 'loomShardTaken',
  /** { roomId: string, key: string }: the player touched (activated or used) a Loom Stone. */
  loomStone: 'loomStoneTouched',
} as const;

/** An event as the HUD reads it: a type plus loosely typed fields (the real union is not final). */
export type LooseEvent = { type: string } & Record<string, unknown>;

export type ToastKind = 'rune' | 'item' | 'part' | 'scrap' | 'key' | 'bigKey' | 'heart' | 'shard' | 'level';

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

/** The toasts one batch of events makes, in order. */
export function toastsFor(events: readonly LooseEvent[], names: ToastNames): ToastSpec[] {
  const out: ToastSpec[] = [];
  for (const e of events) {
    switch (e.type) {
      case HUD_EVENT.lootPicked: {
        const c = e.content as LootContent | undefined;
        if (!c) break;
        if (c.kind === 'rune') out.push(toast('rune', names.rune(c.rune.rune), 'Rune · into your pouch'));
        else if (c.kind === 'item') {
          const d = names.item(c.item);
          out.push(toast('item', d.name, `${cap(d.rarity)} item`, d.rarity));
        } else if (c.kind === 'part') out.push(toast('part', names.part(c.part), 'Fuse part'));
        else out.push(toast('scrap', `+${c.amount} Thread Scrap`, '', null, c.amount));
        break;
      }
      case HUD_EVENT.runeGranted:
        out.push(toast('rune', names.rune(String(e.rune)), 'New rune unlocked'));
        break;
      case HUD_EVENT.keyPicked:
        out.push(
          e.big
            ? toast('bigKey', 'Big key', 'Opens the boss door')
            : toast('key', 'Small key', 'Opens one locked door'),
        );
        break;
      case HUD_EVENT.heartSeed:
        out.push(toast('heart', 'Heart Seed', '+8 maximum life'));
        break;
      case HUD_EVENT.loomShard:
        out.push(toast('shard', 'Loom Shard', '+1 Capacity on every spindle'));
        break;
      case HUD_EVENT.levelUp:
        out.push(toast('level', `Level ${Number(e.level)}`, 'Passive point available · press P'));
        break;
    }
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
