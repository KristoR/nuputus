import type { Difficulty } from '../../lib/types';
import { GRASS, TENT, type TentsPuzzle, allNeighbors, emptyPlay, emptyTrees, orthoNeighbors } from './core';
import { solveTents } from './solve';

const SIZE: Record<Difficulty, number> = { lihtne: 8, keskmine: 10, raske: 12 };

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tryGenerate(n: number, rng: () => number): TentsPuzzle | null {
  const trees = emptyTrees(n);
  const solution = emptyPlay(n);
  const targetPairs = Math.round(n * n * 0.16);
  let placed = 0;
  const maxAttempts = targetPairs * 60;

  for (let attempt = 0; attempt < maxAttempts && placed < targetPairs; attempt++) {
    const tr = Math.floor(rng() * n);
    const tc = Math.floor(rng() * n);
    if (trees[tr][tc] || solution[tr][tc] !== 0) continue;

    const neighbors = orthoNeighbors(n, tr, tc).filter(([r, c]) => !trees[r][c] && solution[r][c] === 0);
    if (neighbors.length === 0) continue;
    const [tentR, tentC] = neighbors[Math.floor(rng() * neighbors.length)];

    // Avoid a tent cell bordering more than one tree (keeps pairing unambiguous).
    const treeNeighborsOfTent = orthoNeighbors(n, tentR, tentC).filter(([r, c]) => trees[r][c]);
    if (treeNeighborsOfTent.length > 0) continue;

    // No other tent may touch this one, even diagonally.
    const touchesTent = allNeighbors(n, tentR, tentC).some(([r, c]) => solution[r][c] === TENT);
    if (touchesTent) continue;

    trees[tr][tc] = true;
    solution[tentR][tentC] = TENT;
    placed++;
  }

  if (placed < Math.max(4, targetPairs * 0.7)) return null;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!trees[r][c] && solution[r][c] !== TENT) solution[r][c] = GRASS;
    }
  }

  const rowClue = Array.from({ length: n }, (_, r) => solution[r].filter((v) => v === TENT).length);
  const colClue = Array.from({ length: n }, (_, c) =>
    Array.from({ length: n }, (_, r) => solution[r][c]).filter((v) => v === TENT).length,
  );

  const { count } = solveTents(n, trees, rowClue, colClue, 2);
  if (count !== 1) return null;

  return { n, trees, rowClue, colClue, solution };
}

export function generateTents(difficulty: Difficulty, seed = Date.now()): TentsPuzzle {
  const n = SIZE[difficulty];
  const rng = mulberry32(seed);
  for (let i = 0; i < 120; i++) {
    const result = tryGenerate(n, rng);
    if (result) return result;
  }
  // Extremely unlikely fallback: retry with a fresh time-based seed once more, unconstrained.
  const fallbackRng = mulberry32(Date.now() + 1);
  for (let i = 0; i < 400; i++) {
    const result = tryGenerate(n, fallbackRng);
    if (result) return result;
  }
  throw new Error('Telklaagri mõistatuse loomine ebaõnnestus.');
}
