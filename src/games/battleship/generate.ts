import type { Difficulty } from '../../lib/types';
import { SHIP, UNKNOWN, WATER, type BattleshipPuzzle, type PlayState, allNeighbors, emptyPlay } from './core';
import { solveBattleship } from './solve';

// Grid sizes and fleets are kept modest — empirically, a full classic
// 10x10/1-4-length fleet makes both uniqueness-checking and this
// disambiguation loop too slow (and sometimes too hard to even locate the
// known-valid arrangement) for reliable in-browser generation.
const FLEETS: Record<Difficulty, number[]> = {
  lihtne: [3, 2, 2, 1, 1, 1],
  keskmine: [4, 2, 2, 1, 1, 1],
  raske: [4, 3, 2, 2, 1, 1, 1],
};

const SIZE: Record<Difficulty, number> = { lihtne: 6, keskmine: 7, raske: 8 };

const SOLVE_NODE_CAP = 400_000;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function placeFleetRandomly(n: number, fleet: number[], rng: () => number): boolean[][] | null {
  const occupied: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const lengths = [...fleet].sort((a, b) => b - a);

  function canPlace(cells: [number, number][]): boolean {
    for (const [r, c] of cells) {
      if (r < 0 || r >= n || c < 0 || c >= n) return false;
      if (occupied[r][c]) return false;
      for (const [nr, nc] of allNeighbors(n, r, c)) {
        if (occupied[nr][nc] && !cells.some(([pr, pc]) => pr === nr && pc === nc)) return false;
      }
    }
    return true;
  }

  for (const len of lengths) {
    const attempts = 200;
    let placed = false;
    for (let a = 0; a < attempts; a++) {
      const horizontal = rng() < 0.5;
      const r = Math.floor(rng() * n);
      const c = Math.floor(rng() * n);
      const cells: [number, number][] = Array.from({ length: len }, (_, i) =>
        horizontal ? [r, c + i] : [r + i, c],
      ) as [number, number][];
      if (canPlace(cells)) {
        for (const [rr, cc] of cells) occupied[rr][cc] = true;
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  return occupied;
}

const MAX_GIVENS_FRACTION = 0.2; // give up on a placement if disambiguation needs too many reveals

/**
 * Random ship placement rarely yields a puzzle where row/col counts alone
 * pin down a unique solution (there are usually several ways to
 * rearrange same-length ships within the slack). Rather than resampling
 * forever, we do what real battleship-solitaire puzzles do: reveal a few
 * cells (a ship segment or a patch of water) exactly where two candidate
 * solutions disagree, repeating until only one solution survives.
 */
function disambiguate(
  n: number,
  fleet: number[],
  rowClue: number[],
  colClue: number[],
  trueSolution: boolean[][],
): PlayState | null {
  const givens: PlayState = emptyPlay(n);
  const maxGivens = Math.floor(n * n * MAX_GIVENS_FRACTION);

  for (let iter = 0; iter < maxGivens + 1; iter++) {
    const { count, solutions, aborted } = solveBattleship(n, fleet, rowClue, colClue, 2, givens, SOLVE_NODE_CAP);
    if (aborted) return null;
    if (count <= 1) return givens;

    const alt = solutions[1];
    let revealed = false;
    for (let r = 0; r < n && !revealed; r++) {
      for (let c = 0; c < n && !revealed; c++) {
        if (givens[r][c] !== UNKNOWN) continue;
        const trueVal = trueSolution[r][c] ? SHIP : WATER;
        if (trueVal !== alt[r][c]) {
          givens[r][c] = trueVal;
          revealed = true;
        }
      }
    }
    if (!revealed) return null; // solutions identical to true one elsewhere — shouldn't happen
  }
  return null;
}

function tryGenerate(n: number, fleet: number[], rng: () => number): BattleshipPuzzle | null {
  const occupied = placeFleetRandomly(n, fleet, rng);
  if (!occupied) return null;

  const rowClue = Array.from({ length: n }, (_, r) => occupied[r].filter(Boolean).length);
  const colClue = Array.from({ length: n }, (_, c) =>
    Array.from({ length: n }, (_, r) => occupied[r][c]).filter(Boolean).length,
  );

  const givens = disambiguate(n, fleet, rowClue, colClue, occupied);
  if (!givens) return null;

  const solution: PlayState = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => (occupied[r][c] ? SHIP : WATER)),
  );
  return { n, fleet, rowClue, colClue, solution, givens };
}

export function generateBattleship(difficulty: Difficulty, seed = Date.now()): BattleshipPuzzle {
  const n = SIZE[difficulty];
  const fleet = FLEETS[difficulty];
  const rng = mulberry32(seed);
  for (let i = 0; i < 2000; i++) {
    const result = tryGenerate(n, fleet, rng);
    if (result) return result;
  }
  const fallbackRng = mulberry32(Date.now() + 13);
  for (let i = 0; i < 2000; i++) {
    const result = tryGenerate(n, fleet, fallbackRng);
    if (result) return result;
  }
  throw new Error('Laevade pommitamise mõistatuse loomine ebaõnnestus.');
}
