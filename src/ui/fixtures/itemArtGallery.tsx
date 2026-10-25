/**
 * The item art gallery for `npm run shots -- --set ui --shot item_art`: every item base at each
 * rarity, every unique, every currency and every part tier at md size, then one row at sm. The
 * shot mounts it over the fixture adventure scene with mountItemArtGallery().
 */
import { render } from 'preact';
import { currencies, currencyIds } from '../../../data/currency';
import { fuseParts } from '../../../data/fuseParts';
import { gearBases } from '../../../data/items';
import { spindles } from '../../../data/spindles';
import { uniques } from '../../../data/uniques';
import type { ItemRarity } from '../../sim/hero/types';
import { injectHudStyle } from '../hudStyle';
import { CurrencyArt, ItemArt, PartArt } from '../items/itemArt';

const BASES = [...Object.keys(spindles), ...Object.keys(gearBases)];
const RARITIES: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];
const PARTS = Object.keys(fuseParts);
const UNIQUES = Object.values(uniques);
const TIERS = [1, 2, 3] as const;

const css = `
.iag { position: absolute; inset: 0; z-index: 900; pointer-events: auto; overflow: auto; padding: 14px 18px; color: var(--cream);
  background: radial-gradient(ellipse at 50% 30%, #2b2557, #120e28 80%); font-size: 12px; }
.iag h3 { margin: 0 0 6px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); }
.iag-row { display: flex; gap: 26px; align-items: flex-start; margin-bottom: 12px; }
.iag-grid { display: grid; gap: 7px; align-items: center; justify-items: center; }
.iag-grid > small { color: #a59cc8; font-size: 10px; max-width: 54px; text-align: center; line-height: 1.1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.iag-grid > b { color: var(--sand); font-size: 10px; font-weight: 400; justify-self: end; text-transform: capitalize; }
.iag-cell { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 72px; }
.iag-cell small { color: var(--sand); font-size: 10px; text-align: center; line-height: 1.1; }
.iag-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.iag-sm { display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
`;

function Gallery() {
  return (
    <div class="iag">
      <style>{css}</style>
      <div class="iag-row">
        <div>
          <h3>Bases by rarity</h3>
          <div class="iag-grid" style={`grid-template-columns: 52px repeat(${BASES.length}, 54px)`}>
            <span />
            {BASES.map((b) => (
              <small key={b}>{b.replace('_spindle', '').replace(/_/g, ' ')}</small>
            ))}
            {RARITIES.flatMap((r) => [
              <b key={r}>{r}</b>,
              ...BASES.map((b) => <ItemArt key={`${r}${b}`} item={{ base: b, rarity: r }} size="md" />),
            ])}
          </div>
        </div>
        <div>
          <h3>Uniques</h3>
          <div class="iag-wrap" style="width: 250px">
            {UNIQUES.map((u) => (
              <div class="iag-cell" key={u.id}>
                <ItemArt item={{ base: u.base, rarity: 'unique', unique: u.id }} size="md" />
                <small>{u.name}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div class="iag-row">
        <div>
          <h3>Fuse parts, tiers I–III</h3>
          <div class="iag-grid" style={`grid-template-columns: 52px repeat(${PARTS.length}, 54px)`}>
            <span />
            {PARTS.map((p) => (
              <small key={p}>{p.replace(/_/g, ' ')}</small>
            ))}
            {TIERS.flatMap((t) => [
              <b key={t}>{'I'.repeat(t)}</b>,
              ...PARTS.map((p) => <PartArt key={`${t}${p}`} part={p} tier={t} size="md" />),
            ])}
          </div>
        </div>
        <div>
          <h3>Currency</h3>
          <div class="iag-wrap" style="width: 330px">
            {currencyIds.map((c) => (
              <div class="iag-cell" key={c}>
                <CurrencyArt currency={c} size="md" />
                <small>{currencies[c].name}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <h3>Small (sm)</h3>
      <div class="iag-sm">
        {BASES.map((b, i) => (
          <ItemArt key={b} item={{ base: b, rarity: RARITIES[i % 4]! }} size="sm" />
        ))}
        {UNIQUES.map((u) => (
          <ItemArt key={u.id} item={{ base: u.base, rarity: 'unique', unique: u.id }} size="sm" />
        ))}
        {currencyIds.map((c) => (
          <CurrencyArt key={c} currency={c} size="sm" />
        ))}
        {PARTS.map((p, i) => (
          <PartArt key={p} part={p} tier={TIERS[i % 3]!} size="sm" />
        ))}
        <ItemArt item={{ base: 'no_such_base', rarity: 'normal' }} size="sm" />
        <ItemArt item={{ base: 'wool_cloak', rarity: 'magic' }} size="sm" />
      </div>
    </div>
  );
}

/** Mounts the gallery over the page, inside a HUD root so it has the HUD's units and colors. */
export function mountItemArtGallery(): void {
  injectHudStyle();
  const host = document.createElement('div');
  host.className = 'rl-root';
  host.style.zIndex = '900';
  document.body.appendChild(host);
  render(<Gallery />, host);
}
