/** The HUD's bottom bar (life and mana globes, dodge pips, weave slots) and the arena wave panel. */
import type { Signal } from '@preact/signals';
import { fmtCost, waveText, type HudSnap } from './hudModel';
import { WeaveIcon } from './loom/glyphs';
import type { MenuId } from './menus/frame';

export type Screen = 'title' | 'start' | 'play' | 'pause' | 'loom' | MenuId;
export interface Banner {
  id: number;
  title: string;
  sub: string;
}

export interface Sigs {
  snap: Signal<HudSnap>;
  screen: Signal<Screen>;
  /** Bumped on each hit taken, to restart the red edge flash. */
  hurt: Signal<number>;
  /** Slot and counter of the last failed cast, to restart that slot's red flash. */
  deny: Signal<{ slot: number; n: number }>;
  banner: Signal<Banner | null>;
}

const num = (v: number): string => String(v);

function Globe(p: {
  kind: 'life' | 'mana';
  value: number;
  max: number;
  frac: number;
  low?: boolean;
  flash?: number;
}) {
  return (
    <div
      class={`rl-globe rl-${p.kind}${p.low ? ' low' : ''}`}
      role="meter"
      aria-label={p.kind}
      aria-valuenow={p.value}
      aria-valuemax={p.max}
    >
      <div class={`rl-fill${p.frac <= 0 ? ' empty' : ''}`} style={`--f:${p.frac}`} />
      <div class="rl-num rl-outline">
        <b>{num(p.value)}</b>
        <span>/ {num(p.max)}</span>
      </div>
      {p.flash ? <i class="rl-deny" key={p.flash} /> : null}
    </div>
  );
}

export function Bar({ s }: { s: Sigs }) {
  const v = s.snap.value;
  const deny = s.deny.value;
  return (
    <div class="rl-bar">
      <Globe kind="life" value={v.life} max={v.maxLife} frac={v.lifeFrac} low={v.lifeFrac < 0.3 && !v.dead} />
      <div class="rl-plate" style="position:relative">
        {v.god ? <span class="rl-godtag">GOD MODE</span> : null}
        <div class="rl-pips" aria-label="Dodge charges">
          <small>Dodge</small>
          {v.pips.map((fill, i) => (
            <i key={i} class={`rl-pip${fill >= 1 ? ' full' : ''}`} style={`--p:${fill}`} />
          ))}
          <small>Space</small>
        </div>
        <div class="rl-slots">
          {v.slots.map((sl) => (
            <div class="rl-slotwrap" key={sl.slot}>
              <div
                class={`rl-slot${sl.affordable ? '' : ' poor'}${sl.casting ? ' casting' : ''}${sl.notation ? '' : ' empty'}${sl.warn ? ' warn' : ''}`}
                title={
                  sl.warn ? `Doesn't fire: ${sl.warn}` : (sl.notation ?? 'Empty slot: press Tab to weave')
                }
              >
                {sl.notation ? <WeaveIcon form={sl.form} element={sl.element} /> : null}
                <i class={`rl-sweep${sl.casting ? '' : ' idle'}`} style={`--p:${sl.progress}`} />
                {sl.auto ? (
                  <i class={`rl-cd${sl.cooldown > 0 ? '' : ' idle'}`} style={`--p:${sl.cooldown}`} />
                ) : null}
                {sl.auto ? <span class="rl-auto">auto</span> : null}
                {sl.cost !== null ? (
                  <span class="rl-cost" title="Mana cost">
                    {fmtCost(sl.cost)}
                  </span>
                ) : null}
                {sl.warn ? <i class="rl-warn" aria-label="Doesn't fit the spindle" /> : null}
                {deny.slot === sl.slot && deny.n > 0 ? <i class="rl-deny" key={deny.n} /> : null}
              </div>
              <span class="rl-key">{sl.key}</span>
              <span class="rl-spellname">{sl.name}</span>
            </div>
          ))}
        </div>
        <div class="rl-loomhint">
          <span class="rl-cap">Tab</span> Loom
        </div>
      </div>
      <Globe kind="mana" value={v.mana} max={v.maxMana} frac={v.manaFrac} flash={deny.n} />
    </div>
  );
}

export function WavePanel({ s }: { s: Sigs }) {
  const w = s.snap.value.wave;
  if (!w) return null;
  const t = waveText(w);
  return (
    <div class="rl-wave">
      <div class="rl-wave-title rl-outline">{t.title}</div>
      <div class="rl-wave-detail">{t.detail}</div>
    </div>
  );
}
