/**
 * The M4 art gallery's room (`?scene=gallery`): a plain stone floor split into sections of
 * 20×12 tiles, with water pools and braziers where exhibits need them. Debug only.
 */
import { TILE_CELLS as T } from '../../sim';

export const SECTION_W = 20;
export const SECTION_H = 12;
const COLS = 4;
const ROWS = 4;

export const SECTION_IDS = [
  'beasts',
  'beasts2',
  'matriarch',
  'warden',
  'rarity',
  'telegraphs',
  'objects',
  'objects2',
  'loot',
  'moments',
  'telegraphs2',
  'moments2',
  'fen',
  'fen2',
] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** The section containing (x, y) cells. */
export function sectionAt(x: number, y: number): SectionId | undefined {
  const col = Math.floor((x / T - 1) / SECTION_W);
  const row = Math.floor((y / T - 1) / SECTION_H);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return undefined;
  return SECTION_IDS[row * COLS + col];
}

/** Top-left tile of a section. */
export function sectionTile(id: SectionId): { tx: number; ty: number } {
  const i = SECTION_IDS.indexOf(id);
  return { tx: 1 + (i % COLS) * SECTION_W, ty: 1 + Math.floor(i / COLS) * SECTION_H };
}

/** Top-left of a section in cells. */
export function sectionOrigin(id: SectionId): { x: number; y: number } {
  const i = SECTION_IDS.indexOf(id);
  return { x: (1 + (i % COLS) * SECTION_W) * T, y: (1 + Math.floor(i / COLS) * SECTION_H) * T };
}

/** Section center in cells. */
export function sectionCenter(id: SectionId): { x: number; y: number } {
  const o = sectionOrigin(id);
  return { x: o.x + (SECTION_W * T) / 2, y: o.y + (SECTION_H * T) / 2 };
}

export function galleryRoomText(): string {
  const w = COLS * SECTION_W + 2;
  const h = ROWS * SECTION_H + 2;
  const g: string[][] = [];
  for (let y = 0; y < h; y++)
    g.push(
      Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.')),
    );
  /** Fills tiles relative to a section's top-left tile. */
  const fill = (id: SectionId, tx: number, ty: number, tw: number, th: number, ch: string): void => {
    const i = SECTION_IDS.indexOf(id);
    const ox = 1 + (i % COLS) * SECTION_W;
    const oy = 1 + Math.floor(i / COLS) * SECTION_H;
    for (let y = ty; y < ty + th; y++) for (let x = tx; x < tx + tw; x++) g[oy + y]![ox + x] = ch;
  };
  // Beasts: a shallow pool for the Bog Lurker row, deep water under the Frost Wisp row.
  fill('beasts', 0, 0, 20, 4, '~');
  fill('beasts', 0, 8, 20, 3, 'w');
  // Warden: water under the phase 2 row, braziers around the phase 3 exhibit.
  fill('warden', 0, 7, 13, 5, '~');
  fill('warden', 15, 6, 1, 1, 'B');
  fill('warden', 19, 6, 1, 1, 'B');
  fill('warden', 15, 10, 1, 1, 'B');
  fill('warden', 19, 10, 1, 1, 'B');
  // Telegraphs: water for the lurker ripple, braziers for the storm glow.
  fill('telegraphs', 0, 0, 7, 4, '~');
  fill('telegraphs2', 14, 7, 1, 1, 'B');
  fill('telegraphs2', 18, 7, 1, 1, 'B');
  // Objects: braziers (lit and unlit) sit on brazier tiles; everything else draws on stone.
  fill('objects', 1, 1, 1, 1, 'B');
  fill('objects', 4, 1, 1, 1, 'B');
  fill('objects', 7, 1, 1, 1, 'B');
  // Doors set in a wall row: plain, locked and big-key, each closed, opening and open.
  fill('objects', 0, 8, 20, 1, '#');
  for (const [x, ch] of [
    [1, 'D'],
    [4, 'D'],
    [7, 'D'],
    [10, 'K'],
    [13, 'K'],
    [16, 'G'],
  ] as const)
    fill('objects', x, 8, 1, 1, ch);
  fill('objects2', 0, 1, 8, 1, '#');
  fill('objects2', 1, 1, 1, 1, 'G');
  fill('objects2', 4, 1, 1, 1, 'G');
  // A vertical wall with a door in it.
  fill('objects2', 17, 0, 1, 4, '#');
  fill('objects2', 17, 2, 1, 1, 'D');
  // Ice for the sliding ice block.
  fill('objects2', 1, 9, 12, 1, 'i');
  // Moments: a Loom Stone to respawn at sits in the objects layer; grass around it.
  fill('moments2', 4, 3, 12, 6, '"');
  // M8 Fen: a pool for the Glasspikes and a wading Heron, water for the Heron's strike, a ford for
  // the Bellshells, mud for a bogged Mirebull.
  fill('fen', 0, 0, 16, 4, '~');
  fill('fen', 2, 1, 4, 2, 'w');
  fill('fen', 16, 5, 4, 3, '~');
  fill('fen2', 12, 8, 8, 4, '~');
  fill('fen2', 11, 5, 4, 3, ':');
  const rows = g.map((r) => r.join(''));
  return ['@id test/gallery', '@name Gallery', '@level 1', ...rows].join('\n');
}

/** The crowd stress room: a wide meadow with ponds, sized past one 1× screen (160×90 cells). */
export function crowdRoomText(): string {
  const w = 52;
  const h = 32;
  const g: string[][] = [];
  for (let y = 0; y < h; y++)
    g.push(
      Array.from({ length: w }, (_, x) =>
        x === 0 || y === 0 || x === w - 1 || y === h - 1
          ? '#'
          : y % 9 < 4 && x % 13 < 5
            ? '~'
            : x % 7 < 3
              ? '"'
              : '.',
      ),
    );
  return ['@id test/gallery_crowd', '@name Crowd', '@level 1', ...g.map((r) => r.join(''))].join('\n');
}
