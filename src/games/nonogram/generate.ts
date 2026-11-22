import type { Difficulty } from '../../lib/types';
import { EMPTY, FILLED, cluesFromSolution, type Grid, type NonogramPuzzle } from './core';
import { lineSolve } from './solve';

const SIZE: Record<Difficulty, number> = { lihtne: 8, keskmine: 10, raske: 15 };

// Minimum number of row/column sweeps the line solver needs. Low-pass
// puzzles fall apart almost immediately; requiring more sweeps means
// rows and columns have to feed each other information repeatedly.
const MIN_PASSES: Record<Difficulty, number> = { lihtne: 0, keskmine: 4, raske: 7 };

// Lower fill density gives fewer, shorter blocks with more room to move,
// which is what makes line deduction harder.
const DENSITY: Record<Difficulty, [number, number]> = {
  lihtne: [0.55, 0.65],
  keskmine: [0.5, 0.6],
  raske: [0.45, 0.55],
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

/**
 * A random picture: noise at the given density, then one or two rounds of
 * majority smoothing so it forms blobs rather than static, optionally
 * mirrored left-right for a more "drawn" look. Pure noise makes clue
 * lists long and the puzzle tedious rather than interesting.
 */
function randomPicture(n: number, density: number, rng: () => number): Grid {
  let g: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => rng() < density));
  const rounds = 1 + Math.floor(rng() * 2);
  for (let k = 0; k < rounds; k++) {
    const next = g.map((row) => row.slice());
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let on = 0;
        let total = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
            total++;
            if (g[rr][cc]) on++;
          }
        }
        // Keep a little randomness so it doesn't over-smooth into one blob.
        if (on * 2 > total) next[r][c] = true;
        else if (on * 2 < total) next[r][c] = false;
        if (rng() < 0.08) next[r][c] = !next[r][c];
      }
    }
    g = next;
  }
  if (rng() < 0.4) {
    for (let r = 0; r < n; r++) for (let c = 0; c < Math.floor(n / 2); c++) g[r][n - 1 - c] = g[r][c];
  }
  return g.map((row) => row.map((v) => (v ? FILLED : EMPTY)));
}

function tryGenerate(difficulty: Difficulty, rng: () => number): NonogramPuzzle | null {
  const n = SIZE[difficulty];
  const [lo, hi] = DENSITY[difficulty];
  const solution = randomPicture(n, lo + rng() * (hi - lo), rng);
  // Skip near-empty or near-full pictures: they're trivial or ugly.
  const filled = solution.flat().filter((v) => v === FILLED).length;
  if (filled < n * n * 0.3 || filled > n * n * 0.75) return null;
  const { rowClues, colClues } = cluesFromSolution(solution);
  const result = lineSolve(rowClues, colClues);
  if (!result.complete || result.passes < MIN_PASSES[difficulty]) return null;
  return { rows: n, cols: n, rowClues, colClues, solution };
}

export function generateNonogram(difficulty: Difficulty, seed = Date.now()): NonogramPuzzle {
  const rng = mulberry32(seed);
  for (let i = 0; i < 20000; i++) {
    const result = tryGenerate(difficulty, rng);
    if (result) return result;
  }
  throw new Error('Jaapani mõistatuse loomine ebaõnnestus.');
}
