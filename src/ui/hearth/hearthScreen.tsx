/**
 * The Hearth menu (H, or a hub station's Interact): Buildings, Rune Garden, Expeditions, Salvage
 * Loom, Spindlewright, Rekindle and Mutations, and the Cartographer's rift list. The sim keeps
 * running while it is open in the hub (the HUD arranges that), so counters and timers move live.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Session } from '../../app/session';
import type { HearthEdit } from '../../sim/meta/edits';
import { fixtureHearthTick } from '../fixtures/hearthStore';
import { fixturesOn } from '../fixtures/mode';
import { Icon } from '../adventure/icons';
import { MenuFrame, note, type MenuId } from '../menus/frame';
import { injectMapStyle } from '../map/mapStyle';
import { canOpenRiftHere } from '../../app/hero';
import { RiftPanel } from '../map/riftPanel';
import { readHearth, sendHearth } from './adapter';
import { BuildingsPanel } from './buildingsPanel';
import { CountUp } from './countUp';
import { ExpeditionsPanel } from './expeditionsPanel';
import { GardenPanel } from './gardenPanel';
import { HEARTH_TABS, fmtNum, tabAttention } from './hearthModel';
import { hearthPulse, hearthTab, type HearthTab } from './hearthSignals';
import { injectHearthStyle } from './hearthStyle';
import type { PanelProps } from './panelTypes';
import { RekindlePanel } from './rekindlePanel';
import { SalvagePanel, SpindlewrightPanel } from './tradePanels';

const TICK_MS = 250;

export function HearthScreen(p: { session: Session; onTab(id: MenuId): void; onClose(): void }) {
  injectHearthStyle();
  injectMapStyle();
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      if (fixturesOn.peek()) fixtureHearthTick(TICK_MS / 1000);
      hearthPulse.value++;
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
  void hearthPulse.value;
  const snap = readHearth(p.session);
  const tab = hearthTab.value;
  const sum = snap.summary;
  const attention = tabAttention(sum.expeditionsReady);
  const go = (t: HearthTab): void => {
    setErr(null);
    hearthTab.value = t;
  };
  const act: PanelProps['act'] = (edit: HearthEdit, ok?: string) => {
    const why = sendHearth(p.session, edit);
    setErr(why);
    if (why === null && ok) note(ok, true);
    return why === null;
  };
  const props: PanelProps = { session: p.session, snap, act };
  const cur = HEARTH_TABS.find((t) => t.id === tab) ?? HEARTH_TABS[0]!;
  return (
    <MenuFrame
      id="hearth"
      title="The Hearth"
      onTab={p.onTab}
      onClose={p.onClose}
      bodyClass="hx-body"
      rootClass="hx"
    >
      <nav class="mn-panel hx-nav" aria-label="Hearth">
        <div class="hx-wallet">
          <div class="hx-coin embers" title="Embers: drop from everything once the Hearth is lit">
            <Icon kind="ember" />
            <span>Embers</span>
            <CountUp value={sum.embers} />
          </div>
          <div class="hx-coin ash" title="Ash: from Rekindling; buys Mutations">
            <Icon kind="ash" />
            <span>Ash</span>
            <CountUp value={sum.ash} />
          </div>
          <div class="hx-coin" title="Thread Scrap">
            <Icon kind="scrap" />
            <span>Scrap</span>
            <CountUp value={snap.scrap} />
          </div>
        </div>
        <ul class="hx-rates" aria-label="Production">
          <li>
            Kindling Pit <b>{snap.rates.scrapPerMinute.toFixed(1)} Scrap / min</b>
          </li>
          <li>
            Rune Garden{' '}
            <b>
              {snap.rates.planted} × {fmtNum(snap.rates.runeXpPerMinute)} XP / min
            </b>
          </li>
          <li>
            Weavers{' '}
            <b>
              {snap.board.free} free of {snap.board.weavers}
            </b>
          </li>
        </ul>
        <div class="hx-tabs" role="tablist" aria-label="Hearth sections">
          {HEARTH_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              class="hx-tab"
              aria-selected={t.id === tab}
              onClick={() => go(t.id)}
            >
              {t.label}
              {attention[t.id] ? <span class="hx-badge">{attention[t.id]}</span> : null}
            </button>
          ))}
        </div>
      </nav>
      <section class="mn-panel hx-main" aria-label={cur.label}>
        <h3>
          {cur.label} <small>{cur.blurb}</small>
        </h3>
        <div class="mn-scroll">
          {!sum.lit ? (
            <p class="hx-away">The Hearth is not lit yet. Defeat the Cinder Warden.</p>
          ) : !sum.inHearth ? (
            <p class="hx-away">
              Travel to the Hearth to use it: fast-travel from any Loom Stone (M). You can look from here.
            </p>
          ) : null}
          {err ? (
            <p class="hx-err" role="alert">
              {err}
            </p>
          ) : null}
          <TabBody tab={tab} p={props} onBench={() => p.onTab('craft')} onClose={p.onClose} />
        </div>
      </section>
    </MenuFrame>
  );
}

function TabBody(p: { tab: HearthTab; p: PanelProps; onBench(): void; onClose(): void }) {
  switch (p.tab) {
    case 'buildings':
      return <BuildingsPanel {...p.p} />;
    case 'garden':
      return <GardenPanel {...p.p} />;
    case 'expeditions':
      return <ExpeditionsPanel {...p.p} />;
    case 'salvage':
      return <SalvagePanel {...p.p} />;
    case 'spindlewright':
      return <SpindlewrightPanel {...p.p} onBench={p.onBench} />;
    case 'rekindle':
      return <RekindlePanel {...p.p} />;
    case 'cartographer':
      return (
        <div class="hx-rifts">
          <RiftPanel session={p.p.session} standing={canOpenRiftHere(p.p.session)} onOpened={p.onClose} />
        </div>
      );
  }
}
