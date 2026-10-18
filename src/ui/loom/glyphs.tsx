/**
 * Small line glyphs for every rune (24×24, stroked with currentColor; CSS colors them by kind
 * and element), plus the HUD's weave icon: the root form drawn in its first element's colors.
 */
import type { JSX } from 'preact';

const P = (d: string, extra: JSX.SVGAttributes<SVGPathElement> = {}) => <path d={d} {...extra} />;

const GLYPHS: Record<string, () => JSX.Element> = {
  // Triggers
  cast: () => (
    <>
      {P('M4 20l9-9')}
      {P('M15 3l1.4 3.6L20 8l-3.6 1.4L15 13l-1.4-3.6L10 8l3.6-1.4z', { fill: 'currentColor' })}
    </>
  ),
  pulse: () => (
    <>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="9.5" stroke-dasharray="3 2.5" />
    </>
  ),
  on_dodge: () => (
    <>
      {P('M3 16c4-1 7-4 9-9')}
      {P('M8 19c4-1 8-4 10-10')}
      {P('M15 6l3.5 3 1-4.5')}
    </>
  ),
  harvest: () => (
    <>
      {P('M6 20L14 9')}
      {P('M9 5c5-3 11 0 11 6-2-3-6-4-9-2')}
    </>
  ),
  on_crit: () => (
    <>
      <circle cx="12" cy="12" r="6.5" />
      {P('M12 2v5M12 17v5M2 12h5M17 12h5')}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  on_hurt: () => (
    <>
      {P('M12 20s-8-5-8-11a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11z')}
      {P('M12 8l-2 4h4l-2 4')}
    </>
  ),
  channel: () => <>{P('M2 12c2.5-5 5-5 7.5 0s5 5 7.5 0 3.5-3 5-2')}</>,
  shatter: () => <>{P('M12 3l3 7-3 11-3-11zM4 9l5 2-4 6zM20 9l-5 2 4 6z')}</>,
  // Forms
  bolt: () => (
    <>
      <circle cx="16" cy="8" r="4" fill="currentColor" />
      {P('M13 11L4 20M11 7L6 9M17 13l-2 5')}
    </>
  ),
  nova: () => (
    <>
      <circle cx="12" cy="12" r="6" />
      {P('M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M5 19l2-2')}
    </>
  ),
  beam: () => (
    <>
      {P('M3 19L20 4', { 'stroke-width': 4 })}
      <circle cx="4" cy="18" r="2.5" fill="currentColor" />
    </>
  ),
  lob: () => (
    <>
      {P('M3 19C6 6 14 4 19 15', { 'stroke-dasharray': '2.5 2.5' })}
      <circle cx="19" cy="17" r="3" fill="currentColor" />
    </>
  ),
  orb: () => (
    <>
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <circle cx="12" cy="12" r="8" stroke-dasharray="2 2.5" />
      <circle cx="18.5" cy="7.5" r="2.8" fill="currentColor" />
    </>
  ),
  strike: () => (
    <>{P('M4 20C5 10 12 4 21 4 14 7 9 13 8 21z', { fill: 'currentColor', 'fill-opacity': 0.35 })}</>
  ),
  swath: () => (
    <>
      {P('M3 16L17 4l4 4L7 20z', { fill: 'currentColor', 'fill-opacity': 0.35 })}
      {P('M7 15l7-6M10 17l7-6')}
    </>
  ),
  sigil: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      {P('M12 5l6 10H6z')}
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  // Elements
  fire: () => (
    <>
      {P('M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4.5 3-6.5.6 1.5 1.3 2.3 2.2 2.7C12 8 12.4 5 12 2z', {
        fill: 'currentColor',
        'fill-opacity': 0.35,
      })}
      {P('M12 13c.5 2 2.5 3 2.5 5a2.5 2.5 0 0 1-5 0c0-1.2.8-2 1.3-2.8')}
    </>
  ),
  frost: () => (
    <>
      {P('M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7')}
      {P('M9.5 3.5L12 6l2.5-2.5M9.5 20.5L12 18l2.5 2.5')}
    </>
  ),
  storm: () => <>{P('M14 2L5 14h6l-2 8 9-12h-6z', { fill: 'currentColor', 'fill-opacity': 0.35 })}</>,
  tide: () => (
    <>{P('M12 3c3 5 6 8 6 12a6 6 0 0 1-12 0c0-4 3-7 6-12z', { fill: 'currentColor', 'fill-opacity': 0.3 })}</>
  ),
  gale: () => <>{P('M3 9h11a3 3 0 1 0-3-3M3 14h15a3 3 0 1 1-3 3M3 19h7')}</>,
  // Modifiers
  split: () => <>{P('M4 20L12 9M12 9L6 3M12 9v-6M12 9l6-6M4 20h0')}</>,
  chain: () => (
    <>
      <rect x="2.5" y="8" width="11" height="8" rx="4" />
      <rect x="10.5" y="8" width="11" height="8" rx="4" />
    </>
  ),
  pierce: () => <>{P('M2 12h18M15 7l5 5-5 5M9 4v16')}</>,
  wide: () => <>{P('M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4')}</>,
  echo: () => (
    <>
      <circle cx="6" cy="12" r="2.5" fill="currentColor" />
      {P('M11 6a8 8 0 0 1 0 12M16 3a12 12 0 0 1 0 18')}
    </>
  ),
  seeker: () => (
    <>
      {P('M3 20C3 10 10 6 17 8')}
      {P('M14 5l3.5 3-3 3.5')}
      <circle cx="20" cy="15" r="2" fill="currentColor" />
    </>
  ),
  heavy: () => (
    <>
      {P('M6 9h12l3 11H3z', { fill: 'currentColor', 'fill-opacity': 0.3 })}
      <circle cx="12" cy="6" r="2.5" />
    </>
  ),
  keen: () => (
    <>
      {P('M12 2l3 10-3 10-3-10z', { fill: 'currentColor', 'fill-opacity': 0.35 })}
      {P('M4 12h3M17 12h3')}
    </>
  ),
  lingering: () => <>{P('M6 3h12M6 21h12M7 3c0 6 10 6 10 9s-10 3-10 9M17 3c0 6-10 6-10 9s10 3 10 9')}</>,
  saturate: () => (
    <>
      <ellipse cx="12" cy="18" rx="10" ry="3.5" />
      {P(
        'M8 4c1.5 2.5 2.5 4 2.5 5a2.5 2.5 0 0 1-5 0c0-1 1-2.5 2.5-5zM16 6c1.2 2 2 3 2 4a2 2 0 0 1-4 0c0-1 .8-2 2-4z',
      )}
    </>
  ),
  fork: () => <>{P('M12 22V12M12 12L5 4M12 12l7-8')}</>,
  return: () => <>{P('M20 6H8a5 5 0 0 0 0 10h8M12 12l4 4-4 4')}</>,
  infuse: () => <>{P('M12 2v12M7 9l5 5 5-5M4 20h16')}</>,
  focus: () => (
    <>
      {P('M2 12h6M22 12h-6M5 9l3 3-3 3M19 9l-3 3 3 3')}
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  swift: () => <>{P('M4 6l6 6-6 6M12 6l6 6-6 6')}</>,
  // Branches
  on_hit: () => (
    <>
      <circle cx="13" cy="12" r="6" />
      <circle cx="13" cy="12" r="2" fill="currentColor" />
      {P('M2 12h5')}
    </>
  ),
  on_expire: () => (
    <>
      <circle cx="12" cy="12" r="8" stroke-dasharray="1.5 3" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),
  on_kill: () => (
    <>
      <circle cx="12" cy="10" r="7" />
      {P('M9 8.5h0M15 8.5h0', { 'stroke-width': 3 })}
      {P('M9 20v-3M12 20v-3M15 20v-3')}
    </>
  ),
  emit: () => (
    <>
      <circle cx="12" cy="12" r="2.8" fill="currentColor" />
      {P('M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M5 19l2.5-2.5')}
    </>
  ),
};

/** A rune's glyph, or a question mark for an empty slot or unknown id. */
export function RuneGlyph(p: { id: string; class?: string }) {
  const g = GLYPHS[p.id];
  return (
    <svg
      class={`lm-glyph${p.class ? ` ${p.class}` : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {g ? g() : P('M9 9a3 3 0 1 1 4 2.8c-.7.3-1 .9-1 1.7V15M12 19h0', { 'stroke-width': 2.4 })}
    </svg>
  );
}

const ELEMENT_COLORS: Record<string, [string, string]> = {
  fire: ['#ff7a2f', '#ffd75a'],
  frost: ['#7cc8ff', '#e6f7ff'],
  storm: ['#a37bff', '#fff07a'],
  tide: ['#3d8bff', '#bfe0ff'],
  gale: ['#4fbf86', '#d8ffe8'],
};
const PHYSICAL: [string, string] = ['#d9c9a3', '#fff4d6'];

/** HUD slot icon: the root form's glyph in its first element's colors on a dark medallion. */
export function WeaveIcon(p: { form: string | null; element: string | null }) {
  const [deep, light] = (p.element && ELEMENT_COLORS[p.element]) || PHYSICAL;
  const g = p.form ? GLYPHS[p.form] : undefined;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="14" fill={deep} fill-opacity="0.28" stroke="#2a1c1f" stroke-width="2" />
      {g ? (
        <g
          transform="translate(4 4)"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          style={`color:${light}`}
        >
          <g stroke="#2a1c1f" stroke-width="4.5">
            {g()}
          </g>
          <g stroke={light} stroke-width="2.2" style={`color:${light}`}>
            {g()}
          </g>
        </g>
      ) : null}
      {p.element && p.form ? (
        <g
          transform="translate(18 18) scale(0.55)"
          fill="none"
          stroke-linecap="round"
          stroke-linejoin="round"
          style={`color:${deep}`}
        >
          <circle cx="12" cy="12" r="11" fill="#2a1c1f" stroke="none" />
          <g stroke={deep} stroke-width="2.6">
            {GLYPHS[p.element]!()}
          </g>
        </g>
      ) : null}
    </svg>
  );
}
