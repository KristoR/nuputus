import type { Difficulty } from '../../lib/types';
import { type RegionGrid, type StarBattlePuzzle } from './core';
import { solvableWithSimpleTechniques } from './hints';
import { solveStarBattle } from './solve';

export type StarCount = 1 | 2;

// Regions are grown independently of any star placement (see
// growRandomRegions below) and then checked for a unique valid star
// placement via the full solver. Grid size is capped where that check
// stops converging within a reasonable number of attempts — empirically,
// generation past these sizes essentially never lands on a unique
// solution quickly enough to stay usable.
const SIZE: Record<StarCount, Record<Difficulty, number>> = {
  1: { lihtne: 6, keskmine: 7, raske: 9 },
  2: { lihtne: 8, keskmine: 9, raske: 9 },
};

// "Raske" additionally requires that simple techniques alone can't finish
// the puzzle, so the hardest tier is guaranteed to need real reasoning
// rather than just happening to land on a bigger grid.
const REQUIRE_HARD: Record<Difficulty, boolean> = { lihtne: false, keskmine: false, raske: true };

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

function orthoOf(n: number, r: number, c: number): [number, number][] {
  return ([
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ] as [number, number][]).filter(([rr, cc]) => rr >= 0 && rr < n && cc >= 0 && cc < n);
}

/**
 * Grows n connected regions covering the whole board from n random seed
 * cells via randomized flood fill (a random frontier cell is claimed by
 * its region each step). Letting region sizes vary organically like this
 * — rather than keeping them balanced — turns out to make an eventual
 * unique solution far more likely, which is what generation depends on.
 */
function growRandomRegions(n: number, rng: () => number): RegionGrid {
  const regions: RegionGrid = Array.from({ length: n }, () => Array(n).fill(-1));
  const allCells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) allCells.push([r, c]);
  const seeds = shuffle(allCells, rng).slice(0, n);

  type Frontier = { region: number; r: number; c: number };
  const frontier: Frontier[] = [];
  seeds.forEach(([r, c], id) => {
    regions[r][c] = id;
    for (const [rr, cc] of orthoOf(n, r, c)) frontier.push({ region: id, r: rr, c: cc });
  });

  while (frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const { region, r, c } = frontier[idx];
    frontier.splice(idx, 1);
    if (regions[r][c] !== -1) continue;
    regions[r][c] = region;
    for (const [rr, cc] of orthoOf(n, r, c)) frontier.push({ region, r: rr, c: cc });
  }

  return regions;
}

// Bounds how much search a single candidate region layout gets before it's
// abandoned for a fresh one — without this, a handful of unlucky layouts
// (usually ones with many near-solutions) can each burn seconds of search
// just to rule themselves out, which adds up badly over thousands of tries.
const SOLVE_NODE_BUDGET = 40000;

function tryGenerate(n: number, stars: number, requireHard: boolean, rng: () => number): StarBattlePuzzle | null {
  const regions = growRandomRegions(n, rng);
  const { count, first, aborted } = solveStarBattle(n, regions, stars, 2, null, SOLVE_NODE_BUDGET);
  if (aborted || count !== 1 || !first) return null;
  const puzzle: StarBattlePuzzle = { n, stars, regions, solution: first };
  if (requireHard && solvableWithSimpleTechniques(puzzle)) return null;
  return puzzle;
}

export function generateStarBattle(difficulty: Difficulty, stars: StarCount, seed = Date.now()): StarBattlePuzzle {
  const n = SIZE[stars][difficulty];
  const requireHard = REQUIRE_HARD[difficulty];
  const rng = mulberry32(seed);
  for (let i = 0; i < 15000; i++) {
    const result = tryGenerate(n, stars, requireHard, rng);
    if (result) return result;
  }
  const fallbackRng = mulberry32(Date.now() + 7);
  for (let i = 0; i < 15000; i++) {
    const result = tryGenerate(n, stars, requireHard, fallbackRng);
    if (result) return result;
  }
  throw new Error('Tähesõja mõistatuse loomine ebaõnnestus.');
}
