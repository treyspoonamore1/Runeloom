/** Rune Garden: plots, planted runes with XP bars, plant from the pouch, uproot. */
import { getRune } from '../../../data/runes';
import { runeXpToNext, maxRuneLevel } from '../../../data/progression';
import type { RuneItem } from '../../sim/hero/types';
import { fmtNum, nextPlotLevel } from './hearthModel';
import { BuildingUpgrade } from './buildingsPanel';
import type { PanelProps } from './panelTypes';

const runeName = (r: RuneItem): string => getRune(r.rune)?.name ?? r.rune;

export function GardenPanel(p: PanelProps) {
  const g = p.snap.garden;
  const level = p.snap.buildings.find((b) => b.id === 'rune_garden')?.level ?? 0;
  if (level <= 0)
    return (
      <p class="hx-away">
        Build the Rune Garden in Buildings first. Planted runes gain XP every minute, even while you are away.
      </p>
    );
  const free = Math.max(0, g.plots - g.planted.length);
  const next = nextPlotLevel(level);
  return (
    <>
      <div class="hx-row between">
        <span>
          <span class="hx-cap">Plots</span>
          <b class="hx-num">{g.planted.length}</b> of {g.plots} used
          {next !== null ? <small class="mn-muted"> · next plot at Rune Garden level {next}</small> : null}
        </span>
        <span class="hx-rates-inline">
          <span class="hx-cap">Each planted rune</span>
          <b class="hx-num">+{fmtNum(g.xpPerMinute)}</b> XP a minute
        </span>
      </div>
      <div class="hx-plots">
        {g.planted.map((r) => {
          const max = r.level >= maxRuneLevel;
          const need = max ? 1 : runeXpToNext(r.level);
          const f = max ? 1 : Math.min(1, r.xp / need);
          return (
            <article class="hx-card hx-plot" key={r.uid} aria-label={`${runeName(r)} planted`}>
              <h4>
                <span>{runeName(r)}</span>
                <span class="hx-lv">Lv {r.level}</span>
              </h4>
              <div class="hx-bar xp" role="meter" aria-label="Rune XP" aria-valuenow={Math.round(f * 100)}>
                <i style={`--f:${f}`} />
              </div>
              <p class="mn-muted">{max ? 'Max level' : `${fmtNum(r.xp)} / ${fmtNum(need)} XP`}</p>
              <button
                type="button"
                class="mn-btn hx-btn"
                onClick={() => p.act({ kind: 'gardenUproot', uid: r.uid })}
              >
                Uproot
              </button>
            </article>
          );
        })}
        {Array.from({ length: free }, (_, i) => (
          <div class="hx-card hx-plot empty" key={`e${i}`}>
            Empty plot
          </div>
        ))}
      </div>
      <h3 class="hx-sub">Plant a rune{free === 0 ? ' (no free plot)' : ''}</h3>
      {g.plantable.length === 0 ? (
        <p class="mn-muted">
          No spare runes. Runes in your weave slots can't be planted; take one out in the Loom first.
        </p>
      ) : (
        <div class="hx-pouch">
          {g.plantable.map((r) => (
            <button
              type="button"
              class="hx-pick"
              key={r.uid}
              disabled={free === 0}
              onClick={() => p.act({ kind: 'gardenPlant', uid: r.uid })}
            >
              <span>
                {runeName(r)} <small>Lv {r.level}</small>
              </span>
              <b>Plant</b>
            </button>
          ))}
        </div>
      )}
      <BuildingUpgrade {...p} id="rune_garden" />
    </>
  );
}
