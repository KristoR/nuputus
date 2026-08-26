import { STAR, type PlayState, type RegionGrid } from './core';

/**
 * Star-battle solver for the one-star-per-row/column/region variant.
 * Assigns each row's single star column by column, pruning on column
 * reuse, region quota, and the no-touch rule against the previous row.
 * Returns up to `limit` solutions (early exit) plus the first found.
 */
export function solveStarBattle(
  n: number,
  regions: RegionGrid,
  limit = 2,
): { count: number; first: PlayState | null } {
  const colUsed = Array(n).fill(false);
  const regionUsed = Array(n).fill(false);
  const starCol = Array(n).fill(-1);
  let count = 0;
  let first: PlayState | null = null;

  function place(row: number): void {
    if (count >= limit) return;
    if (row === n) {
      count++;
      if (!first) {
        const state: PlayState = Array.from({ length: n }, () => Array(n).fill(2));
        for (let r = 0; r < n; r++) state[r][starCol[r]] = STAR;
        first = state;
      }
      return;
    }
    for (let c = 0; c < n; c++) {
      if (colUsed[c]) continue;
      const region = regions[row][c];
      if (regionUsed[region]) continue;
      if (row > 0 && Math.abs(starCol[row - 1] - c) <= 1) continue;

      colUsed[c] = true;
      regionUsed[region] = true;
      starCol[row] = c;
      place(row + 1);
      colUsed[c] = false;
      regionUsed[region] = false;
      starCol[row] = -1;
      if (count >= limit) return;
    }
  }

  place(0);
  return { count, first };
}
