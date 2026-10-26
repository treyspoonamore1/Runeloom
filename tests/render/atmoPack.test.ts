import { describe, expect, it } from 'vitest';
import { AIR, MAT } from '../../data/materials';
import { buildRoom, createGrid, parseRoom } from '../../src/sim';
import { AtmoPack } from '../../src/render/terrain/atmoPack';
import { TERRAIN_FX } from '../../src/render/terrain/terrainColors';
import { GRID_HZ, TerrainPack } from '../../src/render/terrain/terrainPack';
import { REGION, regionOf } from '../../src/render/terrain/regionLook';
import { defaultTuning } from '../../data/tuning';

const ROOM = `@id test/atmo\n@name Atmo\n@level 1\n@fog 2 0 3 1\n....\n.f..\n`;
const texel = (buf: Uint8Array, i: number): number[] => Array.from(buf.subarray(i * 4, i * 4 + 4));

function setup() {
  const grid = createGrid(buildRoom(parseRoom(ROOM)));
  const pack = new AtmoPack(grid.width, grid.height);
  pack.pack(grid);
  return { grid, pack };
}

describe('AtmoPack (M8 fog, gusts, borrowed)', () => {
  it('packs fog cells full and leaves the rest clear', () => {
    const { pack } = setup();
    expect(pack.hasFog).toBe(true);
    expect(texel(pack.atmo, 9)[0]).toBe(255); // tile (2, 0)
    expect(texel(pack.atmo, 1)[0]).toBe(0);
  });

  it('thickens cleared fog back in over its last second', () => {
    const { grid, pack } = setup();
    const i = 9;
    expect(grid.air[i]).toBe(AIR.fog);
    grid.air[i] = AIR.none;
    grid.airTimer[i] = 100;
    pack.pack(grid);
    expect(texel(pack.atmo, i)[0]).toBe(0);
    grid.airTimer[i] = Math.round((TERRAIN_FX.fogReturnSeconds * GRID_HZ) / 2);
    pack.pack(grid);
    expect(texel(pack.atmo, i)[0]).toBeGreaterThan(100);
    expect(texel(pack.atmo, i)[0]).toBeLessThan(160);
  });

  it('packs a gust as strength and a unit direction', () => {
    const { grid, pack } = setup();
    grid.gustDir[0] = 3; // north
    grid.gustTimer[0] = 40;
    pack.pack(grid);
    const [, s, x, y] = texel(pack.atmo, 0);
    expect(s).toBe(255);
    expect(x).toBe(128);
    expect(y).toBe(0);
    expect(pack.gusts).toBe(true);
  });

  it('marks borrowed cells and their last 1.5 s with the ground they return to', () => {
    const { grid, pack } = setup();
    grid.ground[0] = MAT.shallow_water;
    grid.under[0] = MAT.stone;
    grid.borrowed[0] = 1;
    grid.timer[0] = 100;
    pack.pack(grid);
    expect(texel(pack.extra, 0)).toEqual([MAT.stone, 0, 255, 0]);
    grid.timer[0] = Math.round(defaultTuning.tide.flickerSeconds * GRID_HZ * 0.5);
    pack.pack(grid);
    const e = texel(pack.extra, 0);
    expect(e[1]).toBeGreaterThan(100);
    expect(e[1]).toBeLessThan(160);
  });

  it('feeds lit vents to the fire pass and not doused ones', () => {
    const grid = createGrid(buildRoom(parseRoom(ROOM)));
    const tp = new TerrainPack(grid.width, grid.height);
    tp.pack(grid);
    const vent = 5 * grid.width + 5; // tile (1, 1)
    expect(grid.ground[vent]).toBe(MAT.vent_lit);
    expect(texel(tp.fields[tp.cur], vent)[0]).toBe(TERRAIN_FX.ventHeat);
    grid.ground[vent] = MAT.vent_doused;
    grid.version++;
    tp.pack(grid);
    expect(texel(tp.fields[tp.cur], vent)[0]).toBe(0);
  });

  it('picks the region look by room id', () => {
    expect(regionOf('fen/g1_storm_landing')).toBe(REGION.fen);
    expect(regionOf('foundry/f1_sluice_gate')).toBe(REGION.foundry);
    expect(regionOf('test/fen_render')).toBe(REGION.fen);
    expect(regionOf('kiln/k1_gate')).toBe(REGION.base);
    expect(regionOf('emberwood/e1_glade')).toBe(REGION.base);
  });

  it("a room's @look wins over its id (Fen chunks in rifts)", () => {
    expect(regionOf('rift/3/r2', 'fen')).toBe(REGION.fen);
    expect(regionOf('rift/3/boss', 'foundry')).toBe(REGION.foundry);
    expect(regionOf('rift/3/r1')).toBe(REGION.base);
  });
});
