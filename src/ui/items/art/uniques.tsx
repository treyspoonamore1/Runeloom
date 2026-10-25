/**
 * Unique art (data/uniques.ts): each unique is its base recolored, with one accent that says what
 * it does (a golden thread, kiln embers, frost, lightning, flames, fraying threads).
 */
import { boots, charm, cloak, hood } from './gear';
import { Cased, HI, S1, Sparkle, type Shape } from './ink';
import { twig } from './spindles';

function theFirstThread() {
  return (
    <>
      {twig({ wood: '#d9a55a', leaf: '#ffd75a', thread: '#ffd75a' })}
      <Cased d="M3.5 24.5c3 0 3-3.5 6-3.5s3-3.5 6-3.5 3-3.5 6-3.5 3-3.5 6.5-3.5" color="#ffd75a" w={1.3} />
      <Sparkle x={7} y={9} r={3.2} />
      <Sparkle x={27} y={19} r={2.2} />
    </>
  );
}

function kilnHeartCloak() {
  return (
    <>
      {cloak({ main: '#43303f', lining: '#ff7a2f', clasp: '#ffd75a' })}
      <path d="M7 25.5l2-3 2 2 2-3M19 24.5l2-3 2 2 2-2.5" stroke="#ff9a52" stroke-width={1.3} {...HI} />
      <circle cx="16" cy="19" r="2.4" fill="#ffd75a" {...S1} />
    </>
  );
}

function rimewalkers() {
  return (
    <>
      {boots({ main: '#7fb8e8', back: '#4f7fb8', cuff: '#e8fbff', sole: '#2f4a7a' })}
      <path
        d="M8 29.5l1.6-3.5 1.6 3.5M15 29.5l1.6-3.5 1.6 3.5M22 29.5l1.6-3.5 1.6 3.5"
        fill="#e8fbff"
        {...S1}
      />
      <Sparkle x={26} y={8} r={3} color="#e8fbff" />
    </>
  );
}

function stormglassCharm() {
  return (
    <>
      {charm({ cord: '#8f9bb0', bone: '#9fe0ff', bead: '#ffd75a', mark: '#9fe0ff' })}
      <path d="M17.5 16.8l-3.4 5.2h2.8l-1.8 4.8 4.4-6.2h-2.8l2-3.8z" fill="#ffe95a" {...S1} />
      <Sparkle x={26} y={20} r={2.6} color="#ffe95a" />
    </>
  );
}

function pyreHood() {
  return (
    <>
      {hood({ main: '#b8322a', inner: '#2a0f14', trim: '#ffd75a', eyes: '#ff9a52' })}
      <path
        d="M16 .8c1.2 2.4 4.2 3.2 3.4 6.4-1-1-2.2-1-3.4.2-1.2-1.2-2.4-1.2-3.4-.2C11.8 4 14.8 3.2 16 .8z"
        fill="#ff9a52"
        {...S1}
      />
      <path
        d="M5.8 15c-1.8-1.6-1.8-4 0-5.6.4 1.6 1 2.4 2 2.8M26.2 15c1.8-1.6 1.8-4 0-5.6-.4 1.6-1 2.4-2 2.8"
        fill="#ffd75a"
        {...S1}
      />
    </>
  );
}

function theUnraveling() {
  return (
    <>
      {charm({ cord: '#b48cff', bone: '#d9ccff', bead: '#7a4ad9', mark: '#7a4ad9' })}
      <Cased d="M15 28.5c-2 1.5-5 .5-7.5 2M17 28.5c2 1 4 0 6.5 1.5" color="#b48cff" w={1.1} />
      <Cased d="M20.8 18.5c2.5-1 4.5.5 6.5-1.5" color="#b48cff" w={1.1} />
    </>
  );
}

/** Art for each unique id. */
export const UNIQUE_ART: Record<string, Shape> = {
  the_first_thread: theFirstThread,
  kiln_heart_cloak: kilnHeartCloak,
  rimewalkers,
  stormglass_charm: stormglassCharm,
  pyre_hood: pyreHood,
  the_unraveling: theUnraveling,
};
