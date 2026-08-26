export const UNKNOWN = 0;
export const STAR = 1;
export const EMPTY = 2;

export type PlayState = number[][];
export type RegionGrid = number[][]; // region id per cell, 0..n-1

export interface StarBattlePuzzle {
  n: number;
  regions: RegionGrid;
  solution: PlayState;
}

export function emptyPlay(n: number): PlayState {
  return Array.from({ length: n }, () => Array(n).fill(UNKNOWN));
}

export function inBounds(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

export function neighbors8(n: number, r: number, c: number): [number, number][] {
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

export function rowCells(n: number, r: number): [number, number][] {
  return Array.from({ length: n }, (_, c) => [r, c] as [number, number]);
}

export function colCells(n: number, c: number): [number, number][] {
  return Array.from({ length: n }, (_, r) => [r, c] as [number, number]);
}

export function regionCells(regions: RegionGrid, n: number, id: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (regions[r][c] === id) cells.push([r, c]);
  return cells;
}
