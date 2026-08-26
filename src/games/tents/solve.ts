import {
  GRASS,
  TENT,
  type PlayState,
  type TreeGrid,
  allNeighbors,
  emptyPlay,
  isTreeAdjacent,
  orthoNeighbors,
} from './core';

function everyTreeCovered(state: PlayState, trees: TreeGrid, n: number): boolean {
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!trees[r][c]) continue;
      const covered = orthoNeighbors(n, r, c).some(([rr, cc]) => state[rr][cc] === TENT);
      if (!covered) return false;
    }
  }
  return true;
}

/**
 * Enumerates solutions up to `limit` (early exit). Also returns the first
 * solution found, used both for uniqueness checks during generation and as
 * a fallback source of truth for hints.
 */
export function solveTents(
  n: number,
  trees: TreeGrid,
  rowClue: number[],
  colClue: number[],
  limit = 2,
): { count: number; first: PlayState | null } {
  const state = emptyPlay(n);
  const rowCount = Array(n).fill(0);
  const colCount = Array(n).fill(0);
  const order: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!trees[r][c]) order.push([r, c]);
    }
  }

  let count = 0;
  let first: PlayState | null = null;

  function place(idx: number): void {
    if (count >= limit) return;
    if (idx === order.length) {
      const rowsOk = rowCount.every((v: number, i: number) => v === rowClue[i]);
      const colsOk = colCount.every((v: number, i: number) => v === colClue[i]);
      if (rowsOk && colsOk && everyTreeCovered(state, trees, n)) {
        count++;
        if (!first) first = state.map((row) => row.slice());
      }
      return;
    }
    const [r, c] = order[idx];

    // Try grass.
    state[r][c] = GRASS;
    if (c !== n - 1 || rowCount[r] === rowClue[r]) {
      place(idx + 1);
    }
    if (count >= limit) return;

    // Try tent.
    if (
      isTreeAdjacent(trees, n, r, c) &&
      rowCount[r] < rowClue[r] &&
      colCount[c] < colClue[c] &&
      !allNeighbors(n, r, c).some(([rr, cc]) => state[rr][cc] === TENT)
    ) {
      state[r][c] = TENT;
      rowCount[r]++;
      colCount[c]++;
      if (c !== n - 1 || rowCount[r] === rowClue[r]) {
        place(idx + 1);
      }
      rowCount[r]--;
      colCount[c]--;
    }
    state[r][c] = 0;
  }

  place(0);
  return { count, first };
}
