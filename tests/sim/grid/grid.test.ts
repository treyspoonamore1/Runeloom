import { describe, expect, it } from 'vitest';
import { buildRoom, cellIndex, createGrid, parseRoom, TILE_CELLS } from '../../../src/sim';
import { MAT, SURFACE } from '../../../data/materials';

function gridOf(rows: string[]) {
  const room = buildRoom(parseRoom(`@id test/g\n${rows.join('\n')}\n`));
  return createGrid(room);
}

/** Material code at the center of tile (tx, ty). */
function at(
  g: ReturnType<typeof gridOf>,
  tx: number,
  ty: number,
  field: 'ground' | 'under' | 'surface' = 'ground',
) {
  return g[field][cellIndex(g, tx * TILE_CELLS + 1, ty * TILE_CELLS + 1)];
}

describe('createGrid', () => {
  it('fills 4×4 cells per tile with the tile material', () => {
    const g = gridOf(['#"~w', ':m.,']);
    expect(g.width).toBe(4 * TILE_CELLS);
    expect(at(g, 0, 0)).toBe(MAT.wall);
    expect(at(g, 1, 0)).toBe(MAT.grass);
    expect(at(g, 2, 0)).toBe(MAT.shallow_water);
    expect(at(g, 3, 0)).toBe(MAT.deep_water);
    expect(at(g, 0, 1)).toBe(MAT.mud);
    expect(at(g, 1, 1)).toBe(MAT.metal_floor);
    // Every cell of a tile matches.
    for (let cy = 0; cy < TILE_CELLS; cy++)
      for (let cx = TILE_CELLS; cx < 2 * TILE_CELLS; cx++)
        expect(g.ground[cellIndex(g, cx, cy)]).toBe(MAT.grass);
  });

  it('records what bridges and floors reveal when they burn', () => {
    const g = gridOf(['=+']);
    expect(at(g, 0, 0)).toBe(MAT.wood);
    expect(at(g, 0, 0, 'under')).toBe(MAT.deep_water);
    expect(at(g, 1, 0, 'under')).toBe(MAT.pit);
  });

  it('puts oil on stone and on shallow water', () => {
    const g = gridOf(['oO']);
    expect(at(g, 0, 0)).toBe(MAT.stone);
    expect(at(g, 0, 0, 'surface')).toBe(SURFACE.oil);
    expect(at(g, 1, 0)).toBe(MAT.shallow_water);
    expect(at(g, 1, 0, 'surface')).toBe(SURFACE.oil);
  });

  it('puts markers on the most common neighbor ground (CONTENT §6.1)', () => {
    // H has deep water on three sides: it floats on deep water.
    const g = gridOf(['.w.', 'wHw', '...']);
    expect(at(g, 1, 1)).toBe(MAT.deep_water);
  });

  it('breaks marker ties in favor of stone', () => {
    // Two grass, two shallow water neighbors: a tie.
    const g = gridOf(['."', '~1"', '.~.'].map((r) => r.padEnd(3, '.')));
    expect(at(g, 1, 1)).toBe(MAT.stone);
  });
});
