import { EMPTY, STAR, type PlayState, type RegionGrid } from './core';

/**
 * Star-battle solver generalized to `stars` stars per row/column/region
 * (1 for the classic variant, 2 for the harder variant). Assigns each
 * row's stars column-by-column via valid same-row combinations, pruning
 * on column/region quotas and the no-touch rule against the previous row.
 *
 * `fixed`, when given, is the player's current board: STAR cells must be
 * included in the row's chosen columns and EMPTY cells are excluded from
 * them, so the search finds only completions consistent with what's
 * already on the board. Returns up to `limit` solutions (early exit) plus
 * the first found.
 *
 * `nodeBudget`, when given, bounds the search: once that many rows have
 * been attempted across the whole search tree, the search stops early and
 * `aborted` comes back true (used only by generation, to cut its losses on
 * a region layout whose uniqueness is too expensive to fully settle rather
 * than stalling on it — hint callers never pass this, since a hint must be
 * exact).
 */
export function solveStarBattle(
  n: number,
  regions: RegionGrid,
  stars: number,
  limit = 2,
  fixed: PlayState | null = null,
  nodeBudget = Infinity,
): { count: number; first: PlayState | null; aborted: boolean } {
  const colUsed = Array(n).fill(0);
  const regionUsed = Array(n).fill(0);
  const rowCols: number[][] = Array.from({ length: n }, () => []);
  let count = 0;
  let first: PlayState | null = null;
  let nodes = 0;
  let aborted = false;

  function rowCombos(row: number, prevCols: number[]): number[][] {
    const forced: number[] = [];
    const forbidden = new Set<number>();
    if (fixed) {
      for (let c = 0; c < n; c++) {
        if (fixed[row][c] === STAR) forced.push(c);
        if (fixed[row][c] === EMPTY) forbidden.add(c);
      }
    }
    if (forced.length > stars) return [];

    const results: number[][] = [];
    function backtrack(start: number, chosen: number[]) {
      if (chosen.length === stars) {
        if (forced.every((f) => chosen.includes(f))) results.push(chosen.slice());
        return;
      }
      for (let c = start; c < n; c++) {
        if (forbidden.has(c)) continue;
        if (colUsed[c] >= stars) continue;
        const region = regions[row][c];
        const regionInRow = chosen.filter((x) => regions[row][x] === region).length;
        if (regionUsed[region] + regionInRow >= stars) continue;
        if (chosen.some((x) => Math.abs(x - c) <= 1)) continue;
        if (prevCols.some((pc) => Math.abs(pc - c) <= 1)) continue;
        chosen.push(c);
        backtrack(c + 1, chosen);
        chosen.pop();
      }
    }
    backtrack(0, []);
    return results;
  }

  function place(row: number): void {
    if (count >= limit || aborted) return;
    nodes++;
    if (nodes > nodeBudget) {
      aborted = true;
      return;
    }
    if (row === n) {
      count++;
      if (!first) {
        const state: PlayState = Array.from({ length: n }, () => Array(n).fill(EMPTY));
        for (let r = 0; r < n; r++) for (const c of rowCols[r]) state[r][c] = STAR;
        first = state;
      }
      return;
    }
    const prevCols = row > 0 ? rowCols[row - 1] : [];
    for (const combo of rowCombos(row, prevCols)) {
      for (const c of combo) {
        colUsed[c]++;
        regionUsed[regions[row][c]]++;
      }
      rowCols[row] = combo;
      place(row + 1);
      for (const c of combo) {
        colUsed[c]--;
        regionUsed[regions[row][c]]--;
      }
      rowCols[row] = [];
      if (count >= limit || aborted) return;
    }
  }

  place(0);
  return { count, first: aborted ? null : first, aborted };
}
