/** Buildings: level, what it does now and at the next level, cost, Upgrade. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { CountUp } from './countUp';
import { Icon } from '../adventure/icons';
import { affordFrac, fmtNum } from './hearthModel';
import type { PanelProps } from './panelTypes';
import type { BuildingView } from '../../app/hearth';

/** True for a moment after `level` rises, to flash the card. */
function useFlash(level: number): boolean {
  const [on, setOn] = useState(false);
  const last = useRef(level);
  useEffect(() => {
    if (level > last.current) {
      setOn(true);
      const t = setTimeout(() => setOn(false), 1000);
      last.current = level;
      return () => clearTimeout(t);
    }
    last.current = level;
  }, [level]);
  return on;
}

function BuildingCard(p: { b: BuildingView; embers: number; onUpgrade(): void }) {
  const { b } = p;
  const flash = useFlash(b.level);
  const atMax = b.cost === null;
  return (
    <article class={`hx-card${flash ? ' flash' : ''}`} aria-label={b.name}>
      {flash ? (
        <span class="hx-plus" aria-hidden="true">
          +1
        </span>
      ) : null}
      <h4>
        <span>{b.name}</span>
        <span class="hx-lv" title={`Level ${b.level} of ${b.maxLevel}`}>
          Lv <CountUp value={b.level} /> <small>/ {b.maxLevel}</small>
        </span>
      </h4>
      <p class="mn-muted">{b.text}</p>
      <dl class="hx-now">
        <dt>Now</dt>
        <dd>{b.now}</dd>
        <dt>{atMax ? '' : 'Next'}</dt>
        <dd class="next">{b.next ?? 'At its highest level'}</dd>
      </dl>
      {atMax ? null : (
        <>
          <div
            class="hx-bar"
            role="meter"
            aria-label="Embers toward the next level"
            aria-valuenow={Math.round(affordFrac(p.embers, b.cost) * 100)}
          >
            <i style={`--f:${affordFrac(p.embers, b.cost)}`} />
          </div>
          <div class="hx-row between">
            <button
              type="button"
              class={`mn-btn hx-btn${b.blocker ? '' : ' gold'}`}
              disabled={b.blocker !== null}
              onClick={p.onUpgrade}
            >
              <Icon kind="ember" cls="ad-ico hx-btn-ico" /> {b.level === 0 ? 'Build' : 'Upgrade'} ·{' '}
              {fmtNum(b.cost!)}
            </button>
          </div>
        </>
      )}
      {b.blocker && !atMax ? <p class="hx-why">{b.blocker}</p> : null}
    </article>
  );
}

export function BuildingsPanel(p: PanelProps) {
  return (
    <div class="hx-grid wide">
      {p.snap.buildings.map((b) => (
        <BuildingCard
          key={b.id}
          b={b}
          embers={p.snap.summary.embers}
          onUpgrade={() => p.act({ kind: 'hearthUpgrade', building: b.id })}
        />
      ))}
    </div>
  );
}

/** One building's card, for the station screens: upgrade it without leaving the screen. */
export function BuildingUpgrade(p: PanelProps & { id: BuildingView['id'] }) {
  const b = p.snap.buildings.find((x) => x.id === p.id);
  if (!b) return null;
  return (
    <>
      <h3 class="hx-sub">The building</h3>
      <div class="hx-grid one">
        <BuildingCard
          b={b}
          embers={p.snap.summary.embers}
          onUpgrade={() => p.act({ kind: 'hearthUpgrade', building: b.id })}
        />
      </div>
    </>
  );
}
