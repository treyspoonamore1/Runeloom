/**
 * HUD additions for adventure mode: level and XP, keys / Heart Seeds / Loom Shards, pickup and
 * level-up toasts, the boss bar with phase marks, room banners and the death screen. Driven by
 * sim events (hudEvents.ts HUD_EVENT) and a per-frame snapshot (hudAdapter.ts).
 */
import { filterAction } from '../../app/lootFilterStore';
import type { LootContent } from '../../sim/items/loot';
import { signal } from '@preact/signals';
import { uiTuning } from '../../../data/ui';
import { getRune } from '../../../data/runes';
import type { SimEvent } from '../../sim';
import type { Session } from '../../app/session';
import { heroRev } from '../heroAdapter';
import { itemDescription, partName } from '../inventory/adapter';
import { Icon, type IconKind } from './icons';
import {
  BOSS_INFO,
  readAdventure,
  regionOf,
  REGION_NAMES,
  respawnName,
  roomName,
  type AdventureSnap,
} from './hudAdapter';
import {
  bannersFor,
  HUD_EVENT,
  pushToasts,
  roomBanner,
  toastsFor,
  type LiveToast,
  type LooseEvent,
  type ToastKind,
} from './hudEvents';
import { injectAdventureHudStyle } from './advStyle';

export interface AdventureHud {
  handleEvents(events: readonly SimEvent[]): void;
  frame(): void;
  readonly snap: { value: AdventureSnap };
}

const TOAST_ICON: Record<ToastKind, IconKind> = {
  rune: 'rune',
  item: 'charm',
  part: 'part',
  scrap: 'scrap',
  currency: 'currency',
  key: 'key',
  bigKey: 'bigKey',
  heart: 'heart',
  shard: 'shard',
  level: 'level',
  stone: 'stone',
  door: 'key',
};

const toasts = signal<LiveToast[]>([]);
let nextToast = 0;
/** Screenshots: keep toasts until the next ones (a software-GL capture takes longer than a toast lives). */
let hold = false;
export function holdToasts(on: boolean): void {
  hold = on;
}
const nowSec = (): number => performance.now() / 1000;

const sameSnap = (a: AdventureSnap, b: AdventureSnap): boolean =>
  a.level === b.level &&
  a.xp === b.xp &&
  a.xpFrac === b.xpFrac &&
  a.keys === b.keys &&
  a.bigKey === b.bigKey &&
  a.heartSeeds === b.heartSeeds &&
  a.loomShards === b.loomShards &&
  (a.boss === b.boss ||
    (!!a.boss &&
      !!b.boss &&
      a.boss.name === b.boss.name &&
      a.boss.lifeFrac === b.boss.lifeFrac &&
      a.boss.phase === b.boss.phase));

export function createAdventureHud(opts: {
  session: Session;
  showBanner(title: string, sub: string): void;
  /** Called when a Loom Stone wakes or becomes the respawn point again. */
  onLoomStone?(): void;
}): AdventureHud {
  injectAdventureHudStyle();
  const { session } = opts;
  const snap = signal(readAdventure(session));
  const names = {
    hidden: (c: LootContent) => filterAction(c) === 'hide',
    rune: (id: string) => getRune(id)?.name ?? id,
    item: (it: Parameters<typeof itemDescription>[0]) => {
      const d = itemDescription(it);
      return { name: d.name, rarity: d.rarity };
    },
    part: partName,
  };
  return {
    snap,
    handleEvents(events) {
      if (session.state.mode !== 'adventure') return;
      const loose = events as unknown as readonly LooseEvent[];
      for (const e of loose) {
        if (e.type === HUD_EVENT.roomEnter) {
          const id = String(e.id ?? session.state.room.id);
          const b = roomBanner(
            typeof e.name === 'string' && e.name ? e.name : roomName(session, id),
            REGION_NAMES[regionOf(id)] ?? '',
            typeof e.level === 'number' ? e.level : session.state.room.level,
          );
          opts.showBanner(b.title, b.sub);
        } else if (e.type === HUD_EVENT.loomStone) opts.onLoomStone?.();
      }
      // @note texts (K10's ending line) and boss kills take the banner after the room's.
      for (const b of bannersFor(loose, (k) => BOSS_INFO[k]?.name ?? k)) opts.showBanner(b.title, b.sub);
      const fresh = toastsFor(loose, names);
      if (fresh.length) {
        heroRev.value++;
        toasts.value = pushToasts(toasts.peek(), fresh, nowSec(), {
          seconds: uiTuning.toastSeconds,
          levelSeconds: uiTuning.levelToastSeconds,
          mergeWindow: uiTuning.toastMergeSeconds,
          max: uiTuning.maxToasts,
          nextId: () => ++nextToast,
        });
      }
    },
    frame() {
      if (session.state.mode !== 'adventure') return;
      const next = readAdventure(session);
      if (!sameSnap(snap.peek(), next)) snap.value = next;
      const t = toasts.peek();
      if (!hold && t.length && t[0]!.until <= nowSec()) toasts.value = t.filter((x) => x.until > nowSec());
    },
  };
}

function Counter(p: { kind: IconKind; n: number; label: string }) {
  return (
    <span class="ad-count" title={p.label} aria-label={`${p.label}: ${p.n}`}>
      <Icon kind={p.kind} />
      <b>{p.n}</b>
    </span>
  );
}

export function AdventureHudView({ snap }: { snap: { value: AdventureSnap } }) {
  const s = snap.value;
  return (
    <>
      <div class="ad-plate" aria-label="Character">
        <div class="ad-level" title="Level">
          <Icon kind="level" />
          <b class="rl-outline">{s.level}</b>
        </div>
        <div class="ad-right">
          <div
            class="ad-xp"
            role="meter"
            aria-label="Experience"
            aria-valuenow={s.xp}
            aria-valuemax={s.xpNext}
          >
            <i style={`--f:${s.xpFrac}`} />
            <span>
              {s.xp.toLocaleString('en-US')} / {s.xpNext.toLocaleString('en-US')} XP
            </span>
          </div>
          <div class="ad-counts">
            {s.keys !== null ? <Counter kind="key" n={s.keys} label="Small keys for this dungeon" /> : null}
            {s.bigKey ? <Counter kind="bigKey" n={1} label="Big key" /> : null}
            <Counter kind="heart" n={s.heartSeeds} label="Heart Seeds" />
            <Counter kind="shard" n={s.loomShards} label="Loom Shards" />
          </div>
        </div>
      </div>
      {s.boss ? (
        <div
          class="ad-boss"
          role="meter"
          aria-label={`${s.boss.name} life`}
          aria-valuenow={Math.round(s.boss.lifeFrac * 100)}
        >
          <div class="ad-boss-name rl-outline">
            {s.boss.name}
            {s.boss.marks.length ? <small>Phase {s.boss.phase}</small> : null}
          </div>
          <div class="ad-boss-bar">
            <i style={`--f:${s.boss.lifeFrac}`} />
            {s.boss.marks.map((m) => (
              <b key={m} class={s.boss!.lifeFrac < m ? 'past' : ''} style={`left:${m * 100}%`} />
            ))}
          </div>
        </div>
      ) : null}
      <div class="ad-toasts" aria-live="polite">
        {toasts.value.map((t) => (
          <div
            key={`${t.id}-${t.amount}`}
            class={`ad-toast k-${t.kind}${t.rarity ? ` r-${t.rarity}` : ''}`}
            style={`--out:${Math.max(0, (t.kind === 'level' ? uiTuning.levelToastSeconds : uiTuning.toastSeconds) - 0.5)}s`}
          >
            <span class="ad-toast-ico">
              <Icon kind={TOAST_ICON[t.kind]} />
            </span>
            <span class="ad-toast-txt">
              <b>{t.title}</b>
              {t.sub ? <small>{t.sub}</small> : null}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function AdventureDeath({ session, seconds }: { session: Session; seconds: number }) {
  const where = respawnName(session);
  return (
    <div class="rl-dead ad-dead" role="alert">
      <div>
        <h2>You fell.</h2>
        <p>
          Rewoven {where ? `at the Loom Stone in ${where}` : 'at the last Loom Stone'} in {seconds}…
        </p>
        <small>Your gear, runes and progress are safe. Rooms you cleared fill with enemies again.</small>
      </div>
    </div>
  );
}
