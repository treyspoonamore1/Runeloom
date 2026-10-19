import { BufferImageSource, Container, GlProgram, Mesh, MeshGeometry, Shader, UniformGroup } from 'pixi.js';
import type { Grid } from '../../sim';
import { DEBUG_MAIN } from './glslDebug';
import { LIB, VERTEX } from './glslLib';
import { MATERIALS } from './glslMaterials';
import { PASS_MAINS } from './glslPasses';
import { GRID_HZ, TerrainPack } from './terrainPack';

type Pass = 'ground' | 'fire' | 'air' | 'debug';

/** Embers store the low byte of the grid tick, so repack before it can wrap. */
const EMBER_REPACK_TICKS = 100;
/** Keep the shader clock small enough for float precision. */
const TIME_WRAP = 3600;

function program(pass: Pass): GlProgram {
  const main = pass === 'debug' ? DEBUG_MAIN : PASS_MAINS[pass];
  const needsMaterials = pass === 'ground';
  return new GlProgram({
    name: `terrain-${pass}`,
    vertex: VERTEX,
    fragment: `${LIB}\n${needsMaterials ? MATERIALS : ''}\n${main}`,
  });
}

function dataSource(data: Uint8Array, width: number, height: number, linear: boolean): BufferImageSource {
  return new BufferImageSource({
    resource: data,
    width,
    height,
    format: 'rgba8unorm',
    alphaMode: 'no-premultiply-alpha',
    scaleMode: linear ? 'linear' : 'nearest',
    addressMode: 'clamp-to-edge',
    autoGenerateMipmaps: false,
  });
}

interface Sources {
  codes: BufferImageSource;
  fields: [BufferImageSource, BufferImageSource];
  masks: BufferImageSource;
  glow: BufferImageSource;
}

/**
 * The grid terrain (DESIGN §12): the grid packed into data textures, re-uploaded when
 * `grid.version` changes (at most once per frame, only the changed texel span), drawn by one
 * shader per layer. Layers are separate containers so the renderer can slot them between the
 * entity layers: ground (floor), fire (flames over props), air (smoke over entities), debug (F1).
 * Reads the grid, never writes it.
 */
export class TerrainView {
  readonly ground = new Container();
  readonly fire = new Container();
  readonly air = new Container();
  readonly debug = new Container();
  /** CPU ms of the last pack + upload (0 on frames without one). */
  lastUploadMs = 0;
  private pack: TerrainPack | null = null;
  private sources: Sources | null = null;
  private grid: Grid | null = null;
  private meshes: Mesh<MeshGeometry, Shader>[] = [];
  private uploadedVersion = -1;
  private packTick = 0;
  private uploadTime = 0;
  private readonly uniforms = new UniformGroup({
    uSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uGlowSize: { value: new Float32Array(2), type: 'vec2<f32>' },
    uTime: { value: 0, type: 'f32' },
    uMix: { value: 1, type: 'f32' },
    uTick: { value: 0, type: 'f32' },
    uFlags: { value: 0, type: 'f32' },
  });
  private readonly programs: Record<Pass, GlProgram> = {
    ground: program('ground'),
    fire: program('fire'),
    air: program('air'),
    debug: program('debug'),
  };
  private readonly shaders: Partial<Record<Pass, Shader>> = {};

  /** Debug overlay bits (glslDebug DEBUG_BITS); 0 hides the debug layer. */
  set debugFlags(bits: number) {
    this.uniforms.uniforms.uFlags = bits;
    this.debug.visible = bits !== 0;
  }

  /** Rebuilds textures and quads for a new grid (room change or reset). */
  setGrid(grid: Grid): void {
    this.grid = grid;
    const { width, height } = grid;
    if (!this.pack || this.pack.width !== width || this.pack.height !== height) this.rebuild(width, height);
    // Pack twice so the previous and current field buffers both hold this grid.
    this.pack!.pack(grid);
    this.pack!.pack(grid);
    this.uploadAll();
    this.uploadedVersion = grid.version;
    this.packTick = grid.tick;
  }

  update(grid: Grid, time: number): void {
    if (grid !== this.grid) this.setGrid(grid);
    const pack = this.pack!;
    const stale = pack.embersLive && grid.tick - this.packTick > EMBER_REPACK_TICKS;
    this.lastUploadMs = 0;
    if (grid.version !== this.uploadedVersion || stale) {
      const t0 = performance.now();
      pack.pack(grid);
      this.uploadDirty();
      this.lastUploadMs = performance.now() - t0;
      this.uploadedVersion = grid.version;
      this.packTick = grid.tick;
      this.uploadTime = time;
    }
    const u = this.uniforms.uniforms;
    u.uTime = time % TIME_WRAP;
    u.uMix = Math.min(1, Math.max(0, (time - this.uploadTime) * GRID_HZ));
    u.uTick = grid.tick;
  }

  /** Count of raised-block cells at the last pack (the baked layer re-bakes when it changes). */
  get blockCells(): number {
    return this.pack?.blockCells ?? 0;
  }

  /** The grid version of the last upload. */
  get version(): number {
    return this.uploadedVersion;
  }

  private rebuild(width: number, height: number): void {
    for (const m of this.meshes) m.destroy();
    this.meshes = [];
    if (this.sources) {
      const s = this.sources;
      for (const src of [s.codes, s.fields[0], s.fields[1], s.masks, s.glow]) src.destroy();
    }
    const pack = new TerrainPack(width, height);
    this.pack = pack;
    this.sources = {
      codes: dataSource(pack.codes, width, height, false),
      fields: [dataSource(pack.fields[0], width, height, true), dataSource(pack.fields[1], width, height, true)],
      masks: dataSource(pack.masks, width, height, true),
      glow: dataSource(pack.glow, pack.tilesW, pack.tilesH, true),
    };
    const u = this.uniforms.uniforms;
    (u.uSize as Float32Array).set([width, height]);
    (u.uGlowSize as Float32Array).set([pack.tilesW, pack.tilesH]);
    const geometry = new MeshGeometry({
      positions: new Float32Array([0, 0, width, 0, width, height, 0, height]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    const layers: Record<Pass, Container> = {
      ground: this.ground,
      fire: this.fire,
      air: this.air,
      debug: this.debug,
    };
    for (const pass of ['ground', 'fire', 'air', 'debug'] as const) {
      this.shaders[pass]?.destroy();
      const shader = new Shader({
        glProgram: this.programs[pass],
        resources: {
          terrain: this.uniforms,
          uCodes: this.sources.codes,
          uFields: this.sources.fields[pack.cur]!,
          uFieldsPrev: this.sources.fields[1 - pack.cur]!,
          uMasks: this.sources.masks,
          uGlow: this.sources.glow,
        },
      });
      this.shaders[pass] = shader;
      const mesh = new Mesh({ geometry, shader });
      this.meshes.push(mesh);
      layers[pass].addChild(mesh);
    }
  }

  private bindFields(): void {
    const s = this.sources!;
    const cur = this.pack!.cur;
    for (const shader of Object.values(this.shaders)) {
      shader.resources.uFields = s.fields[cur];
      shader.resources.uFieldsPrev = s.fields[1 - cur];
    }
  }

  private uploadAll(): void {
    const s = this.sources!;
    for (const src of [s.codes, s.fields[0], s.fields[1], s.masks, s.glow]) src.update();
    this.bindFields();
  }

  private uploadDirty(): void {
    const s = this.sources!;
    const pack = this.pack!;
    const d = pack.dirty;
    if (d.codes[0]! < d.codes[1]!) s.codes.update(d.codes[0], d.codes[1]);
    if (d.fields[0]! < d.fields[1]!) s.fields[pack.cur].update(d.fields[0], d.fields[1]);
    if (d.masks[0]! < d.masks[1]!) s.masks.update(d.masks[0], d.masks[1]);
    s.glow.update();
    this.bindFields();
  }

  destroy(): void {
    for (const m of this.meshes) m.destroy();
    for (const sh of Object.values(this.shaders)) sh.destroy();
    if (this.sources) {
      const s = this.sources;
      for (const src of [s.codes, s.fields[0], s.fields[1], s.masks, s.glow]) src.destroy();
    }
  }
}
