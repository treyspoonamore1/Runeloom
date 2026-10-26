/**
 * Regression (M6 playtest crash "No atlas texture rift_warden_flash"): every enemy kind the sim can
 * spawn has its body and hit-flash sprites, under its own kind or the kind it looks like (lookAs).
 */
import { describe, expect, it } from 'vitest';
import { enemies, lookKind } from '../../data/enemies';
import { enemyAtlasEntries } from '../../src/render/enemyShapes';
import { bigBeastEntries } from '../../src/render/bestiary/bigBeasts';
import { smallBeastEntries } from '../../src/render/bestiary/smallBeasts';
import { fenPlaceholderEntries } from '../../src/render/bestiary/fenPlaceholders';

describe('enemy art', () => {
  const names = new Set(
    [...enemyAtlasEntries(), ...bigBeastEntries(), ...smallBeastEntries(), ...fenPlaceholderEntries()].map(
      (e) => e.name,
    ),
  );

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
