import { SHIP, WATER, type PlayState, allNeighbors } from './core';

interface Placement {
  cells: [number, number][];
}

function placementsForLength(n: number, length: number): Placement[] {
  const out: Placement[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c <= n - length; c++) {
      out.push({ cells: Array.from({ length }, (_, i) => [r, c + i] as [number, number]) });
    }
  }
  if (length > 1) {
    for (let c = 0; c < n; c++) {
      for (let r = 0; r <= n - length; r++) {
        out.push({ cells: Array.from({ length }, (_, i) => [r + i, c] as [number, number]) });
      }
    }
  }
  return out;
}

/**
 * Places the fleet (ship by ship, not cell by cell) via backtracking. This
 * keeps branching factor manageable — candidate positions per ship rather
 * than 2^(n*n) cell assignments. `givens` (SHIP/WATER pre-filled cells, as
 * generation adds them to pin down uniqueness) constrain the search.
 * Returns up to `limit` solutions (early exit) and collects them all
 * (bounded by limit) so generation can diff solutions to find where they
 * disagree.
 */
export function solveBattleship(
  n: number,
  fleet: number[],
  rowClue: number[],
  colClue: number[],
  limit = 2,
  givens?: PlayState,
  nodeCap = Infinity,
): { count: number; solutions: PlayState[]; aborted: boolean } {
  const lengths = [...fleet].sort((a, b) => b - a);
  const candidatesByLength = new Map<number, Placement[]>();
  for (const len of new Set(lengths)) candidatesByLength.set(len, placementsForLength(n, len));

  const occupied: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
  const rowCount = Array(n).fill(0);
  const colCount = Array(n).fill(0);

  let count = 0;
  let nodes = 0;
  let aborted = false;
  const solutions: PlayState[] = [];

  function canPlace(p: Placement): boolean {
    for (const [r, c] of p.cells) {
      if (occupied[r][c]) return false;
      if (givens && givens[r][c] === WATER) return false;
      if (rowCount[r] >= rowClue[r]) return false;
      if (colCount[c] >= colClue[c]) return false;
      for (const [nr, nc] of allNeighbors(n, r, c)) {
        if (occupied[nr][nc] && !p.cells.some(([pr, pc]) => pr === nr && pc === nc)) return false;
      }
    }
    return true;
  }

  function apply(p: Placement, value: boolean) {
    for (const [r, c] of p.cells) {
      occupied[r][c] = value;
      rowCount[r] += value ? 1 : -1;
      colCount[c] += value ? 1 : -1;
    }
  }

  function givensSatisfied(): boolean {
    if (!givens) return true;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (givens[r][c] === SHIP && !occupied[r][c]) return false;
      }
    }
    return true;
  }

  // Ships of equal length are interchangeable, so without a canonical
  // ordering the search would find the same final board once per
  // permutation of those ships and (wrongly) report it as multiple
  // distinct solutions. Requiring same-length ships to use strictly
  // increasing candidate indices removes that symmetry.
  function place(shipIdx: number, idxStart: number): void {
    if (count >= limit || aborted) return;
    nodes++;
    if (nodes > nodeCap) {
      aborted = true;
      return;
    }
    if (shipIdx === lengths.length) {
      if (
        rowCount.every((v: number, i: number) => v === rowClue[i]) &&
        colCount.every((v: number, i: number) => v === colClue[i]) &&
        givensSatisfied()
      ) {
        count++;
        solutions.push(
          Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (occupied[r][c] ? SHIP : WATER))),
        );
      }
      return;
    }
    const len = lengths[shipIdx];
    const candidates = candidatesByLength.get(len)!;
    const sameAsNext = shipIdx + 1 < lengths.length && lengths[shipIdx + 1] === len;
    for (let i = idxStart; i < candidates.length; i++) {
      const p = candidates[i];
      if (!canPlace(p)) continue;
      apply(p, true);
      place(shipIdx + 1, sameAsNext ? i + 1 : 0);
      apply(p, false);
      if (count >= limit || aborted) return;
    }
  }

  place(0, 0);
  return { count, solutions, aborted };
}
