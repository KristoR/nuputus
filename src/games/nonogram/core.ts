export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;

export type Grid = number[][];

export interface NonogramPuzzle {
  rows: number;
  cols: number;
  rowClues: number[][];
  colClues: number[][];
  /** FILLED or EMPTY per cell. */
  solution: Grid;
}

export function emptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () => Array(cols).fill(UNKNOWN));
}

/** Lengths of consecutive FILLED runs in a line; [] for a line with none. */
export function runsOf(line: number[]): number[] {
  const runs: number[] = [];
  let len = 0;
  for (const v of line) {
    if (v === FILLED) len++;
    else if (len > 0) {
      runs.push(len);
      len = 0;
    }
  }
  if (len > 0) runs.push(len);
  return runs;
}

export function sameClue(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function getRow(grid: Grid, r: number): number[] {
  return grid[r].slice();
}

export function getCol(grid: Grid, c: number): number[] {
  return grid.map((row) => row[c]);
}

export function cluesFromSolution(solution: Grid): { rowClues: number[][]; colClues: number[][] } {
  const rows = solution.length;
  const cols = solution[0].length;
  return {
    rowClues: Array.from({ length: rows }, (_, r) => runsOf(getRow(solution, r))),
    colClues: Array.from({ length: cols }, (_, c) => runsOf(getCol(solution, c))),
  };
}
