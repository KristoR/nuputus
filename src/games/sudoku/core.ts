export type Board = number[][]; // 9x9, 0 = empty

export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

export function cloneBoard(b: Board): Board {
  return b.map((row) => row.slice());
}

export function boxIndex(r: number, c: number): number {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

export function boxCells(box: number): [number, number][] {
  const br = Math.floor(box / 3) * 3;
  const bc = (box % 3) * 3;
  const cells: [number, number][] = [];
  for (let r = br; r < br + 3; r++) {
    for (let c = bc; c < bc + 3; c++) cells.push([r, c]);
  }
  return cells;
}

export function candidates(board: Board, r: number, c: number): number[] {
  if (board[r][c] !== 0) return [];
  const used = new Set<number>();
  for (let i = 0; i < 9; i++) {
    used.add(board[r][i]);
    used.add(board[i][c]);
  }
  for (const [br, bc] of boxCells(boxIndex(r, c))) used.add(board[br][bc]);
  const result: number[] = [];
  for (let v = 1; v <= 9; v++) if (!used.has(v)) result.push(v);
  return result;
}

export function isComplete(board: Board): boolean {
  return board.every((row) => row.every((v) => v !== 0));
}

export function findEmptyMRV(board: Board): [number, number, number[]] | null {
  let best: [number, number, number[]] | null = null;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      const cand = candidates(board, r, c);
      if (!best || cand.length < best[2].length) {
        best = [r, c, cand];
        if (cand.length <= 1) return best;
      }
    }
  }
  return best;
}

function shuffled<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function solveBacktrack(board: Board, rng: () => number = Math.random): Board | null {
  const b = cloneBoard(board);
  function step(): boolean {
    const found = findEmptyMRV(b);
    if (!found) return true;
    const [r, c, cand] = found;
    if (cand.length === 0) return false;
    for (const v of shuffled(cand, rng)) {
      b[r][c] = v;
      if (step()) return true;
      b[r][c] = 0;
    }
    return false;
  }
  return step() ? b : null;
}

/** Counts solutions up to `limit` (early exit). Used to verify uniqueness. */
export function countSolutions(board: Board, limit = 2): number {
  const b = cloneBoard(board);
  let count = 0;
  function step(): void {
    if (count >= limit) return;
    const found = findEmptyMRV(b);
    if (!found) {
      count++;
      return;
    }
    const [r, c, cand] = found;
    for (const v of cand) {
      b[r][c] = v;
      step();
      b[r][c] = 0;
      if (count >= limit) return;
    }
  }
  step();
  return count;
}
