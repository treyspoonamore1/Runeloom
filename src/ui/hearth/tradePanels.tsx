/** The Salvage Loom's setting and the Spindlewright's shop. */
import { currencies } from '../../../data/currency';
import type { SalvageSetting } from '../../sim/meta/types';
import { Icon } from '../adventure/icons';
import { CountUp } from './countUp';
import { fmtNum } from './hearthModel';
import { BuildingUpgrade } from './buildingsPanel';
import type { PanelProps } from './panelTypes';

const SALVAGE_LABEL: Record<SalvageSetting, { name: string; text: string }> = {
  off: { name: 'Off', text: 'Pick everything up' },
  normal: { name: 'Normal', text: 'Salvage Normal gear' },
  magic: { name: 'Magic', text: 'Normal and Magic gear' },
  rare: { name: 'Rare', text: 'Normal, Magic and Rare gear' },
};
const ORDER: readonly SalvageSetting[] = ['off', 'normal', 'magic', 'rare'];

export function SalvagePanel(p: PanelProps) {
  const s = p.snap.salvage;
  const b = p.snap.buildings.find((x) => x.id === 'salvage_loom');
  if (!b || b.level <= 0)
    return (
      <p class="hx-away">
        Build the Salvage Loom in Buildings first. It turns gear you pick up into Thread Scrap.
      </p>
    );
  return (
    <>
      <p class="mn-muted">
        Gear you pick up at or below this rarity becomes Thread Scrap on the spot, and never uniques. Now:{' '}
        <b>{b.now}</b>.
      </p>
      <div class="hx-chips" role="radiogroup" aria-label="Salvage up to">
        {s.options.map((o) => {
          const locked = ORDER.indexOf(o) > ORDER.indexOf(s.cap);
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={s.setting === o}
              class={`hx-chip${s.setting === o ? ' on' : ''}`}
              disabled={locked}
              title={locked ? 'Upgrade the Salvage Loom' : SALVAGE_LABEL[o].text}
              onClick={() => s.setting !== o && p.act({ kind: 'salvageSetting', setting: o })}
            >
              {SALVAGE_LABEL[o].name}
              <small>{locked ? 'Upgrade the Salvage Loom' : SALVAGE_LABEL[o].text}</small>
            </button>
          );
        })}
      </div>
      {s.cap !== 'rare' ? (
        <p class="hx-why soft">
          Higher levels unlock higher rarities (Magic at level 4, Rare at level 8). Upgrade it in Buildings.
        </p>
      ) : null}
      <BuildingUpgrade {...p} id="salvage_loom" />
    </>
  );
}

export function SpindlewrightPanel(p: PanelProps & { onBench(): void }) {
  return (
    <>
      <div class="hx-row between">
        <span class="hx-row">
          <Icon kind="scrap" cls="ad-ico hx-btn-ico" />
          <span>
            <span class="hx-cap">Thread Scrap held</span>
            <span class="hx-big">
              <CountUp value={p.snap.scrap} />
            </span>
          </span>
        </span>
        <button type="button" class="mn-btn gold" onClick={p.onBench}>
          Crafting Bench <kbd>C</kbd>
        </button>
      </div>
      <div class="hx-wares">
        {p.snap.trade.map((t) => {
          const poor = p.snap.scrap < t.price;
          return (
            <div class="hx-ware" key={t.currency}>
              <span>
                <b>{t.name}</b>
                <small>{currencies[t.currency].text}</small>
              </span>
              <span class="hx-owned">
                Owned <b class="hx-num">{fmtNum(t.owned)}</b>
              </span>
              <button
                type="button"
                class={`mn-btn hx-btn${poor ? '' : ' gold'}`}
                disabled={poor}
                title={poor ? `Needs ${t.price} Thread Scrap` : undefined}
                onClick={() => p.act({ kind: 'spindlewrightBuy', currency: t.currency })}
              >
                <Icon kind="scrap" cls="ad-ico hx-btn-ico" /> {t.price}
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
