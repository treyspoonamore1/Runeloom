/**
 * The active set (DESIGN §6.1): the cells the grid tick visits. Quiet terrain is never visited.
 *
 * `list[0..len)` holds the cells of the last grid tick in ascending index order; cells activated
 * since then wait in `added[0..addedLen)` (any order). `flag[i]` is 1 while cell i is in either,
 * so nothing is listed twice. Each grid tick sorts `added` and merges it into `list`, then visits
 * `list` in ascending index order, so the visiting order (and every random roll) depends only on
 * which cells are active, never on when or in what order they were activated.
 *
 * Not hashed: a cell that is listed but quiet does nothing when visited (no rolls, no writes), and
 * the busy cells are a pure function of the hashed grid fields.
 */
export interface ActiveSet {
  list: Int32Array;
  len: number;
  added: Int32Array;
  addedLen: number;
  flag: Uint8Array;
  /** Scratch for the merge. */
  spare: Int32Array;
}

export function createActiveSet(n: number): ActiveSet {
  return {
    list: new Int32Array(n),
    len: 0,
    added: new Int32Array(n),
    addedLen: 0,
    flag: new Uint8Array(n),
    spare: new Int32Array(n),
  };
}

/** Makes cell i visited from the next grid tick on (if it is still busy then). */
export function markActive(a: ActiveSet, i: number): void {
  if (a.flag[i] === 1) return;
  a.flag[i] = 1;
  a.added[a.addedLen++] = i;
}

/** Sorts the cells added since the last grid tick and merges them into `list`. */
export function mergeAdded(a: ActiveSet): void {
  if (a.addedLen === 0) return;
  const added = a.added.subarray(0, a.addedLen);
  added.sort();
  const out = a.spare;
  const list = a.list;
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < a.len && j < a.addedLen) out[k++] = list[i]! < added[j]! ? list[i++]! : added[j++]!;
  while (i < a.len) out[k++] = list[i++]!;
  while (j < a.addedLen) out[k++] = added[j++]!;
  a.spare = list;
  a.list = out;
  a.len = k;
  a.addedLen = 0;
}

/** Number of cells listed for the next grid tick (debug overlay). */
export function activeCount(a: ActiveSet): number {
  return a.len + a.addedLen;
}
