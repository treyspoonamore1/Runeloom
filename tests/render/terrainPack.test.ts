import { describe, expect, it } from 'vitest';
import { AIR, MAT, OWNER, SURFACE } from '../../data/materials';
import { buildRoom, createGrid, parseRoom, type Grid } from '../../src/sim';
import { TERRAIN_FX } from '../../src/render/terrain/terrainColors';
import { FLAG, GRID_HZ, TerrainPack } from '../../src/render/terrain/terrainPack';

/**
 * One tile of each look in a row (4×4 cells per tile), on a stone floor:
 * stone grass shallow deep ice bridge woodfloor crate oil oil-water metal mud pit bramble barrel
 * barricade brazier door wall.
 */
const TILES = '."~wi=+cOomp:_*b|BD#';
const ROOM = `@id test/pack\n@name Pack\n@level 1\n${'.'.repeat(TILES.length)}\n${TILES.replace('p', '.')}\n${'.'.repeat(TILES.length)}\n`;

function setup(): { grid: Grid; pack: TerrainPack } {
  const grid = createGrid(buildRoom(parseRoom(ROOM)));
  const pack = new TerrainPack(grid.width, grid.height);
  pack.pack(grid);
  pack.pack(grid);
  return { grid, pack };
}

/** Index of the center-ish cell of tile column tx in the middle tile row. */
const cellOf = (grid: Grid, tx: number): number => (4 + 1) * grid.width + tx * 4 + 1;
const texel = (buf: Uint8Array, i: number): number[] => Array.from(buf.subarray(i * 4, i * 4 + 4));
const col = (ch: string): number => TILES.replace('p', '.').indexOf(ch);
const fields = (p: TerrainPack): Uint8Array => p.fields[p.cur];
const prevFields = (p: TerrainPack): Uint8Array => p.fields[1 - p.cur];

function tick(grid: Grid, pack: TerrainPack): void {
  grid.tick++;
  grid.version++;
  pack.pack(grid);
}

describe('TerrainPack codes', () => {
  const { grid, pack } = setup();
  const code = (ch: string): number[] => texel(pack.codes, cellOf(grid, col(ch)));

  it('stores the true ground in A and the painted ground in R', () => {
    const cases: [string, number, number][] = [
      ['.', MAT.stone, MAT.stone],
      ['"', MAT.grass, MAT.grass],
      ['~', MAT.shallow_water, MAT.shallow_water],
      ['w', MAT.deep_water, MAT.deep_water],
      ['i', MAT.ice, MAT.ice],
      ['=', MAT.wood, MAT.wood],
      ['m', MAT.metal_floor, MAT.metal_floor],
      [':', MAT.mud, MAT.mud],
      ['_', MAT.pit, MAT.pit],
      ['*', MAT.bramble, MAT.bramble],
      ['#', MAT.wall, MAT.wall],
      // Props: the baked layer draws them, the floor under them shows their under material or stone.
      ['c', MAT.stone, MAT.crate],
      ['b', MAT.stone, MAT.oil_barrel],
      ['|', MAT.stone, MAT.barricade],
      ['B', MAT.stone, MAT.brazier],
      ['D', MAT.stone, MAT.object],
    ];
    for (const [ch, painted, truth] of cases) {
      const [r, , , a] = code(ch);
      expect([ch, r, a]).toEqual([ch, painted, truth]);
    }
  });

  it('flags oil, wood over deep water and nothing else', () => {
    expect(code('O')[1]! & FLAG.oil).toBe(FLAG.oil);
    expect(code('o')[1]! & FLAG.oil).toBe(FLAG.oil);
    expect(code('.')[1]! & FLAG.oil).toBe(0);
    expect(code('=')[1]! & FLAG.overWater).toBe(FLAG.overWater);
    expect(code('+')[1]! & FLAG.overWater).toBe(0);
  });

  it('packs owner and air into the flags', () => {
    const i = cellOf(grid, col('.'));
    grid.owner[i] = OWNER.enemy;
    grid.air[i] = AIR.steam;
    grid.airTimer[i] = 40;
    tick(grid, pack);
    const flags = texel(pack.codes, i)[1]!;
    expect((flags >> FLAG.ownerShift) & 3).toBe(OWNER.enemy);
    expect((flags >> FLAG.airShift) & 3).toBe(AIR.steam);
    expect(texel(fields(pack), i)[3]).toBe(Math.min(255, 40 * TERRAIN_FX.airFadeScale));
  });

  it('counts raised-block cells (walls, objects, braziers)', () => {
    // Border-free room: one wall tile, one door (object), one brazier tile = 3 × 16 cells.
    expect(pack.blockCells).toBe(3 * 16);
  });
});

describe('TerrainPack phases', () => {
  it('ice bridge crack progress rises as its timer runs down', () => {
    const { grid, pack } = setup();
    const i = cellOf(grid, col('w'));
    grid.ground[i] = MAT.ice_bridge;
    const crack = Math.round(1.5 * GRID_HZ);
    grid.timer[i] = crack * 4;
    tick(grid, pack);
    expect(texel(pack.codes, i)[2]).toBe(0);
    grid.timer[i] = crack / 2;
    tick(grid, pack);
    expect(texel(pack.codes, i)[2]).toBe(Math.round(255 * 0.5));
    grid.timer[i] = 1;
    tick(grid, pack);
    expect(texel(pack.codes, i)[2]).toBeGreaterThan(240);
  });

  it('thawing ice shows its last seconds; permanent ice (timer 0) never does', () => {
    const { grid, pack } = setup();
    const i = cellOf(grid, col('i'));
    expect(texel(pack.codes, i)[2]).toBe(0);
    const thaw = Math.round(TERRAIN_FX.thawShowSeconds * GRID_HZ);
    grid.timer[i] = thaw / 2;
    tick(grid, pack);
    expect(texel(pack.codes, i)[2]).toBe(Math.round(255 * 0.5));
  });

  it('marks embers when a fire goes out and clears them after emberSeconds', () => {
    const { grid, pack } = setup();
    const i = cellOf(grid, col('"'));
    grid.fire[i] = 192;
    tick(grid, pack);
    expect(texel(pack.codes, i)[1]! & FLAG.ember).toBe(0);
    grid.fire[i] = 0;
    grid.ground[i] = MAT.ash;
    tick(grid, pack);
    const [, flags, phase] = texel(pack.codes, i);
    expect(flags! & FLAG.ember).toBe(FLAG.ember);
    expect(phase).toBe(grid.tick & 255);
    expect(pack.embersLive).toBe(true);
    grid.tick += Math.round(TERRAIN_FX.emberSeconds * GRID_HZ) + 2;
    tick(grid, pack);
    expect(texel(pack.codes, i)[1]! & FLAG.ember).toBe(0);
    expect(pack.embersLive).toBe(false);
  });
});

describe('TerrainPack fields and masks', () => {
  it('scales charge by the rule 11 falloff, with a floor and a fade-out', () => {
    const { grid, pack } = setup();
    const i = cellOf(grid, col('~'));
    grid.charge[i] = 20;
    grid.chargeFalloff[i] = 0.5;
    tick(grid, pack);
    expect(texel(fields(pack), i)[1]).toBe(Math.round(255 * 0.5));
    grid.chargeFalloff[i] = 0.1;
    tick(grid, pack);
    expect(texel(fields(pack), i)[1]).toBe(TERRAIN_FX.chargeMinStrength);
    grid.chargeFalloff[i] = 1;
    grid.charge[i] = TERRAIN_FX.chargeFadeTicks / 2;
    tick(grid, pack);
    expect(texel(fields(pack), i)[1]).toBe(Math.round(255 * 0.5));
  });

  it('marks fire and charge as hostile unless the player owns them', () => {
    const { grid, pack } = setup();
    const a = cellOf(grid, col('"'));
    const b = a + 1;
    grid.fire[a] = 128;
    grid.owner[a] = OWNER.world;
    grid.fire[b] = 128;
    grid.owner[b] = OWNER.player;
    tick(grid, pack);
    expect(texel(pack.masks, a)[2]).toBe(255);
    expect(texel(pack.masks, b)[2]).toBe(0);
  });

  it('keeps the previous upload in the other field buffer', () => {
    const { grid, pack } = setup();
    const i = cellOf(grid, col('"'));
    grid.fire[i] = 100;
    tick(grid, pack);
    grid.fire[i] = 200;
    tick(grid, pack);
    expect(texel(fields(pack), i)[0]).toBe(200);
    expect(texel(prevFields(pack), i)[0]).toBe(100);
  });

  it('sums fire into the per-tile glow', () => {
    const { grid, pack } = setup();
    const tx = col('"');
    const k = (1 * pack.tilesW + tx) * 4;
    expect(pack.glow[k]).toBe(0);
    for (let cy = 4; cy < 8; cy++)
      for (let cx = tx * 4; cx < tx * 4 + 4; cx++) grid.fire[cy * grid.width + cx] = 200;
    tick(grid, pack);
    expect(pack.glow[k]).toBeGreaterThan(100);
    expect(pack.glow[k + 2]).toBe(0);
  });
});

describe('TerrainPack changed spans', () => {
  it('reports an empty span when nothing changed', () => {
    const { grid, pack } = setup();
    tick(grid, pack);
    tick(grid, pack);
    for (const span of [pack.dirty.codes, pack.dirty.fields, pack.dirty.masks])
      expect(span[0]! >= span[1]!).toBe(true);
  });

  it('spans exactly the changed cells, including cells in long-quiet words', () => {
    const { grid, pack } = setup();
    for (let k = 0; k < 4; k++) tick(grid, pack);
    const i = cellOf(grid, col('.')) + 2;
    const j = cellOf(grid, col('#')) - 1;
    grid.fire[i] = 128;
    grid.surface[j] = SURFACE.oil;
    tick(grid, pack);
    expect(pack.dirty.fields).toEqual([i, i + 1]);
    expect(pack.dirty.masks).toEqual([i, j + 1]);
    expect(pack.dirty.codes).toEqual([j, j + 1]); // fire alone leaves the codes texel as it was
    expect(texel(fields(pack), i)[0]).toBe(128);
    // The other field buffer catches up on the next pack (it still held the old value).
    tick(grid, pack);
    expect(pack.dirty.fields).toEqual([i, i + 1]);
    expect(texel(fields(pack), i)[0]).toBe(128);
  });

  it('picks up a ground change in an otherwise quiet word', () => {
    const { grid, pack } = setup();
    for (let k = 0; k < 4; k++) tick(grid, pack);
    const i = cellOf(grid, col('~'));
    grid.ground[i] = MAT.ice;
    tick(grid, pack);
    expect(texel(pack.codes, i)[0]).toBe(MAT.ice);
    expect(pack.dirty.codes).toEqual([i, i + 1]);
  });
});
