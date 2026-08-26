import type { Difficulty } from '../../lib/types';
import { type Board, cloneBoard, countSolutions, emptyBoard, solveBacktrack } from './core';

export interface SudokuPuzzle {
  givens: Board;
  solution: Board;
}

const TARGET_GIVENS: Record<Difficulty, number> = {
  lihtne: 40,
  keskmine: 32,
  raske: 26,
};

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSudoku(difficulty: Difficulty, seed = Date.now()): SudokuPuzzle {
  const rng = mulberry32(seed);
  const solution = solveBacktrack(emptyBoard(), rng)!;
  const puzzle = cloneBoard(solution);

  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) positions.push([r, c]);
  const order = positions
    .map((p) => ({ p, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.p);

  const target = TARGET_GIVENS[difficulty];
  let given = 81;
  for (const [r, c] of order) {
    if (given <= target) break;
    const backup = puzzle[r][c];
    if (backup === 0) continue;
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      given--;
    } else {
      puzzle[r][c] = backup;
    }
  }

  return { givens: puzzle, solution };
}
