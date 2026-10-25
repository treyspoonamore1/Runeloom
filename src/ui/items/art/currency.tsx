/**
 * Crafting currency art (data/currency.ts), each drawn as what its name says and colored with its
 * floor-drop color (LOOT.currency in src/render/world/worldPalette.ts) so the floor and the menus
 * agree: a knotted cord, a spool, a weaving shuttle, a tangled skein, a gold needle, a seam ripper
 * and a polished rune stone.
 */
import type { JSX } from 'preact';
import type { CurrencyId } from '../../../../data/currency';
import { Cased, HI, INK, S, S1, Sparkle } from './ink';

/** A currency shape, drawn in the currency's color. */
export type CurrencyShape = (color: string) => JSX.Element;

/** A trefoil knot in three overlapping strands, each passing over the one before. */
function trefoilStrands(): string[] {
  const pt = (t: number) => {
    const x = Math.sin(t) + 2 * Math.sin(2 * t);
    const y = Math.cos(t) - 2 * Math.cos(2 * t);
    return `${(16 + x * 3.9).toFixed(2)} ${(15.5 - y * 3.9).toFixed(2)}`;
  };
  const out: string[] = [];
  for (let k = 0; k < 3; k++) {
    const pts: string[] = [];
    for (let i = 0; i <= 16; i++) pts.push(pt(((k + i / 16) * 2 * Math.PI) / 3 + 0.35));
    out.push(`M${pts.join('L')}`);
  }
  return out;
}
const TREFOIL = trefoilStrands();

function weaversKnot(c: string) {
  return (
    <>
      {TREFOIL.map((d) => (
        <Cased key={d} d={d} color={c} w={2.8} />
      ))}
      <path d={TREFOIL[0]} stroke="#ffffff" stroke-width={0.8} {...HI} opacity={0.6} />
    </>
  );
}

function spoolOfChange(c: string) {
  return (
    <>
      <ellipse cx="15" cy="25" rx="9.5" ry="3" fill="#c99a5f" {...S} />
      <path d="M8 7.5h14v17.5H8z" fill={c} {...S} />
      <path d="M8 11.5h14M8 15.5h14M8 19.5h14" stroke={INK} stroke-width={1} {...HI} opacity={0.4} />
      <path d="M10.4 9v14" stroke="#ffffff" stroke-width={1.4} {...HI} opacity={0.55} />
      <ellipse cx="15" cy="7.5" rx="9.5" ry="3" fill="#dcb47a" {...S} />
      <ellipse cx="15" cy="7.5" rx="2" ry="0.9" fill={INK} />
      <Cased d="M22 17.5c4 0 6 2.5 5 5.5s-4 2.5-4 0 3-3.5 5-1.5" color={c} w={1.3} />
    </>
  );
}

function loomShuttle(c: string) {
  return (
    <>
      <path d="M2 22.5C6 12 19 6.5 30 7.5c-3 10.5-16 15.5-28 15z" fill={c} {...S} />
      <path d="M8 17c5-3.8 11-5.8 17-6.4" stroke="#ffffff" stroke-width={1.3} {...HI} opacity={0.6} />
      <path d="M11.5 18.5c2.6-2 6-3.4 9-3.8l.4 2.2c-3 .6-6 1.8-8.6 3.6z" fill={INK} />
      <path d="M13 18.6c2-1.4 4.6-2.4 7-2.8" stroke="#fff4d6" stroke-width={1.4} {...HI} />
      <Cased d="M13 19.6c-2 3-5 4-7.5 7" color="#fff4d6" w={1.1} />
    </>
  );
}

function chaosSkein(c: string) {
  return (
    <>
      <Cased d="M23 23c3 2 6 1 5 4s-4-.5-6 2" color={c} w={1.3} />
      <circle cx="15" cy="15" r="11" fill={c} {...S} />
      <path
        d="M6 12c6 2 12-1 18 3M7 19c5-6 11-9 16-7M10 7c2 6 1 12 4 18M19 5c-3 5 2 11-1 19M5 15c6 6 13 6 20 3"
        stroke="#5a2a7a"
        stroke-width={1.2}
        {...HI}
        opacity={0.75}
      />
      <path d="M9 9.5c2-2 4.5-3 7-3" stroke="#ffffff" stroke-width={1.5} {...HI} opacity={0.6} />
    </>
  );
}

function goldenNeedle(c: string) {
  return (
    <>
      <Cased d="M24 10.5c5 4 3 13-5.5 15.5S6 25.5 5 21.5" color="#d23a2c" w={1.3} />
      <path d="M4.5 28L21.6 8.6c1.6-1.8 4.2-2.2 5.4-.9s.9 3.8-.9 5.4z" fill={c} {...S} />
      <ellipse cx="24.2" cy="10.2" rx="1.9" ry="0.9" transform="rotate(-45 24.2 10.2)" fill={INK} />
      <path d="M8.5 23.5l11-11.5" stroke="#fff4c4" stroke-width={1} {...HI} />
      <Sparkle x={9} y={8} r={3.2} />
    </>
  );
}

function unpick(c: string) {
  return (
    <>
      <Cased d="M13 19l9-9" color="#c9d2e6" w={2.2} />
      <path d="M22 10l4.5-6c1 .2 1.4.8 1.2 1.8L24 12" fill="#c9d2e6" {...S1} />
      <circle cx="25.6" cy="12.6" r="2.4" fill={c} {...S1} />
      <Cased d="M4.5 27.5L13 19" color={c} w={5.4} />
      <path d="M6.6 23.8l4.6-4.6" stroke="#ffffff" stroke-width={1.2} {...HI} opacity={0.55} />
      <Cased d="M11.8 18.2l2 2" color="#f2c35b" w={1.6} />
    </>
  );
}

function runePolish(c: string) {
  return (
    <>
      <path
        d="M8 6.5c4.5-3 11.5-3 16 0 3 5 3 13 0 18-4.5 3-11.5 3-16 0-3-5-3-13 0-18z"
        fill="#6e6690"
        {...S}
      />
      <path d="M13 10.5l6.4 5-6.4 5M16 9v13" stroke={c} stroke-width={2.2} {...HI} />
      <path d="M9.4 9.2c2-1.4 3.6-1.8 5.4-2" stroke="#ffffff" stroke-width={1.5} {...HI} opacity={0.6} />
      <Sparkle x={26} y={5.5} r={3.6} color={c} />
      <Sparkle x={6} y={26} r={2.6} color={c} />
    </>
  );
}

/** Art for each currency id. */
export const CURRENCY_ART: Record<CurrencyId, CurrencyShape> = {
  weavers_knot: weaversKnot,
  spool_of_change: spoolOfChange,
  loom_shuttle: loomShuttle,
  chaos_skein: chaosSkein,
  golden_needle: goldenNeedle,
  unpick,
  rune_polish: runePolish,
};

/** A currency we have no art for: the old crossed-loops glyph. */
export function unknownCurrency(c: string) {
  return (
    <>
      <circle cx="16" cy="16" r="11" fill="#3a3040" {...S} />
      <ellipse cx="16" cy="16" rx="8.5" ry="3.6" stroke={c} stroke-width={2.2} fill="none" />
      <ellipse cx="16" cy="16" rx="3.6" ry="8.5" stroke={c} stroke-width={2.2} fill="none" />
      <circle cx="16" cy="16" r="2.8" fill={c} />
    </>
  );
}
