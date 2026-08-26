export const UNKNOWN = 0;
export const TENT = 1;
export const GRASS = 2;

export type PlayState = number[][]; // UNKNOWN | TENT | GRASS
export type TreeGrid = boolean[][];

export interface TentsPuzzle {
  n: number;
  trees: TreeGrid;
  rowClue: number[];
  colClue: number[];
  solution: PlayState;
}

export function emptyTrees(n: number): TreeGrid {
  return Array.from({ length: n }, () => Array(n).fill(false));
}

export function emptyPlay(n: number): PlayState {
  return Array.from({ length: n }, () => Array(n).fill(UNKNOWN));
}

export function clonePlay(p: PlayState): PlayState {
  return p.map((row) => row.slice());
}

export function inBounds(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

export function orthoNeighbors(n: number, r: number, c: number): [number, number][] {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([rr, cc]) => inBounds(n, rr, cc)) as [number, number][];
}

export function allNeighbors(n: number, r: number, c: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (inBounds(n, rr, cc)) out.push([rr, cc]);
    }
  }
  return out;
}

export function isTreeAdjacent(trees: TreeGrid, n: number, r: number, c: number): boolean {
  return orthoNeighbors(n, r, c).some(([rr, cc]) => trees[rr][cc]);
}

export function countTentsInState(state: PlayState, cells: [number, number][]): number {
  return cells.filter(([r, c]) => state[r][c] === TENT).length;
}

export function rowCells(n: number, r: number): [number, number][] {
  return Array.from({ length: n }, (_, c) => [r, c] as [number, number]);
}

export function colCells(n: number, c: number): [number, number][] {
  return Array.from({ length: n }, (_, r) => [r, c] as [number, number]);
}
