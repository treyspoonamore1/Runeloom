/** Fixed simulation rate for entities (DESIGN §12, CLAUDE.md rule 2). */
export const SIM_HZ = 60;
/** Seconds per sim tick. */
export const DT = 1 / SIM_HZ;
/** The chemistry grid ticks every Nth sim tick (20 Hz). */
export const GRID_EVERY = 3;
/** Cells per room tile edge (CONTENT §6: one map character = 4×4 cells). */
export const TILE_CELLS = 4;
/** Pixels per cell at the reference resolution 1280×720 (DESIGN §4). */
export const CELL_PX = 8;
/** Spatial hash bucket edge in cells (DESIGN §12). */
export const SPATIAL_BUCKET_CELLS = 8;
