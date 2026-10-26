/**
 * Regression (M6 playtest crash "No atlas texture rift_warden_flash"): every enemy kind the sim can
 * spawn has its body and hit-flash sprites, under its own kind or the kind it looks like (lookAs).
 */
import { describe, expect, it } from 'vitest';
import { enemies, lookKind } from '../../data/enemies';
import { enemyAtlasEntries } from '../../src/render/enemyShapes';
import { bigBeastEntries } from '../../src/render/bestiary/bigBeasts';
import { smallBeastEntries } from '../../src/render/bestiary/smallBeasts';
import { fenShapesA } from '../../src/render/bestiary/fenShapesA';
import { fenShapesB } from '../../src/render/bestiary/fenShapesB';
import { fenBossShapes } from '../../src/render/bestiary/fenBossShapes';
import { FEN_BOSS_LOOK } from '../../src/render/bestiary/fenBossPalette';
import { FEN_BOSS_RIGS } from '../../src/render/bestiary/fenBossRigs';
import { isM4Kind } from '../../src/render/bestiary/bestiaryPalette';
import { FEN_LOOK } from '../../src/render/bestiary/fenBeastPalette';
import { FEN_RIGS } from '../../src/render/bestiary/fenRigsB';

describe('enemy art', () => {
  const names = new Set(
    [
      ...enemyAtlasEntries(),
      ...bigBeastEntries(),
      ...smallBeastEntries(),
      ...fenShapesA(),
      ...fenShapesB(),
      ...fenBossShapes(),
    ].map((e) => e.name),
  );

  it('every Glasswater Fen kind has a look, a rig and its art radius matches the sim', () => {
    for (const kind of Object.keys(FEN_LOOK) as (keyof typeof FEN_LOOK)[]) {
      expect(FEN_RIGS[kind], kind).toBeDefined();
      expect(enemies[kind as keyof typeof enemies]?.radius, kind).toBe(FEN_LOOK[kind].radius);
    }
  });

  it('the Drowned Foundry bosses have their own art and rigs, not placeholders', () => {
    for (const kind of Object.keys(FEN_BOSS_LOOK) as (keyof typeof FEN_BOSS_LOOK)[]) {
      expect(FEN_BOSS_RIGS[kind], kind).toBeDefined();
      expect(isM4Kind(kind), kind).toBe(true);
      expect(enemies[kind as keyof typeof enemies], kind).toBeDefined();
    }
    for (const part of ['bellwether_shell', 'bellwether_head', 'coil_eye', 'coil_tail'])
      expect(names.has(part), part).toBe(true);
    expect(lookKind('rift_bellwether')).toBe('bellwether');
    expect(lookKind('rift_coil')).toBe('glasswater_coil');
  });

  it.each(Object.keys(enemies))('%s has body and flash sprites', (kind) => {
    const look = lookKind(kind);
    expect(names.has(`${look}_flash`), `${look}_flash`).toBe(true);
    expect(names.has(`${look}_body`), `${look}_body`).toBe(true);
  });

  it('rift bosses look like their region originals', () => {
    expect(lookKind('rift_warden')).toBe('cinder_warden');
    expect(lookKind('rift_matriarch')).toBe('tar_matriarch');
  });
});
