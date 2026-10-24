/** Rekindle (a two-step confirmation) and Mutations bought with Ash. */
import { useState } from 'preact/hooks';
import { Icon } from '../adventure/icons';
import { Dialog } from '../menus/frame';
import { CountUp } from './countUp';
import type { MutationView } from '../../app/hearth';
import type { PanelProps } from './panelTypes';

function Confirm(p: PanelProps & { onCancel(): void; onDone(): void }) {
  const r = p.snap.rekindle;
  const go = () => {
    if (p.act({ kind: 'rekindle' }, `Rekindled: +${r.ash} Ash`)) p.onDone();
  };
  return (
    <Dialog title="Rekindle the Hearth?" onCancel={p.onCancel}>
      <p>
        You gain <b class="hx-ember">{r.ash} Ash</b>, and rifts will open up to tier <b>{r.nextMaxTier}</b>{' '}
        (now {r.maxTier}).
      </p>
      <div class="hx-lists">
        <div class="resets">
          <h5>This resets</h5>
          <ul>
            {r.resets.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
        <div class="keeps">
          <h5>You keep</h5>
          <ul>
            {r.keeps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
      <p class="mn-muted">Expeditions already out still return as normal. This can't be undone.</p>
      <div class="mn-acts">
        <button type="button" class="mn-btn" onClick={p.onCancel}>
          Cancel
        </button>
        <button type="button" class="mn-btn danger" onClick={go}>
          Rekindle for {r.ash} Ash
        </button>
      </div>
    </Dialog>
  );
}

function MutationCard(p: { m: MutationView; onBuy(): void }) {
  const { m } = p;
  const maxed = m.cost === null;
  return (
    <article class={`hx-card${maxed ? ' owned' : ''}`} aria-label={m.name}>
      <h4>
        <span>{m.name}</span>
        {m.max > 1 ? (
          <span class="hx-pips" aria-label={`${m.count} of ${m.max}`}>
            {Array.from({ length: m.max }, (_, i) => (
              <i key={i} class={i < m.count ? 'on' : ''} />
            ))}
          </span>
        ) : (
          <small>{m.count > 0 ? 'Owned' : ''}</small>
        )}
      </h4>
      <p class="mn-muted">{m.text}</p>
      {maxed ? null : (
        <button
          type="button"
          class={`mn-btn hx-btn${m.blocker ? '' : ' gold'}`}
          disabled={m.blocker !== null}
          onClick={p.onBuy}
        >
          <Icon kind="ash" cls="ad-ico hx-btn-ico" /> Buy · {m.cost} Ash
        </button>
      )}
      {m.blocker && !maxed ? <p class="hx-why">{m.blocker}</p> : null}
    </article>
  );
}

export function RekindlePanel(p: PanelProps) {
  const [confirming, setConfirming] = useState(false);
  const r = p.snap.rekindle;
  const sum = p.snap.summary;
  return (
    <>
      <div class="hx-split">
        <section class="hx-card" aria-label="Rekindle">
          <h4>
            <span>Rekindle</span>
            <small>{sum.rekindles === 0 ? 'Never rekindled' : `Rekindled ${sum.rekindles}×`}</small>
          </h4>
          <div class="hx-row">
            <Icon kind="ash" cls="ad-ico hx-btn-ico" />
            <span>
              <span class="hx-cap">Ash held</span>
              <span class="hx-big">
                <CountUp value={sum.ash} />
              </span>
            </span>
          </div>
          <dl class="hx-now">
            <dt>Gives now</dt>
            <dd class="next">{r.ash > 0 ? `+${r.ash} Ash` : 'Nothing yet'}</dd>
            <dt>Rift cap</dt>
            <dd>
              tier {r.maxTier} <span class="next">→ {r.nextMaxTier}</span>
            </dd>
          </dl>
          <p class="mn-muted">Burn the Hearth down to rebuild it hotter. Ash is permanent.</p>
          <button
            type="button"
            class={`mn-btn hx-btn${r.blocker ? '' : ' danger'}`}
            disabled={r.blocker !== null}
            onClick={() => setConfirming(true)}
          >
            Rekindle…
          </button>
          {r.blocker ? <p class="hx-why">{r.blocker}</p> : null}
        </section>
        <section aria-label="Mutations">
          <h3 class="hx-sub">Mutations</h3>
          <div class="hx-grid">
            {p.snap.mutations.map((m) => (
              <MutationCard
                key={m.id}
                m={m}
                onBuy={() => p.act({ kind: 'mutationBuy', mutation: m.id }, `${m.name} bought`)}
              />
            ))}
          </div>
        </section>
      </div>
      {confirming ? (
        <Confirm {...p} onCancel={() => setConfirming(false)} onDone={() => setConfirming(false)} />
      ) : null}
    </>
  );
}
