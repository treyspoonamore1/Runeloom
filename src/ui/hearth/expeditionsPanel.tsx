/** Expedition Board: Weavers, sending by tier, the live list of expeditions out and ready. */
import { Icon } from '../adventure/icons';
import { expeditionRows, rewardText, sendOptions } from './hearthModel';
import { BuildingUpgrade } from './buildingsPanel';
import type { PanelProps } from './panelTypes';

export function ExpeditionsPanel(p: PanelProps) {
  const b = p.snap.board;
  const level = p.snap.buildings.find((x) => x.id === 'expedition_board')?.level ?? 0;
  if (level <= 0)
    return (
      <p class="hx-away">
        Build the Expedition Board in Buildings first. Hired Weavers run rifts for you and bring back Fuse
        parts, currency, Rift Sigils and Embers.
      </p>
    );
  const rows = expeditionRows(b.expeditions);
  const options = sendOptions(b.maxTier, b.seconds);
  return (
    <>
      <div class="hx-row between">
        <span class="hx-row">
          <span class="hx-weavers" aria-label={`${b.free} of ${b.weavers} Weavers free`}>
            {Array.from({ length: b.weavers }, (_, i) => (
              <span key={i} class={i < b.free ? '' : 'busy'}>
                <Icon kind="weaver" />
              </span>
            ))}
          </span>
          <b class="hx-num">{b.free}</b> of {b.weavers} Weavers free
        </span>
        <small class="mn-muted">Higher tiers take longer and pay more</small>
      </div>
      <h3 class="hx-sub">Send a Weaver</h3>
      <div class="hx-chips" role="group" aria-label="Rift tier to send a Weaver on">
        {options.map((o) => (
          <button
            key={o.tier}
            type="button"
            class="hx-chip"
            disabled={b.free <= 0}
            title={`Brings back ${rewardText(b.rewards(o.tier))}`}
            onClick={() =>
              p.act({ kind: 'expeditionSend', tier: o.tier }, `A Weaver set out on a tier ${o.tier} rift`)
            }
          >
            Tier {o.tier}
            <small>{o.text}</small>
          </button>
        ))}
      </div>
      {b.free <= 0 ? (
        <p class="hx-why soft">Every Weaver is out. Collect a returned one, or upgrade the Board for more.</p>
      ) : null}
      {b.maxTier < 2 ? <p class="mn-help">Complete higher rifts to send Weavers on higher tiers.</p> : null}
      <h3 class="hx-sub">Out and returned</h3>
      {rows.length === 0 ? <p class="mn-muted">No Weavers are out.</p> : null}
      <div class="hx-grid">
        {rows.map((r) => (
          <article
            key={r.uid}
            class={`hx-card${r.ready ? ' ready' : ''}`}
            aria-label={`Tier ${r.tier} expedition`}
          >
            <h4>
              <span>Tier {r.tier} rift</span>
              <small>{r.ready ? 'Back' : 'Out'}</small>
            </h4>
            <div
              class={`hx-bar${r.ready ? ' done' : ''}`}
              role="meter"
              aria-label="Expedition progress"
              aria-valuenow={Math.round(r.frac * 100)}
            >
              <i style={`--f:${r.frac}`} />
            </div>
            <p class={r.ready ? '' : 'mn-muted'}>{r.text}</p>
            <p class="mn-muted">
              {r.ready ? 'Brings' : 'Will bring'}: {rewardText(b.rewards(r.tier))}
            </p>
            <button
              type="button"
              class={`mn-btn hx-btn${r.ready ? ' gold' : ''}`}
              disabled={!r.ready}
              onClick={() =>
                p.act({ kind: 'expeditionCollect', uid: r.uid }, 'Collected: parts, currency and Embers')
              }
            >
              Collect
            </button>
          </article>
        ))}
      </div>
      <BuildingUpgrade {...p} id="expedition_board" />
    </>
  );
}
