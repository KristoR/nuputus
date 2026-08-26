import type { Difficulty } from '../../lib/types';
import { STAR, type PlayState, type RegionGrid, type StarBattlePuzzle } from './core';
import { solveStarBattle } from './solve';

// One star per row/column/region gets combinatorially under-constrained past
// n=8: random region growth essentially never lands on a unique solution
// (verified empirically — n=10 didn't converge in 150k+ attempts), so
// difficulty is scaled by grid size only up to 8.
const SIZE: Record<Difficulty, number> = { lihtne: 6, keskmine: 7, raske: 8 };

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One star per row/column, no two touching (even diagonally). */
function generateStarPlacement(n: number, rng: () => number): number[] | null {
  const cols = Array.from({ length: n }, (_, i) => i);
  const used = Array(n).fill(false);
  const starCol = Array(n).fill(-1);

  function place(row: number): boolean {
    if (row === n) return true;
    for (const c of shuffle(cols, rng)) {
      if (used[c]) continue;
      if (row > 0 && Math.abs(starCol[row - 1] - c) <= 1) continue;
      used[c] = true;
      starCol[row] = c;
      if (place(row + 1)) return true;
      used[c] = false;
      starCol[row] = -1;
    }
    return false;
  }

  return place(0) ? starCol.slice() : null;
}

/**
 * Grows n connected regions outward from the star cells via randomized
 * flood fill (a random frontier cell is claimed by its region each step).
 * Letting region sizes vary organically like this — rather than keeping
 * them balanced — turns out to eliminate alternate solutions far more
 * often, which is what generation uniqueness depends on.
 */
function growRegions(n: number, starCol: number[], rng: () => number): RegionGrid {
  const regions: RegionGrid = Array.from({ length: n }, () => Array(n).fill(-1));
  type Frontier = { region: number; r: number; c: number };
  const frontier: Frontier[] = [];

  function orthoOf(r: number, c: number): [number, number][] {
    return ([
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ] as [number, number][]).filter(([rr, cc]) => rr >= 0 && rr < n && cc >= 0 && cc < n);
  }

  for (let r = 0; r < n; r++) {
    regions[r][starCol[r]] = r;
    for (const [rr, cc] of orthoOf(r, starCol[r])) frontier.push({ region: r, r: rr, c: cc });
  }

  while (frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const { region, r, c } = frontier[idx];
    frontier.splice(idx, 1);
    if (regions[r][c] !== -1) continue;
    regions[r][c] = region;
    for (const [rr, cc] of orthoOf(r, c)) frontier.push({ region, r: rr, c: cc });
  }

  return regions;
}

function tryGenerate(n: number, rng: () => number): StarBattlePuzzle | null {
  const starCol = generateStarPlacement(n, rng);
  if (!starCol) return null;
  const regions = growRegions(n, starCol, rng);

  const { count, first } = solveStarBattle(n, regions, 2);
  if (count !== 1 || !first) return null;

  return { n, regions, solution: first };
}

export function generateStarBattle(difficulty: Difficulty, seed = Date.now()): StarBattlePuzzle {
  const n = SIZE[difficulty];
  const rng = mulberry32(seed);
  for (let i = 0; i < 15000; i++) {
    const result = tryGenerate(n, rng);
    if (result) return result;
  }
  const fallbackRng = mulberry32(Date.now() + 7);
  for (let i = 0; i < 15000; i++) {
    const result = tryGenerate(n, fallbackRng);
    if (result) return result;
  }
  throw new Error('Tähesõja mõistatuse loomine ebaõnnestus.');
}

export function starLocations(state: PlayState): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < state.length; r++) {
    for (let c = 0; c < state.length; c++) if (state[r][c] === STAR) out.push([r, c]);
  }
  return out;
}
