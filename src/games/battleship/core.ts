export const UNKNOWN = 0;
export const SHIP = 1;
export const WATER = 2;

export type PlayState = number[][];

export interface BattleshipPuzzle {
  n: number;
  fleet: number[]; // ship lengths, descending
  rowClue: number[];
  colClue: number[];
  solution: PlayState; // SHIP | WATER only
  givens: PlayState; // UNKNOWN | SHIP | WATER pre-filled cells, not editable
}

export function emptyPlay(n: number): PlayState {
  return Array.from({ length: n }, () => Array(n).fill(UNKNOWN));
}

export function cloneOrEmpty(givens: PlayState, n: number): PlayState {
  return Array.from({ length: n }, (_, r) => givens[r].slice());
}

export function inBounds(n: number, r: number, c: number): boolean {
  return r >= 0 && r < n && c >= 0 && c < n;
}

export function diagonalNeighbors(n: number, r: number, c: number): [number, number][] {
  return ([
    [r - 1, c - 1],
    [r - 1, c + 1],
    [r + 1, c - 1],
    [r + 1, c + 1],
  ] as [number, number][]).filter(([rr, cc]) => inBounds(n, rr, cc));
}

export function orthoNeighbors(n: number, r: number, c: number): [number, number][] {
  return ([
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ] as [number, number][]).filter(([rr, cc]) => inBounds(n, rr, cc));
}

export function allNeighbors(n: number, r: number, c: number): [number, number][] {
  return [...orthoNeighbors(n, r, c), ...diagonalNeighbors(n, r, c)];
}

export function rowCells(n: number, r: number): [number, number][] {
  return Array.from({ length: n }, (_, c) => [r, c] as [number, number]);
}

export function colCells(n: number, c: number): [number, number][] {
  return Array.from({ length: n }, (_, r) => [r, c] as [number, number]);
}

/** Shape class for rendering a ship cell based on its ship-marked orthogonal neighbors. */
export function shipShapeClass(state: PlayState, n: number, r: number, c: number): string {
  const up = r > 0 && state[r - 1][c] === SHIP;
  const down = r < n - 1 && state[r + 1][c] === SHIP;
  const left = c > 0 && state[r][c - 1] === SHIP;
  const right = c < n - 1 && state[r][c + 1] === SHIP;
  if (!up && !down && !left && !right) return 'ship-single';
  if (left || right) {
    if (left && right) return 'ship-h-mid';
    if (right) return 'ship-h-left';
    return 'ship-h-right';
  }
  if (up && down) return 'ship-v-mid';
  if (down) return 'ship-v-top';
  return 'ship-v-bottom';
}
