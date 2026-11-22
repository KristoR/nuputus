import { EMPTY, FILLED, UNKNOWN, emptyGrid, getCol, getRow, type Grid } from './core';

/**
 * Exact single-line deduction: considers every placement of the clue's
 * blocks that agrees with the cells already known, and returns the line
 * with every cell that is the same in all of them filled in. Returns null
 * if no placement fits (the line contradicts its clue).
 *
 * ok(b, p) memoizes "blocks b.. can be placed in cells p.. consistently";
 * a second pass walks only the valid choices and records, per cell,
 * whether some placement makes it filled and whether some makes it empty.
 */
export function solveLine(clue: number[], line: number[]): number[] | null {
  const n = line.length;
  const k = clue.length;
  const memo = new Map<number, boolean>();
  const key = (b: number, p: number) => b * (n + 2) + p;

  function noFilled(from: number, to: number): boolean {
    for (let i = from; i < to; i++) if (line[i] === FILLED) return false;
    return true;
  }
  function noEmpty(from: number, to: number): boolean {
    for (let i = from; i < to; i++) if (line[i] === EMPTY) return false;
    return true;
  }

  /** Valid start positions for block b given the free run begins at p. */
  function starts(b: number, p: number): number[] {
    const len = clue[b];
    const out: number[] = [];
    for (let s = p; s + len <= n; s++) {
      if (s > p && line[s - 1] === FILLED) break; // can't skip past a filled cell
      if (!noEmpty(s, s + len)) continue;
      if (s + len < n && line[s + len] === FILLED) continue;
      const next = s + len < n ? s + len + 1 : n;
      if (ok(b + 1, next)) out.push(s);
    }
    return out;
  }

  function ok(b: number, p: number): boolean {
    const kk = key(b, p);
    const cached = memo.get(kk);
    if (cached !== undefined) return cached;
    const result = b === k ? noFilled(p, n) : starts(b, p).length > 0;
    memo.set(kk, result);
    return result;
  }

  if (!ok(0, 0)) return null;

  const canFill = Array(n).fill(false);
  const canEmpty = Array(n).fill(false);
  const visited = new Set<number>();

  function mark(b: number, p: number) {
    const kk = key(b, p);
    if (visited.has(kk)) return;
    visited.add(kk);
    if (b === k) {
      for (let i = p; i < n; i++) canEmpty[i] = true;
      return;
    }
    const len = clue[b];
    for (const s of starts(b, p)) {
      for (let i = p; i < s; i++) canEmpty[i] = true;
      for (let i = s; i < s + len; i++) canFill[i] = true;
      if (s + len < n) canEmpty[s + len] = true;
      mark(b + 1, s + len < n ? s + len + 1 : n);
    }
  }
  mark(0, 0);

  return line.map((v, i) => {
    if (v !== UNKNOWN) return v;
    if (canFill[i] && !canEmpty[i]) return FILLED;
    if (canEmpty[i] && !canFill[i]) return EMPTY;
    return UNKNOWN;
  });
}

/**
 * Repeated line-by-line deduction until nothing changes. Line deductions
 * are always sound, so if this fills the whole grid, that grid is the one
 * and only solution and it's reachable without guessing. `passes` counts
 * full sweeps over all lines, a rough measure of how much back-and-forth
 * between rows and columns the puzzle needs.
 */
export function lineSolve(
  rowClues: number[][],
  colClues: number[][],
  start?: Grid,
): { grid: Grid; complete: boolean; contradiction: boolean; passes: number } {
  const rows = rowClues.length;
  const cols = colClues.length;
  const grid = start ? start.map((row) => row.slice()) : emptyGrid(rows, cols);
  const rowDirty = Array(rows).fill(true);
  const colDirty = Array(cols).fill(true);
  let passes = 0;
  let changed = true;
  while (changed) {
    changed = false;
    passes++;
    for (let r = 0; r < rows; r++) {
      if (!rowDirty[r]) continue;
      rowDirty[r] = false;
      const next = solveLine(rowClues[r], getRow(grid, r));
      if (!next) return { grid, complete: false, contradiction: true, passes };
      for (let c = 0; c < cols; c++) {
        if (next[c] !== grid[r][c]) {
          grid[r][c] = next[c];
          colDirty[c] = true;
          changed = true;
        }
      }
    }
    for (let c = 0; c < cols; c++) {
      if (!colDirty[c]) continue;
      colDirty[c] = false;
      const next = solveLine(colClues[c], getCol(grid, c));
      if (!next) return { grid, complete: false, contradiction: true, passes };
      for (let r = 0; r < rows; r++) {
        if (next[r] !== grid[r][c]) {
          grid[r][c] = next[r];
          rowDirty[r] = true;
          changed = true;
        }
      }
    }
  }
  const complete = grid.every((row) => row.every((v) => v !== UNKNOWN));
  return { grid, complete, contradiction: false, passes };
}
