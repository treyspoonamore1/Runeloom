import { MAT, type MaterialId } from '../../../data/materials';
import { c3, f1 } from './glslLib';
import { TERRAIN as C, TERRAIN_LINE as L } from './terrainColors';

/** Line drawn where a material meets a lower-priority one: [color, width in cells, priority]. */
const EDGES: Partial<Record<MaterialId, [number, number, number]>> = {
  deep_water: [C.ink, L.deep, 10],
  pit: [C.ink, L.deep, 9],
  shallow_water: [C.ink, L.shore, 8],
  ice_bridge: [C.iceEdge, L.ground, 7],
  ice: [C.iceEdge, L.ground, 7],
  rime: [C.iceEdge, L.detail, 6],
  wood: [C.woodGap, L.ground, 6],
  bramble: [C.brambleDark, L.ground, 5],
  grass: [C.grassEdge, L.ground, 4],
  mud: [C.mudDark, L.ground, 3],
  metal_floor: [C.metalDark, L.ground, 3],
  dirt: [C.dirtEdge, L.ground, 2],
  vent_lit: [C.ink, L.ground, 6],
  vent_doused: [C.ink, L.ground, 6],
  ash: [C.ashDark, L.detail, 1],
};

/** GLSL const arrays EDGE_COL, EDGE_W, EDGE_P indexed by material code. */
export function edgeTable(): string {
  const n = Object.keys(MAT).length;
  const col: string[] = [];
  const wid: string[] = [];
  const pri: string[] = [];
  for (let code = 0; code < n; code++) {
    const id = (Object.keys(MAT) as MaterialId[]).find((k) => MAT[k] === code)!;
    const e = EDGES[id];
    col.push(c3(e ? e[0] : 0));
    wid.push(f1(e ? e[1] : 0));
    pri.push(String(e ? e[2] : 0));
  }
  return `const vec3 EDGE_COL[${n}] = vec3[${n}](${col.join(', ')});
const float EDGE_W[${n}] = float[${n}](${wid.join(', ')});
const int EDGE_P[${n}] = int[${n}](${pri.join(', ')});`;
}
