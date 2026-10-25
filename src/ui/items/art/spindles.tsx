/**
 * Spindle art (data/spindles.ts): a staff on the diagonal with a head at the top right, each base
 * in its own material. Twig is a crooked stick with a leaf, Ashwood pale wood with an ember,
 * Ironbark dark bark bound in iron, Rimeglass an ice crystal, Heartwood living wood with a heart
 * knot, Loomsteel polished steel with a gold whorl and a loom gem.
 */
import { Cased, HI, INK, S, S1, Sparkle, type Shape } from './ink';

export interface TwigColors {
  wood?: string;
  leaf?: string;
  thread?: string;
}

export function twig(c: TwigColors = {}) {
  const wood = c.wood ?? '#b47a43';
  return (
    <>
      <Cased d="M14.5 17.5L10.5 12.5" color={wood} w={1.8} />
      <Cased d="M5.5 27.5L12 20.5C13.5 19 14.5 18 15.5 16L22 9.5" color={wood} w={3.4} />
      <path d="M8 22.4l2.6 2.6M9.6 20.8l2.6 2.6" stroke={c.thread ?? '#f1dbab'} stroke-width={1.3} {...HI} />
      <path d="M20.5 10.5c-.5-4.5 2.5-7 7.5-7 .3 4.5-2.5 7.5-7.5 7z" fill={c.leaf ?? '#7fd36b'} {...S} />
      <path d="M21.5 9.5l4-4" stroke="#d8f5c4" stroke-width={1.1} {...HI} />
    </>
  );
}

function ashwood() {
  return (
    <>
      <Cased d="M5.5 27.5L20 13" color="#dcc8a2" w={3.8} />
      <path
        d="M8.2 23.2l1.8 1.8M12.2 19.2l1.8 1.8M15.6 15.8l1.6 1.6"
        stroke="#6a4a3a"
        stroke-width={1.3}
        {...HI}
      />
      <path d="M6.6 25.4l11.6-11.6" stroke="#fff4d6" stroke-width={0.9} {...HI} opacity={0.7} />
      <path
        d="M22 2.5c1 3 6 4.5 6 9.5a6 6 0 0 1-12 0c0-3 2-4 3-6.5 1 2 1 3 2 3.5.2-2.5-.4-4.5 1-6.5z"
        fill="#ff7a2f"
        {...S}
      />
      <path d="M22 8.5c0 2.2 3.2 3.2 3.2 5.5a3.2 3.2 0 0 1-6.4 0c0-2.2 3.2-3.3 3.2-5.5z" fill="#ffd75a" />
    </>
  );
}

function ironbark() {
  return (
    <>
      <Cased d="M5.5 27.5L19 14" color="#6b4a32" w={4.4} />
      <path d="M7.4 24.4l3.6-3.6M12.6 19.2l3-3" stroke="#3f2a1e" stroke-width={0.9} {...HI} />
      <Cased d="M8.2 21.4l2.8 2.8" color="#a8b3c6" w={2} />
      <Cased d="M13 16.6l2.8 2.8" color="#a8b3c6" w={2} />
      <path d="M17.5 7.5l4-4.5 6 1.5 1.5 6-4.5 4-6-1.5z" fill="#8f9bb0" {...S} />
      <path d="M21 5.5l5 1.2" stroke="#e2e8f2" stroke-width={1.4} {...HI} />
      <circle cx="21" cy="10" r="1.1" fill={INK} />
      <circle cx="25.5" cy="11" r="1.1" fill={INK} />
      <circle cx="24.6" cy="6.6" r="1.1" fill={INK} />
    </>
  );
}

function rimeglass() {
  return (
    <>
      <path d="M4.2 25.6l14.4-14.4 3.2 3.2L7.4 28.8z" fill="#9fe0ff" {...S} />
      <path d="M7 26.4l12.4-12.4" stroke="#effcff" stroke-width={1} {...HI} />
      <path d="M17 13.5l2-8 6.5-3 2.5 6.5-4.5 7z" fill="#c8f0ff" {...S} />
      <path d="M19 5.5l4.5 3.3 4.5-.3M23.5 8.8l0 6.4" stroke="#6cb8e6" stroke-width={1.2} {...HI} />
      <path d="M15.5 11.5l-4-3.5 4.5-1.5z" fill="#c8f0ff" {...S1} />
      <Sparkle x={9.5} y={9} r={2.6} color="#effcff" />
    </>
  );
}

function heartwood() {
  return (
    <>
      <Cased d="M5.5 27.5C9.5 23.5 11 21.5 13 19.5S18 14.5 20 12.5" color="#a5582f" w={3.6} />
      <path d="M8 26c1-2 3-1.5 3.5-3.5s2.5-1 3-3" stroke="#7fd36b" stroke-width={1.3} {...HI} />
      <path d="M12.5 19.5c-5 .5-7.5-2.5-7.5-6 4 0 7 2 7.5 6z" fill="#7fd36b" {...S} />
      <path d="M11.5 18.5L7.5 15" stroke="#d8f5c4" stroke-width={1} {...HI} />
      <path
        d="M22.5 17s-6.5-3.6-6.5-8a3.2 3.2 0 0 1 6.5-1 3.2 3.2 0 0 1 6.5 1c0 4.4-6.5 8-6.5 8z"
        fill="#e8484a"
        {...S}
      />
      <circle cx="19.6" cy="8.6" r="1.3" fill="#ffd0c4" />
      <path d="M24.5 4.5c.5-2.5 3-3.5 5-3-.5 2.5-2.5 3.5-5 3z" fill="#9be07f" {...S1} />
    </>
  );
}

function loomsteel() {
  return (
    <>
      <Cased d="M5.5 27.5L19.5 13.5" color="#c9d2e6" w={3.4} />
      <path d="M7 25l11-11" stroke="#ffffff" stroke-width={0.9} {...HI} />
      <path d="M13.6 17.4l2.6 2.6M14.8 16.2l2.6 2.6" stroke="#b48cff" stroke-width={1.6} {...HI} />
      <ellipse cx="10" cy="23" rx="5.2" ry="2.2" transform="rotate(-45 10 23)" fill="#f2c35b" {...S} />
      <Cased d="M17.8 13.2l2.6 2.6" color="#f2c35b" w={2} />
      <path d="M23 2l5.5 6-5.5 7-5.5-7z" fill="#b48cff" {...S} />
      <path d="M17.5 8h11M23 2v13" stroke="#e6d8ff" stroke-width={0.9} {...HI} opacity={0.8} />
      <path d="M21 4.8l-1.6 2" stroke="#ffffff" stroke-width={1.2} {...HI} />
    </>
  );
}

/** Dev-only test spindle: hazard pink with a checker head, so it is never mistaken for loot. */
function testSpindle() {
  return (
    <>
      <Cased d="M5.5 27.5L19 14" color="#ff5ad2" w={3.6} />
      <path d="M8.6 24.4l1.6-1.6M12.6 20.4l1.6-1.6" stroke={INK} stroke-width={3.2} />
      <rect x="18" y="3" width="10" height="10" rx="1.5" fill="#ffe9a8" {...S} />
      <path d="M18 3h5v5h-5zM23 8h5v5h-5z" fill={INK} />
    </>
  );
}

/** Art for each spindle base id. */
export const SPINDLE_ART: Record<string, Shape> = {
  twig: () => twig(),
  ashwood,
  ironbark,
  rimeglass,
  heartwood,
  loomsteel,
  test_spindle: testSpindle,
};
