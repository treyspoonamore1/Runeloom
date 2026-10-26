/**
 * Fuse part art for the M8 Glasswater Fen parts (data/fuseParts.ts): first-pass icons in the
 * parts.tsx style (32×32, ink outline), one shape each, until the art pass replaces them.
 */
import { HI, INK, S, S1, Sparkle, type Shape } from './ink';

const STORM = '#f5e04a';
const STORM_GLOW = '#9b7bff';

function pikeScale() {
  return (
    <>
      <path d="M16 3c7 4 11 10 11 16 0 6-5 10-11 10S5 25 5 19C5 13 9 7 16 3z" fill="#bfe6e4" {...S} />
      <path d="M16 8c4 3 6 7 6 11" stroke="#ffffff" stroke-width={1.6} {...HI} opacity={0.8} />
      <path d="M9 20c2 3 5 4 7 4s5-1 7-4" stroke="#7fb8c2" stroke-width={1.4} {...HI} />
    </>
  );
}

function copperCarapace() {
  return (
    <>
      <path d="M4 20c0-8 5-14 12-14s12 6 12 14c-3 4-7 6-12 6S7 24 4 20z" fill="#b8653a" {...S} />
      <path d="M8 18c2-5 5-8 8-8s6 3 8 8" stroke="#5f9f8a" stroke-width={1.6} {...HI} />
      <path d="M16 6V3" {...S1} />
      <path d="M14.5 3.5l1.5-2 1.5 2" stroke={STORM} stroke-width={1.4} {...HI} />
    </>
  );
}

function heronPlume() {
  return (
    <>
      <path d="M8 28C9 18 14 9 24 4c1 9-4 18-14 24z" fill="#7d8a94" {...S} />
      <path d="M10 26c4-6 8-12 12-19" stroke="#c4cdd4" stroke-width={1.4} {...HI} />
      <path d="M20 10l3 2-2 2 3 2" stroke={STORM} stroke-width={1.5} {...HI} />
    </>
  );
}

function slagCore() {
  return (
    <>
      <path d="M6 18c0-7 4-12 10-12s10 5 10 12-4 9-10 9-10-2-10-9z" fill="#3a2f2c" {...S} />
      <path d="M11 14l4 3-2 4 5 2M18 11l1 5 4-1" stroke="#ff7a2f" stroke-width={1.8} {...HI} />
      <circle cx="16" cy="18" r="2.2" fill="#ffd75a" />
    </>
  );
}

function sparkflyLantern() {
  return (
    <>
      <path d="M11 9h10l2 15H9z" fill="#3c4a3e" {...S} />
      <path d="M13 6h6v3h-6z" fill="#6a6a5a" {...S1} />
      <circle cx="16" cy="17" r="4" fill={STORM} stroke={STORM_GLOW} stroke-width={1.2} />
      <Sparkle x={25} y={8} r={3} color={STORM} />
    </>
  );
}

function mireHorn() {
  return (
    <>
      <path d="M5 26c2-10 8-17 20-21-4 6-6 12-6 21z" fill="#d9c7a0" {...S} />
      <path d="M9 22c3-6 7-11 13-14" stroke="#ffffff" stroke-width={1.2} {...HI} opacity={0.7} />
      <path d="M6 27h14" stroke="#5a4632" stroke-width={2.4} {...HI} />
    </>
  );
}

function toadBellows() {
  return (
    <>
      <path d="M4 18c0-6 5-10 12-10s12 4 12 10-5 9-12 9S4 24 4 18z" fill="#7aa35a" {...S} />
      <ellipse cx="16" cy="20" rx="7" ry="4.5" fill="#d9e3a8" stroke={INK} stroke-width={1.4} />
      <path d="M22 10c3-1 5-1 7 0M23 13c3 0 5 1 6 2" stroke="#e8f4f0" stroke-width={1.6} {...HI} />
    </>
  );
}

function bellBronze() {
  return (
    <>
      <path d="M9 22c0-9 3-15 7-15s7 6 7 15z" fill="#c9973f" {...S} />
      <path d="M6 22h20v3H6z" fill="#a5782e" {...S1} />
      <circle cx="16" cy="27" r="2" fill="#a5782e" {...S1} />
      <path d="M12 12c1-2 2-3 4-3" stroke="#f3d07a" stroke-width={1.4} {...HI} />
      <path d="M26 9l2-2M27 13h3" stroke={STORM} stroke-width={1.5} {...HI} />
    </>
  );
}

/** Art for each M8 Fen Fuse part id (merged into parts.tsx PART_ART). */
export const FEN_PART_ART: Record<string, Shape> = {
  pike_scale: pikeScale,
  copper_carapace: copperCarapace,
  heron_plume: heronPlume,
  slag_core: slagCore,
  sparkfly_lantern: sparkflyLantern,
  mire_horn: mireHorn,
  toad_bellows: toadBellows,
  bell_bronze: bellBronze,
};
