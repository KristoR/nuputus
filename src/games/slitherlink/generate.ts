import type { Difficulty } from '../../lib/types';
import { type ClueGrid, type EdgeState, type SlitherlinkPuzzle } from './core';
import { solveSlitherlink } from './solve';

// Grid sizes are kept modest: uniqueness-checking during clue removal is a
// backtracking search per candidate removal (up to n*n of them), and past
// n=7 the total generation time grows too large for a snappy in-browser
// experience.
const SIZE: Record<Difficulty, number> = { lihtne: 5, keskmine: 6, raske: 7 };
const SOLVE_NODE_CAP = 6000;

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

/** Grows a random connected blob of cells via randomized flood fill. */
function growRegion(n: number, rng: () => number, targetFraction: number): boolean[][] {
  const region: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const sr = Math.floor(rng() * n);
  const sc = Math.floor(rng() * n);
  region[sr][sc] = true;
  let size = 1;
  const target = Math.max(4, Math.round(n * n * targetFraction));
  const frontier: [number, number][] = [];

  function pushNeighbors(r: number, c: number) {
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !region[rr][cc]) frontier.push([rr, cc]);
    }
  }
  pushNeighbors(sr, sc);

  while (size < target && frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const [r, c] = frontier[idx];
    frontier.splice(idx, 1);
    if (region[r][c]) continue;
    region[r][c] = true;
    size++;
    pushNeighbors(r, c);
  }
  return region;
}

/** A diagonal-only touch between two same-status cells creates a degree-4 vertex — invalid for a simple loop. */
function hasPinch(n: number, region: boolean[][]): boolean {
  for (let r = 1; r < n; r++) {
    for (let c = 1; c < n; c++) {
      const a = region[r - 1][c - 1];
      const b = region[r - 1][c];
      const cc = region[r][c - 1];
      const d = region[r][c];
      if (a === d && b === cc && a !== b) return true;
    }
  }
  return false;
}

/** An unselected pocket fully enclosed by the region would form a second (inner) loop. */
function hasEnclosedHole(n: number, region: boolean[][]): boolean {
  const seen: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const queue: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!region[r][c] && (r === 0 || c === 0 || r === n - 1 || c === n - 1) && !seen[r][c]) {
        seen[r][c] = true;
        queue.push([r, c]);
      }
    }
  }
  let qi = 0;
  while (qi < queue.length) {
    const [r, c] = queue[qi++];
    for (const [dr, dc] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n && !region[rr][cc] && !seen[rr][cc]) {
        seen[rr][cc] = true;
        queue.push([rr, cc]);
      }
    }
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!region[r][c] && !seen[r][c]) return true;
  return false;
}

function regionToEdges(n: number, region: boolean[][]): EdgeState {
  const inRegion = (r: number, c: number) => r >= 0 && r < n && c >= 0 && c < n && region[r][c];
  const H = Array.from({ length: n + 1 }, () => Array(n).fill(0));
  const V = Array.from({ length: n }, () => Array(n + 1).fill(0));
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) H[r][c] = inRegion(r - 1, c) !== inRegion(r, c) ? 1 : 0;
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) V[r][c] = inRegion(r, c - 1) !== inRegion(r, c) ? 1 : 0;
  return { H, V };
}

function cluesFromSolution(n: number, solution: EdgeState): ClueGrid {
  const clue: ClueGrid = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      clue[r][c] = solution.H[r][c] + solution.H[r + 1][c] + solution.V[r][c] + solution.V[r][c + 1];
    }
  }
  return clue;
}

function generateLoop(n: number, rng: () => number): EdgeState | null {
  for (let attempt = 0; attempt < 300; attempt++) {
    const region = growRegion(n, rng, 0.5);
    if (hasPinch(n, region)) continue;
    if (hasEnclosedHole(n, region)) continue;
    const size = region.flat().filter(Boolean).length;
    if (size === 0 || size === n * n) continue;
    return regionToEdges(n, region);
  }
  return null;
}

function tryGenerate(n: number, rng: () => number): SlitherlinkPuzzle | null {
  const solution = generateLoop(n, rng);
  if (!solution) return null;

  const fullClue = cluesFromSolution(n, solution);
  const clue: ClueGrid = fullClue.map((row) => row.slice());
  const positions: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) positions.push([r, c]);

  for (const [r, c] of shuffle(positions, rng)) {
    const backup = clue[r][c];
    clue[r][c] = -1;
    const { count, aborted } = solveSlitherlink(n, clue, 2, SOLVE_NODE_CAP);
    if (aborted || count !== 1) clue[r][c] = backup;
  }

  return { n, clue, solution };
}

export function generateSlitherlink(difficulty: Difficulty, seed = Date.now()): SlitherlinkPuzzle {
  const n = SIZE[difficulty];
  const rng = mulberry32(seed);
  for (let i = 0; i < 100; i++) {
    const result = tryGenerate(n, rng);
    if (result) return result;
  }
  const fallbackRng = mulberry32(Date.now() + 29);
  for (let i = 0; i < 100; i++) {
    const result = tryGenerate(n, fallbackRng);
    if (result) return result;
  }
  throw new Error('Hiina müüri mõistatuse loomine ebaõnnestus.');
}
