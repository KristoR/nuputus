export const UNKNOWN = -1;
export const OFF = 0;
export const ON = 1;

export type EdgeGrid = number[][]; // UNKNOWN | OFF | ON
export type ClueGrid = number[][]; // 0-3, or -1 for no clue

export interface EdgeState {
  H: EdgeGrid; // (n+1) rows x n cols — H[r][c] connects vertex (r,c)-(r,c+1)
  V: EdgeGrid; // n rows x (n+1) cols — V[r][c] connects vertex (r,c)-(r+1,c)
}

export interface SlitherlinkPuzzle {
  n: number;
  clue: ClueGrid;
  solution: EdgeState;
}

export type Edge = ['H' | 'V', number, number];

export function emptyEdgeState(n: number): EdgeState {
  return {
    H: Array.from({ length: n + 1 }, () => Array(n).fill(UNKNOWN)),
    V: Array.from({ length: n }, () => Array(n + 1).fill(UNKNOWN)),
  };
}

export function cloneEdgeState(s: EdgeState): EdgeState {
  return { H: s.H.map((row) => row.slice()), V: s.V.map((row) => row.slice()) };
}

export function getEdge(s: EdgeState, e: Edge): number {
  return e[0] === 'H' ? s.H[e[1]][e[2]] : s.V[e[1]][e[2]];
}

export function setEdge(s: EdgeState, e: Edge, v: number): void {
  if (e[0] === 'H') s.H[e[1]][e[2]] = v;
  else s.V[e[1]][e[2]] = v;
}

export function edgeKey(e: Edge): string {
  return `${e[0]}${e[1]},${e[2]}`;
}

/** The four edges bounding cell (r,c). */
export function cellEdges(r: number, c: number): { top: Edge; bottom: Edge; left: Edge; right: Edge } {
  return {
    top: ['H', r, c],
    bottom: ['H', r + 1, c],
    left: ['V', r, c],
    right: ['V', r, c + 1],
  };
}

/** The (2-4) edges meeting at vertex (r,c) on an n x n cell grid. */
export function vertexEdges(n: number, r: number, c: number): Edge[] {
  const edges: Edge[] = [];
  if (c > 0) edges.push(['H', r, c - 1]);
  if (c < n) edges.push(['H', r, c]);
  if (r > 0) edges.push(['V', r - 1, c]);
  if (r < n) edges.push(['V', r, c]);
  return edges;
}

export function allEdges(n: number): Edge[] {
  const list: Edge[] = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) list.push(['H', r, c]);
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) list.push(['V', r, c]);
  return list;
}
