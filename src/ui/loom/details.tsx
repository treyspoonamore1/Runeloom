/** The Loom's right side: spindle, costs, validation, DPS readout and the damage breakdown. */
import { SANDBOX_SPINDLES, SLOT_LABELS } from '../../app/loadout';
import { spindles } from '../../../data/spindles';
import type { ReadoutResult } from '../../sim/weave/readout';
import { chipRune } from './model';
import { damageBreakdown, fmtNum, fmtPct, timingText } from './describe';
import { RuneGlyph } from './glyphs';
import type { LoomState } from './loomState';
import type { ReadoutView } from './readoutQueue';

function SpindlePicker({ st }: { st: LoomState }) {
  const cur = st.loadout.value.spindleId;
  return (
    <div class="lm-sec">
      <h4>Spindle</h4>
      <div class="lm-spindles" role="radiogroup" aria-label="Spindle">
        {SANDBOX_SPINDLES.map((id) => {
          const s = spindles[id];
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={cur === id}
              class={`lm-spindle${cur === id ? ' on' : ''}`}
              title={s.implicitText || 'No implicit'}
              onClick={() => st.setSpindle(id)}
            >
              <span class="lm-sp-name">{s.name.replace(' Spindle', '')}</span>
              <span class="lm-sp-cap">{s.capacity}</span>
            </button>
          );
        })}
      </div>
      <p class="lm-muted lm-sp-imp">
        {spindles[cur].name}: Capacity {spindles[cur].capacity}, cast speed ×
        {fmtNum(spindles[cur].castSpeed, 2)}
        {spindles[cur].implicitText ? `, ${spindles[cur].implicitText}` : ''}
      </p>
    </div>
  );
}

function Costs({ st }: { st: LoomState }) {
  const s = st.status;
  const cap = st.loadout.value.capacity;
  const costs = s.kind === 'ok' ? s.costs : s.kind === 'invalid' ? s.costs : null;
  const used = costs?.complexity ?? null;
  const over = used !== null && used > cap;
  const capErr = (s.kind === 'invalid' && s.path.length === 0) || over;
  const timing = s.kind === 'ok' ? timingText(s.program) : null;
  const segs = Math.max(cap, used ?? 0);
  return (
    <div class="lm-sec">
      <h4>Cost</h4>
      <div
        class={`lm-cxbar${capErr ? ' over' : ''}`}
        role="meter"
        aria-label="Complexity"
        aria-valuenow={used ?? 0}
        aria-valuemax={cap}
      >
        <div class="lm-cxlabel">
          <span>Complexity</span>
          <b>
            {used ?? '–'} / {cap}
          </b>
        </div>
        <div class="lm-cxsegs">
          {Array.from({ length: segs }, (_, i) => (
            <i key={i} class={`${used !== null && i < used ? 'f' : ''}${i >= cap ? ' x' : ''}`} />
          ))}
        </div>
      </div>
      <div class="lm-kv">
        <span>Mana per fire</span>
        <b>{costs ? fmtNum(costs.mana) : '–'}</b>
      </div>
      <div class="lm-kv">
        <span>{timing?.label ?? 'Cast time'}</span>
        <b>{timing?.value ?? (costs ? `${fmtNum(costs.castTime, 2)} s` : '–')}</b>
      </div>
    </div>
  );
}

function Validation({ st }: { st: LoomState }) {
  const s = st.status;
  const label = SLOT_LABELS[st.slot.value];
  if (s.kind === 'ok')
    return (
      <div class="lm-valid ok">
        <b>✓ Weave works</b> and is live in {label}.
      </div>
    );
  if (s.kind === 'empty') return <div class="lm-valid">Empty slot.</div>;
  const rune = s.path.length > 0 ? chipRune(st.draft, s.path) : undefined;
  return (
    <div class="lm-valid bad" role="alert">
      <b>{s.message}</b>
      {rune ? (
        <span class="lm-at">
          at
          <span class={`lm-chip xs k-${rune.kind} r-${rune.id}`}>
            <span class={`lm-medal k-${rune.kind} r-${rune.id}`}>
              <RuneGlyph id={rune.id} />
            </span>
            <span class="lm-name">{rune.name}</span>
          </span>
        </span>
      ) : s.path.length === 0 ? (
        <span class="lm-at">Remove runes or pick a bigger spindle.</span>
      ) : (
        <span class="lm-at">See the dashed spot.</span>
      )}
    </div>
  );
}

function Num({
  r,
  prev,
  pick,
  waiting,
}: {
  r: ReadoutResult | undefined;
  /** The last finished result, shown dimmed while a new one computes. */
  prev: ReadoutResult | undefined;
  pick: (r: ReadoutResult & { ok: true }) => number;
  waiting: boolean;
}) {
  if (r?.ok) return <b class="lm-big">≈ {fmtNum(pick(r), 0)}</b>;
  if (waiting && !r && prev?.ok) return <b class="lm-big stale">≈ {fmtNum(pick(prev), 0)}</b>;
  if (waiting && !r) return <b class="lm-big dim">≈ …</b>;
  return <b class="lm-big dim">≈ –</b>;
}

/** Last finished readout per scene (module state: one Loom per page). */
let lastDone: ReadoutView['results'] = {};

function Readout({ st, view }: { st: LoomState; view: ReadoutView }) {
  const s = st.status;
  const waiting = view.status === 'waiting';
  const single = view.results.dummy_single;
  const pack = view.results.dummy_pack;
  const failed = [single, pack].find((r) => r && !r.ok) as { ok: false; error: string } | undefined;
  const ok = pack?.ok ? pack : single?.ok ? single : undefined;
  if (view.status === 'done') lastDone = view.results;
  const notes = new Set<string>();
  for (const r of [single, pack]) if (r?.ok) for (const n of r.notes) notes.add(n);
  return (
    <div class="lm-sec lm-readout">
      <h4>DPS readout {waiting ? <i class="lm-spin" aria-label="computing" /> : null}</h4>
      {s.kind !== 'ok' ? (
        <p class="lm-muted">
          {s.kind === 'empty' ? 'Weave a spell to measure it.' : 'Fix the weave to measure it.'}
        </p>
      ) : (
        <>
          <div class="lm-dps">
            <div>
              <span>Single target</span>
              <Num r={single} prev={lastDone.dummy_single} pick={(r) => r.dps} waiting={waiting} />
            </div>
            <div>
              <span>8-enemy pack</span>
              <Num r={pack} prev={lastDone.dummy_pack} pick={(r) => r.dps} waiting={waiting} />
            </div>
          </div>
          {ok ? (
            <div class="lm-kv">
              <span>Mana per second</span>
              <b>
                {fmtNum(ok.manaSpentPerSecond)} spent, {fmtNum(ok.manaRefundPerSecond)} back
              </b>
            </div>
          ) : null}
          {failed ? (
            <p class="lm-muted">
              {/runtime/i.test(failed.error) ? 'DPS readout arrives with the spell runtime.' : failed.error}
            </p>
          ) : null}
          {notes.size > 0 ? (
            <ul class="lm-notes">
              {[...notes].map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          ) : null}
          <p class="lm-fine">Real sim, 10 runs × 10 s against dummies; mean shown.</p>
        </>
      )}
    </div>
  );
}

function Breakdown({ st }: { st: LoomState }) {
  const s = st.status;
  if (s.kind !== 'ok') return null;
  const rows = damageBreakdown(s.program);
  return (
    <div class="lm-sec">
      <h4>Damage per hit</h4>
      {rows.map((r) => (
        <div class={`lm-bd d${r.depth}`} key={r.path.join('.')}>
          <div class="lm-bd-head">
            <b>{r.title}</b>
            {r.damaging ? (
              <span class="lm-bd-hit">≈ {fmtNum(r.perHit)}</span>
            ) : (
              <span class="lm-muted">no damage</span>
            )}
          </div>
          {r.damaging ? (
            <>
              <div class="lm-share" aria-label="Element shares">
                {r.shares.map((x) => (
                  <i
                    key={x.label}
                    class={`e-${x.label.toLowerCase()}`}
                    style={`flex:${x.share}`}
                    title={`${x.label} ${fmtPct(x.share)}${x.inherited ? ' (inherited)' : ''}`}
                  >
                    {x.label} {fmtPct(x.share)}
                    {x.inherited ? ' ↧' : ''}
                  </i>
                ))}
              </div>
              <div class="lm-kv sm">
                <span>Base damage</span>
                <b>{fmtNum(r.baseDamage)}</b>
              </div>
              {r.more.map((m, i) => (
                <div class={`lm-kv sm ${m.mult >= 1 ? 'more' : 'less'}`} key={i}>
                  <span>{m.label}</span>
                  <b>{m.text}</b>
                </div>
              ))}
              <div class="lm-kv sm">
                <span>Crit</span>
                <b>
                  {fmtPct(r.critChance)} for ×{fmtNum(r.critMultiplier, 2)}
                </b>
              </div>
              {r.instances > 1 ? (
                <div class="lm-kv sm">
                  <span>Instances per cast</span>
                  <b>{r.instances}</b>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ))}
      <p class="lm-fine">Before resistances, Shock, and "increased" from gear and the spindle.</p>
    </div>
  );
}

export function Details({ st, readout }: { st: LoomState; readout: ReadoutView }) {
  return (
    <section class="lm-details lm-panel" aria-label="Weave details">
      <div class="lm-scroll">
        <SpindlePicker st={st} />
        <Costs st={st} />
        <Validation st={st} />
        <Readout st={st} view={readout} />
        <Breakdown st={st} />
      </div>
    </section>
  );
}
