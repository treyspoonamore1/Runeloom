/**
 * Gear art (data/items.ts): cloak, hood, boots and charm bases. Each draws from a small palette so
 * a unique (uniques.tsx) can recolor its base and add an accent.
 */
import { Cased, HI, INK, S, S1, type Shape } from './ink';

export interface CloakColors {
  main?: string;
  lining?: string;
  clasp?: string;
}

export function cloak(c: CloakColors = {}) {
  return (
    <>
      <path d="M11 4.5h10l2.5 4.5 4 18c-4.5 2.4-18.5 2.4-23 0l4-18z" fill={c.main ?? '#c4623a'} {...S} />
      <path d="M16 12.5l-3.6 15.3c2.4.3 4.8.3 7.2 0z" fill={c.lining ?? '#7a2e24'} {...S1} />
      <path d="M9.8 13.5L7.6 25.5M22.2 13.5l2.2 12" stroke={INK} stroke-width={1.2} {...HI} opacity={0.55} />
      <path d="M11.6 7.4L8.4 21" stroke="#fff4d6" stroke-width={1.4} {...HI} opacity={0.45} />
      <path d="M12.5 8.5h7L16 13.5z" fill={c.clasp ?? '#f2c35b'} {...S1} />
      <circle cx="16" cy="10" r="1" fill="#fff4c4" />
    </>
  );
}

export interface HoodColors {
  main?: string;
  inner?: string;
  trim?: string;
  eyes?: string;
}

export function hood(c: HoodColors = {}) {
  return (
    <>
      <path d="M16 3.5c7 0 11 6 11 13.5v9.5H5V17C5 9.5 9 3.5 16 3.5z" fill={c.main ?? '#5d7ad9'} {...S} />
      <path
        d="M7.8 26.5v-7.5c0-5 3.6-9.2 8.2-9.2s8.2 4.2 8.2 9.2v7.5"
        stroke={c.trim ?? '#f1dbab'}
        stroke-width={1.1}
        stroke-dasharray="1.6 1.8"
        {...HI}
      />
      <path d="M10 26.5V19c0-4 3-7 6-7s6 3 6 7v7.5z" fill={c.inner ?? '#1d1838'} {...S1} />
      <circle cx="13.6" cy="20" r="1" fill={c.eyes ?? '#ffe9a8'} />
      <circle cx="18.4" cy="20" r="1" fill={c.eyes ?? '#ffe9a8'} />
      <path d="M8.8 10.5c1.6-2.6 3.6-4.2 6.2-4.7" stroke="#ffffff" stroke-width={1.4} {...HI} opacity={0.4} />
    </>
  );
}

export interface BootColors {
  main?: string;
  back?: string;
  cuff?: string;
  sole?: string;
}

export function boots(c: BootColors = {}) {
  const main = c.main ?? '#9a6a3c';
  return (
    <>
      <path d="M13 3.5h8v12l6 2c2.6 1 2.6 5 0 5H13z" fill={c.back ?? '#6e4a2a'} {...S} />
      <path d="M5 8h9v12l9 3c3 1 3 6 0 6H5z" fill={main} {...S} />
      <path d="M5 25.5h20.4" stroke={c.sole ?? INK} stroke-width={1.8} {...HI} />
      <path d="M4.5 7.5h10v4.5h-10z" fill={c.cuff ?? '#d9b27a'} {...S1} />
      <path d="M10 14.5l3 1.5M10 17.5l3 1.5" stroke="#f1dbab" stroke-width={1.1} {...HI} />
      <path d="M7.2 14v9" stroke="#fff4d6" stroke-width={1.3} {...HI} opacity={0.4} />
    </>
  );
}

export interface CharmColors {
  cord?: string;
  bone?: string;
  bead?: string;
  mark?: string;
}

export function charm(c: CharmColors = {}) {
  return (
    <>
      <Cased d="M9 2.5c0 6 2.5 9 7 10.5M23 2.5c0 6-2.5 9-7 10.5" color={c.cord ?? '#c99a5f'} w={1.4} />
      <path
        d="M11.5 16c2.4-1.4 6.6-1.4 9 0l-2.2 11.5c-1 2.3-3.6 2.3-4.6 0z"
        fill={c.bone ?? '#efe3c4'}
        {...S}
      />
      <path d="M13.8 18.4l1 6.6" stroke="#ffffff" stroke-width={1.2} {...HI} opacity={0.7} />
      <path d="M16.4 19.2l1.8 1.8-1.8 1.8" stroke={c.mark ?? '#8a5a3c'} stroke-width={1.2} {...HI} />
      <circle cx="16" cy="13.6" r="2.7" fill={c.bead ?? '#c4623a'} {...S1} />
    </>
  );
}

/** Art for each gear base id. */
export const GEAR_ART: Record<string, Shape> = {
  travelers_cloak: () => cloak(),
  wool_hood: () => hood(),
  leather_boots: () => boots(),
  bone_charm: () => charm(),
};

/** An unknown base of no kind we can tell: a wrapped bundle with a question mark. */
export function unknownItem() {
  return (
    <>
      <path d="M6 12l10-6 10 6v11l-10 6-10-6z" fill="#8a82ad" {...S} />
      <path d="M6 12l10 6 10-6M16 18v11" stroke={INK} stroke-width={1.4} {...HI} />
      <path
        d="M13.4 10.6a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1 .8-1 1.6"
        stroke="#fff4d6"
        stroke-width={1.5}
        {...HI}
      />
    </>
  );
}
