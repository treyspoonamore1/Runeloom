/**
 * Fuse part art for the M8 Glasswater Fen parts (data/fuseParts.ts), in the parts.tsx style
 * (32×32, ink outline, flat fills, one or two highlights): each is the monster bit it names, in
 * the colors of the Fen bestiary (src/render/bestiary/fenBeastPalette.ts).
 */
import { HI, INK, S, S1, Sparkle, type Shape } from './ink';

const STORM = '#f5e04a';
const STORM_GLOW = '#9b7bff';
const GALE = '#e8f4f0';

/** A glass-clear scale with the spine seen through it. */
function pikeScale() {
  return (
    <>
      <path
        d="M16 3.5c6.5 3.5 10.5 9.5 10.5 15.5 0 5.6-4.6 9.5-10.5 9.5S5.5 24.6 5.5 19C5.5 13 9.5 7 16 3.5z"
        fill="#c6ece8"
        {...S}
      />
      <path d="M8 20.5c2.2 3.6 5 5 8 5s5.8-1.4 8-5c-2.6 1.4-5.2 2-8 2s-5.4-.6-8-2z" fill="#8fcac8" />
      <path d="M16 7.5v17" stroke="#4f8f96" stroke-width={1.6} {...HI} />
      <path
        d="M12 12.5l4 2.5 4-2.5M11.5 17l4.5 2.6 4.5-2.6"
        stroke="#4f8f96"
        stroke-width={1.1}
        {...HI}
        opacity={0.75}
      />
      <path d="M11 9.5c1.4-1.6 3-2.8 5-3.6" stroke="#ffffff" stroke-width={1.6} {...HI} opacity={0.9} />
      <Sparkle x={24} y={8} r={3.2} color="#f6ffff" />
    </>
  );
}

/** A rusty copper shell with verdigris blooms, its antennae sparking. */
function copperCarapace() {
  return (
    <>
      <path d="M8 9.5c1-3 2.5-5 4-6M24 9.5c-1-3-2.5-5-4-6" stroke={INK} stroke-width={2.2} {...HI} />
      <circle cx="11.8" cy="3.6" r="1.5" fill={STORM} {...S1} />
      <circle cx="20.2" cy="3.6" r="1.5" fill={STORM} {...S1} />
      <path
        d="M3.5 19.5c0-7 5.5-11.5 12.5-11.5s12.5 4.5 12.5 11.5c-3 4.2-7.4 6.5-12.5 6.5S6.5 23.7 3.5 19.5z"
        fill="#b0683c"
        {...S}
      />
      <path d="M6 21c3 2.6 6.4 3.8 10 3.8s7-1.2 10-3.8" stroke="#7a4426" stroke-width={2.2} {...HI} />
      <ellipse cx="20.5" cy="15" rx="3.2" ry="2" fill="#5f9f8a" />
      <ellipse cx="10" cy="18.5" rx="2.3" ry="1.5" fill="#5f9f8a" />
      <path d="M9 13c2-2 4.4-3 7-3" stroke="#d48a56" stroke-width={1.6} {...HI} />
      <path d="M26.5 6.5l2-1.5M27.5 10h2.5" stroke={STORM_GLOW} stroke-width={1.4} {...HI} />
    </>
  );
}

/** The heron's crest plate of rusted pylon metal, an insulator disc at its root, a zap. */
function heronPlume() {
  return (
    <>
      <path d="M7 27.5C8.5 17.5 14 9.5 25 4c.5 9.5-4.5 17.5-15 23.5z" fill="#6f7f88" {...S} />
      <path d="M10 25c3.8-6 7.8-11.6 13-17.5" stroke="#9aa9b2" stroke-width={1.5} {...HI} />
      <circle cx="17" cy="16" r="1.4" fill="#a8633a" />
      <circle cx="12.5" cy="21.5" r="1" fill="#a8633a" />
      <ellipse cx="8.5" cy="27" rx="4.5" ry="2" fill="#e0d8c4" {...S1} />
      <path d="M22 13l3.5 1.5-2.5 2 3.5 1.5" stroke={STORM} stroke-width={1.6} {...HI} />
    </>
  );
}

/** A lump of slag crust, amber veins glowing to a hot core. */
function slagCore() {
  return (
    <>
      <path
        d="M5.5 18.5c-.5-7 4-12.5 10.5-12.5s11 5 10.5 12c-.4 5.5-5 9-10.5 9s-10-3.3-10.5-8.5z"
        fill="#4a3a36"
        {...S}
      />
      <path d="M8 21c2 3 5 4.5 8 4.5s6.5-1.5 8.5-5c-3 1.4-5.6 2-8.5 2-3 0-5.6-.6-8-1.5z" fill="#2c2220" />
      <path
        d="M10 12l4 3.5-2.5 4 4.5 2M19 10l.5 5 4.5 1"
        stroke="#ff9a48"
        stroke-width={2.6}
        {...HI}
        opacity={0.45}
      />
      <path d="M10 12l4 3.5-2.5 4 4.5 2M19 10l.5 5 4.5 1" stroke="#ffd27a" stroke-width={1.3} {...HI} />
      <circle cx="16" cy="16.5" r="2.4" fill="#ffd27a" stroke="#ff9a48" stroke-width={1.2} />
      <path d="M9 9.5c1.6-1.4 3.4-2.2 5.5-2.5" stroke="#6a5650" stroke-width={1.5} {...HI} />
    </>
  );
}

/** The sparkfly's lamp: a glowing abdomen under two wing stubs. */
function sparkflyLantern() {
  return (
    <>
      <circle cx="16" cy="19" r="10" fill="#e6f08a" opacity={0.25} />
      <path
        d="M15 8.5c-4-3-9-2.5-10 0 1.5 2 6 2.5 10 .5zM17 8.5c4-3 9-2.5 10 0-1.5 2-6 2.5-10 .5z"
        fill="#e8f4ff"
        {...S1}
      />
      <ellipse cx="16" cy="9" rx="3" ry="3.4" fill="#4a5236" {...S} />
      <ellipse cx="16" cy="19.5" rx="6" ry="7" fill="#e6f08a" {...S} />
      <ellipse cx="16" cy="20.5" rx="3.4" ry="4.2" fill="#fffbd0" />
      <path d="M12.8 15.5c.8-1.2 1.8-2 3-2.3" stroke="#ffffff" stroke-width={1.4} {...HI} />
      <Sparkle x={25.5} y={23} r={2.6} color={STORM} />
    </>
  );
}

/** A curled ox horn, pale, caked with marsh mud at its root. */
function mireHorn() {
  return (
    <>
      <path d="M6 27c1-10 7-18.5 19.5-22.5-3 5.5-5 9-5.3 13.2-.3 3.6.8 6.5 2.3 9.3z" fill="#e2d2ac" {...S} />
      <path
        d="M10.5 15.5l3.5 1.2M12.5 11.5l3.6 1.6M15.5 8l3.2 1.8"
        stroke="#9a8a6a"
        stroke-width={1.3}
        {...HI}
      />
      <path d="M10 23c1.5-6.5 5-12 10.5-15.5" stroke="#ffffff" stroke-width={1.3} {...HI} opacity={0.7} />
      <path d="M4.5 27.5c3-2.4 8-3.2 18-0.5-2 2.2-15 2.6-18 .5z" fill="#5a4430" {...S1} />
    </>
  );
}

/** The toad's throat sac, puffed, a gust curling off it. */
function toadBellows() {
  return (
    <>
      <path d="M4 16c0-5.5 4.8-9 11-9s11 3.5 11 9-4.8 8.5-11 8.5S4 21.5 4 16z" fill="#6c8f4c" {...S} />
      <ellipse cx="15" cy="20.5" rx="8.5" ry="6" fill="#e0e6b0" stroke={INK} stroke-width={1.8} />
      <path d="M10 18.5c1.4-1.2 3-1.7 4.8-1.7" stroke="#ffffff" stroke-width={1.4} {...HI} />
      <circle cx="9.5" cy="11.5" r="1.2" fill="#557a3a" />
      <circle cx="19" cy="10.5" r="1.4" fill="#557a3a" />
      <path
        d="M24.5 10c2.6-1.5 4.5-1 5.5.5M25.5 14c2.4 0 4 .8 4.5 2.2M26 18.5c1.6.6 2.6 1.6 2.6 3"
        stroke={GALE}
        stroke-width={1.8}
        {...HI}
      />
      <path
        d="M24.5 10c2.6-1.5 4.5-1 5.5.5M25.5 14c2.4 0 4 .8 4.5 2.2"
        stroke={INK}
        stroke-width={0.6}
        {...HI}
        opacity={0.5}
      />
    </>
  );
}

/** A bronze bell plate from the Bellshell's shell, verdigris at the lip, still ringing. */
function bellBronze() {
  return (
    <>
      <path d="M8.5 22.5c0-9.5 3.4-15.5 7.5-15.5s7.5 6 7.5 15.5z" fill="#b08a3c" {...S} />
      <path d="M5.5 22.5h21c0 2.2-4.7 3.4-10.5 3.4S5.5 24.7 5.5 22.5z" fill="#7a5a26" {...S1} />
      <path d="M10 16h12M9.3 19.5h13.4" stroke="#7a5a26" stroke-width={1.3} {...HI} />
      <path d="M12 11.5c.8-1.8 2-2.8 3.6-3" stroke="#e2c06a" stroke-width={1.5} {...HI} />
      <ellipse cx="20" cy="23.5" rx="2" ry="0.9" fill="#6aa892" />
      <path d="M14.5 6.5c0-2 3-2 3 0" stroke={INK} stroke-width={1.6} {...HI} />
      <path
        d="M3.5 13c-1 2.5-1 5 0 7.5M28.5 13c1 2.5 1 5 0 7.5"
        stroke="#f2e6b0"
        stroke-width={1.6}
        {...HI}
      />
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
