/**
 * Fuse part art (data/fuseParts.ts): the monster bit each part is, drawn in its source's colors.
 * The tier (I to III) is drawn by the frame (itemArt.tsx), not here.
 */
import { Cased, HI, INK, S, S1, Sparkle, type Shape } from './ink';
import { FEN_PART_ART } from './partsFen';

function tinderTooth() {
  return (
    <>
      <path d="M9 4.5c5-1.5 11-1 14 1-1 9-3.5 16-7.5 22-3-6-5.5-13-6.5-23z" fill="#efe3c4" {...S} />
      <path d="M11.6 7.5c.6 5 1.6 9 3 12.5" stroke="#ffffff" stroke-width={1.3} {...HI} opacity={0.7} />
      <path d="M14 21.5c.6 2 1 3.6 1.5 6 1.3-2 2.5-4 3.5-6.4-1.6.8-3.4 1-5 .4z" fill="#ff7a2f" />
      <Sparkle x={24} y={23} r={3} color="#ffd75a" />
    </>
  );
}

function bogGill() {
  return (
    <>
      <path d="M5 26C4 15 9 6 20 4c6 4 8 13 5 22-6 2-14 2-20 0z" fill="#6f9a5a" {...S} />
      <path
        d="M10 24c0-6 2-11 6-15M14.5 24.5c.5-5 2-9 5-12.5M19.5 24.5c.5-4 1.5-7 3.5-9.5"
        stroke="#e88a8a"
        stroke-width={1.8}
        {...HI}
      />
      <path
        d="M10 24c0-6 2-11 6-15M14.5 24.5c.5-5 2-9 5-12.5"
        stroke={INK}
        stroke-width={0.6}
        {...HI}
        opacity={0.5}
      />
      <circle cx="9" cy="10" r="1.6" fill="#b8e0a0" />
      <circle cx="26.5" cy="27.5" r="1.4" fill="#9fe0ff" {...S1} />
    </>
  );
}

function tarGland() {
  return (
    <>
      <path d="M16 4c6 0 10 5 10 11 0 6-4 10-10 10S6 21 6 15 10 4 16 4z" fill="#2d2633" {...S} />
      <path
        d="M11 24.5v3.5a1.6 1.6 0 0 0 3.2 0V25M19.5 24.5v2a1.4 1.4 0 0 0 2.8 0v-3.5"
        fill="#2d2633"
        {...S1}
      />
      <path d="M10.5 11c1-2.5 3-4 5.5-4.3" stroke="#b48cff" stroke-width={1.6} {...HI} opacity={0.85} />
      <circle cx="11" cy="15" r="1.1" fill="#ffffff" opacity={0.7} />
      <path d="M17 13c2 0 3.5 1.5 3.5 3.5" stroke="#5a4a6a" stroke-width={1.2} {...HI} />
    </>
  );
}

function rimeMote() {
  return (
    <>
      <circle cx="16" cy="16" r="9.5" fill="#9fe0ff" opacity={0.3} />
      <path
        d="M16 3v26M4.8 9.5l22.4 13M4.8 22.5l22.4-13"
        stroke={INK}
        stroke-width={4.4}
        stroke-linecap="round"
      />
      <path
        d="M16 3v26M4.8 9.5l22.4 13M4.8 22.5l22.4-13"
        stroke="#c8f0ff"
        stroke-width={2}
        stroke-linecap="round"
      />
      <path d="M13 5.5l3 3 3-3M13 26.5l3-3 3 3" stroke="#c8f0ff" stroke-width={1.3} {...HI} />
      <path d="M16 10.5l4.8 2.8v5.4L16 21.5l-4.8-2.8v-5.4z" fill="#effcff" {...S1} />
    </>
  );
}

function shieldPlate() {
  return (
    <>
      <path d="M5 6.5C11 3.5 21 3.5 27 6.5c0 10-3 17-11 22C8 23.5 5 16.5 5 6.5z" fill="#8f9bb0" {...S} />
      <path
        d="M9 9.5c4.5-1.8 9.5-1.8 14 0-.4 6.6-2.6 11.5-7 15-4.4-3.5-6.6-8.4-7-15z"
        fill="#a8b3c6"
        {...S1}
      />
      <path d="M11.5 11c2.5-.8 4.5-1 6.5-1" stroke="#ffffff" stroke-width={1.3} {...HI} opacity={0.7} />
      <circle cx="8" cy="8" r="1.1" fill={INK} />
      <circle cx="24" cy="8" r="1.1" fill={INK} />
      <circle cx="16" cy="25" r="1.1" fill={INK} />
    </>
  );
}

function stormAntler() {
  return (
    <>
      <Cased d="M9 29c0-8 2-14 7-19M11.5 19.5L6 13M14 13L13 6M16 10l6-3.5" color="#e9dfc6" w={2.6} />
      <path d="M10.4 25.5c.3-5 1.6-9.5 4.4-13.5" stroke="#ffffff" stroke-width={0.9} {...HI} opacity={0.7} />
      <path d="M25 9l-3.5 5h3L22 19l5-6.5h-3l2.5-3.5z" fill="#ffe95a" {...S1} />
      <path d="M5 6.5l2 2.5M27.5 21l-2.5 1" stroke="#9fb4ff" stroke-width={1.6} {...HI} />
    </>
  );
}

function emberFeather() {
  return (
    <>
      <path d="M6 27C6 15 14 5 27 3.5c-1 13-9 21-21 23.5z" fill="#ff7a2f" {...S} />
      <path d="M8.5 22.5C11 14 17 8.5 24.5 6" stroke="#ffd75a" stroke-width={2} {...HI} />
      <path d="M13 21l-2-3.5M17 17.5l-2.4-4.5M20.6 13l-2.2-4" stroke="#c4302a" stroke-width={1.2} {...HI} />
      <Cased d="M3.5 29.5L9 24" color="#c99a5f" w={1.4} />
    </>
  );
}

function kilnChitin() {
  return (
    <>
      <path d="M4 22C5 11 11 5 16 5s11 6 12 17c-4 4-20 4-24 0z" fill="#8a3a2a" {...S} />
      <path d="M8 14.5c5-2 11-2 16 0M6 19c6.5-2 13.5-2 20 0" stroke="#ff9a52" stroke-width={1.6} {...HI} />
      <path d="M16 5.5v19" stroke={INK} stroke-width={1.3} {...HI} />
      <path d="M10.5 9.5c1.4-1.6 3-2.5 4.5-2.8" stroke="#ffd0b0" stroke-width={1.3} {...HI} opacity={0.7} />
    </>
  );
}

function matriarchsSac() {
  return (
    <>
      <path
        d="M16 3.5c2 0 2.5 2 2.5 3.5 5 2 8.5 7 8.5 12 0 5.5-5 9.5-11 9.5S5 24.5 5 19c0-5 3.5-10 8.5-12 0-1.5.5-3.5 2.5-3.5z"
        fill="#d9a050"
        {...S}
      />
      <circle cx="12" cy="17" r="2.2" fill="#2d2633" />
      <circle cx="18.5" cy="15" r="1.9" fill="#2d2633" />
      <circle cx="16.5" cy="21.5" r="2.1" fill="#2d2633" />
      <circle cx="21.5" cy="21" r="1.5" fill="#2d2633" />
      <path d="M9 13c1-1.8 2.5-3 4.5-3.6" stroke="#fff4d6" stroke-width={1.4} {...HI} opacity={0.8} />
    </>
  );
}

function cinderHeart() {
  return (
    <>
      <path
        d="M16 28.5S4 21 4 12a6 6 0 0 1 12-1.5A6 6 0 0 1 28 12c0 9-12 16.5-12 16.5z"
        fill="#3a2a30"
        {...S}
      />
      <path
        d="M10 10.5l3 4-2 3.5 4 3M16 11l1 5 4-2 1.5 4.5M20.5 21l-3.5 3"
        stroke="#ff7a2f"
        stroke-width={1.8}
        {...HI}
      />
      <path d="M13 14.5l-2 3.5 4 3M17 16l4-2" stroke="#ffd75a" stroke-width={0.9} {...HI} />
      <path
        d="M16 1.5c.8 1.8 3 2.4 2.4 4.6-.7-.6-1.6-.6-2.4.2-.8-.8-1.7-.8-2.4-.2-.6-2.2 1.6-2.8 2.4-4.6z"
        fill="#ffd75a"
        {...S1}
      />
    </>
  );
}

/** Art for each Fuse part id. */
export const PART_ART: Record<string, Shape> = {
  tinder_tooth: tinderTooth,
  bog_gill: bogGill,
  tar_gland: tarGland,
  rime_mote: rimeMote,
  shield_plate: shieldPlate,
  storm_antler: stormAntler,
  ember_feather: emberFeather,
  kiln_chitin: kilnChitin,
  matriarchs_sac: matriarchsSac,
  cinder_heart: cinderHeart,
  ...FEN_PART_ART,
};

/** A part we have no art for: a plain bone shard (the old slot icon's shape). */
export function unknownPart() {
  return (
    <>
      <path d="M6 22c0-9 6-16 14-17-2 4-1 7 2 9 3 2 5 6 3 11-6-2-13 0-19-3z" fill="#e8d6b0" {...S} />
      <circle cx="17" cy="16" r="2.4" fill="#a59cc8" {...S1} />
    </>
  );
}
