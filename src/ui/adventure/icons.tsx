/**
 * Flat icons with dark outlines for the adventure UI (DESIGN §15): equipment by slot, Fuse parts,
 * Thread Scrap, keys, Heart Seeds, Loom Shards and Loom Stones. 32×32 viewBox, colored in code.
 */
import type { JSX } from 'preact';

const INK = '#2a1c1f';
const S = {
  stroke: INK,
  'stroke-width': 2,
  'stroke-linejoin': 'round' as const,
  'stroke-linecap': 'round' as const,
};

function Svg(p: { children: JSX.Element | JSX.Element[]; cls?: string }) {
  return (
    <svg viewBox="0 0 32 32" class={p.cls ?? 'ad-ico'} aria-hidden="true">
      {p.children}
    </svg>
  );
}

export type IconKind =
  | 'spindle'
  | 'cloak'
  | 'hood'
  | 'boots'
  | 'charm'
  | 'part'
  | 'scrap'
  | 'currency'
  | 'key'
  | 'bigKey'
  | 'heart'
  | 'shard'
  | 'stone'
  | 'rune'
  | 'sigil'
  | 'level'
  | 'ember'
  | 'ash'
  | 'weaver'
  /** Hints (playtest 8): a brass shell with a small shield; deep water over a dark shape. */
  | 'shell'
  | 'deep';

const SHAPES: Record<IconKind, () => JSX.Element> = {
  spindle: () => (
    <>
      <path d="M7 27L21 11" {...S} stroke-width={5} />
      <path d="M7 27L21 11" stroke="#b47a43" stroke-width={2.4} stroke-linecap="round" />
      <path d="M19 6c3-2 7 0 7 4s-3 6-6 5-4-6-1-9z" fill="#ff9a52" {...S} />
      <circle cx="22" cy="10" r="1.8" fill="#fff4c4" />
    </>
  ),
  cloak: () => (
    <>
      <path d="M11 5h10l2 4 4 18c-4 2-18 2-22 0l4-18z" fill="#c4623a" {...S} />
      <path d="M13 9h6l-3 5z" fill="#f2c35b" {...S} stroke-width={1.5} />
    </>
  ),
  hood: () => (
    <>
      <path d="M16 4c7 0 11 6 11 13v9H5v-9C5 10 9 4 16 4z" fill="#5d7ad9" {...S} />
      <path d="M10 26v-7c0-4 3-7 6-7s6 3 6 7v7z" fill="#1d1838" {...S} stroke-width={1.5} />
    </>
  ),
  boots: () => (
    <>
      <path d="M8 4h8v14l10 3c2 1 2 6 0 6H8z" fill="#9a6a3c" {...S} />
      <path d="M8 22h18" stroke={INK} stroke-width={1.6} />
    </>
  ),
  charm: () => (
    <>
      <path d="M16 3v6" {...S} />
      <path d="M16 9l8 8-8 12-8-12z" fill="#72dcc8" {...S} />
      <path d="M16 13l3.5 4L16 23l-3.5-6z" fill="#dff8f2" />
    </>
  ),
  part: () => (
    <>
      <path d="M6 22c0-9 6-16 14-17-2 4-1 7 2 9 3 2 5 6 3 11-6-2-13 0-19-3z" fill="#e8d6b0" {...S} />
      <circle cx="17" cy="16" r="2.4" fill="#ff7a2f" {...S} stroke-width={1.4} />
    </>
  ),
  currency: () => (
    <>
      <circle cx="16" cy="16" r="10" fill="#3a3040" {...S} />
      <ellipse cx="16" cy="16" rx="8" ry="3.5" stroke="#9fb4ff" stroke-width={2} fill="none" />
      <ellipse cx="16" cy="16" rx="3.5" ry="8" stroke="#9fb4ff" stroke-width={2} fill="none" />
      <circle cx="16" cy="16" r="2.6" fill="#eef2ff" />
    </>
  ),
  scrap: () => (
    <>
      <path d="M5 20c4-6 8 2 12-4s8 2 10-2" {...S} stroke-width={5} />
      <path
        d="M5 20c4-6 8 2 12-4s8 2 10-2"
        stroke="#f1dbab"
        stroke-width={2.6}
        fill="none"
        stroke-linecap="round"
      />
      <circle cx="9" cy="10" r="3" fill="#c4623a" {...S} stroke-width={1.6} />
    </>
  ),
  sigil: () => (
    <>
      <path d="M16 3l11 6.5v13L16 29 5 22.5v-13z" fill="#2a2236" {...S} />
      <path d="M16 7l7.5 4.5v9L16 25l-7.5-4.5v-9z" stroke="#b48cff" stroke-width={1.6} fill="none" />
      <path d="M17 9l2 6-4 2 3 7-5-7 4-2z" fill="#e6d8ff" />
    </>
  ),
  key: () => (
    <>
      <circle cx="10" cy="11" r="6" fill="#f2c35b" {...S} />
      <circle cx="10" cy="11" r="2.2" fill={INK} />
      <path d="M14 15l12 12M21 22l3-3M24 25l2-2" {...S} stroke-width={3} />
    </>
  ),
  bigKey: () => (
    <>
      <path d="M10 3l6 6-6 6-6-6z" fill="#ff7a2f" {...S} />
      <path d="M13 12l14 14M21 20l4-4M25 24l3-3" {...S} stroke-width={3.4} />
      <path d="M13 12l14 14" stroke="#ffd75a" stroke-width={1.4} />
    </>
  ),
  heart: () => (
    <>
      <path d="M16 28S4 20 4 11a6 6 0 0 1 12-1 6 6 0 0 1 12 1c0 9-12 17-12 17z" fill="#ff6a5a" {...S} />
      <path d="M16 11c0 4 2 6 4 7" stroke="#7fd36b" stroke-width={2.2} fill="none" stroke-linecap="round" />
      <path d="M20 18c2-1 3-3 3-5-2 0-3 2-3 5z" fill="#7fd36b" />
    </>
  ),
  shard: () => (
    <>
      <path d="M16 2l7 9-7 19-7-19z" fill="#bfaeff" {...S} />
      <path d="M16 2v28M9 11h14" stroke="#efe9ff" stroke-width={1.2} />
    </>
  ),
  stone: () => (
    <>
      <path d="M9 28V12l7-8 7 8v16z" fill="#8c82b8" {...S} />
      <path d="M16 11l3 4-3 5-3-5z" fill="#ffe9a8" {...S} stroke-width={1.3} />
    </>
  ),
  rune: () => (
    <>
      <circle cx="16" cy="16" r="12" fill="#3d3580" {...S} />
      <path
        d="M12 9l8 7-8 7M16 9v14"
        stroke="#f2c35b"
        stroke-width={2.2}
        fill="none"
        stroke-linecap="round"
      />
    </>
  ),
  ember: () => (
    <>
      <path d="M16 3c1 5 8 8 8 15a8 8 0 0 1-16 0c0-4 2-5 3-8 2 2 2 4 3 4 1-4 0-7 2-11z" fill="#ff7a2f" {...S} />
      <path d="M16 15c0 3 4 4 4 8a4 4 0 0 1-8 0c0-3 4-5 4-8z" fill="#ffd75a" {...S} stroke-width={1.4} />
    </>
  ),
  ash: () => (
    <>
      <path d="M6 22c0-6 5-8 5-12 3 2 5 4 4 8 3-1 4-3 4-6 4 3 7 6 7 11 0 5-5 7-10 7S6 27 6 22z" fill="#a59cc8" {...S} />
      <path d="M13 24c0-3 3-4 3-7 2 1 4 3 4 6s-2 4-4 4-3-1-3-3z" fill="#e9dfc6" {...S} stroke-width={1.4} />
    </>
  ),
  weaver: () => (
    <>
      <circle cx="16" cy="9" r="5" fill="#f1dbab" {...S} />
      <path d="M6 28c0-8 4-12 10-12s10 4 10 12z" fill="#5d7ad9" {...S} />
      <path d="M12 20l4 4 4-4" stroke="#f2c35b" stroke-width={2} fill="none" stroke-linecap="round" />
    </>
  ),
  shell: () => (
    <>
      <path d="M4 22c0-9 5-15 12-15s12 6 12 15z" fill="#d9a441" {...S} />
      <path d="M10 21c0-6 2.6-10 6-10s6 4 6 10" fill="none" stroke="#8a5a1e" stroke-width={1.6} />
      <path d="M3 22h26" {...S} />
      <path d="M22 18l5-1.6 5 1.6v4.4c0 3.4-2.4 5.6-5 6.6-2.6-1-5-3.2-5-6.6z" fill="#b8c2cc" {...S} stroke-width={1.6} />
    </>
  ),
  deep: () => (
    <>
      <circle cx="16" cy="16" r="13" fill="#1f4a6e" {...S} />
      <ellipse cx="16" cy="19" rx="8" ry="3.6" fill="#0d2238" />
      <path d="M6 13c2.5-2 5-2 7.5 0s5 2 7.5 0 4-1.5 5 0" fill="none" stroke="#8fd3ff" stroke-width={1.8} stroke-linecap="round" />
      <path d="M8 24c2-1.4 4-1.4 6 0s4 1.4 6 0" fill="none" stroke="#5fa9d6" stroke-width={1.6} stroke-linecap="round" />
    </>
  ),
  level: () => (
    <>
      <path d="M16 3l3.6 8 8.4.8-6.4 5.6 2 8.6L16 21.6 8.4 26l2-8.6L4 11.8l8.4-.8z" fill="#ffd75a" {...S} />
    </>
  ),
};

export function Icon(p: { kind: IconKind; cls?: string }) {
  return <Svg cls={p.cls}>{SHAPES[p.kind]()}</Svg>;
}
