import {
  ON,
  OFF,
  UNKNOWN,
  type ClueGrid,
  type Edge,
  type EdgeState,
  allEdges,
  cellEdges,
  cloneEdgeState,
  emptyEdgeState,
  getEdge,
  setEdge,
  vertexEdges,
} from './core';

/**
 * Propagates the two local slitherlink rules to a fixpoint:
 *  - a cell's clue bounds how many of its 4 edges are ON;
 *  - every vertex has degree 0 or 2 among its incident edges.
 * Returns false if a contradiction is found (over/under-constrained).
 */
export function propagate(n: number, clue: ClueGrid, state: EdgeState): boolean {
  const cellList: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (clue[r][c] >= 0) cellList.push([r, c]);
  const vertexList: [number, number][] = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c <= n; c++) vertexList.push([r, c]);

  let changed = true;
  while (changed) {
    changed = false;
    for (const [r, c] of cellList) {
      const { top, bottom, left, right } = cellEdges(r, c);
      const edges = [top, bottom, left, right];
      let on = 0;
      const unk: Edge[] = [];
      for (const e of edges) {
        const v = getEdge(state, e);
        if (v === ON) on++;
        else if (v === UNKNOWN) unk.push(e);
      }
      const need = clue[r][c];
      if (on > need) return false;
      if (on + unk.length < need) return false;
      if (unk.length > 0) {
        if (on === need) {
          for (const e of unk) setEdge(state, e, OFF);
          changed = true;
        } else if (on + unk.length === need) {
          for (const e of unk) setEdge(state, e, ON);
          changed = true;
        }
      }
    }
    for (const [r, c] of vertexList) {
      const edges = vertexEdges(n, r, c);
      let on = 0;
      const unk: Edge[] = [];
      for (const e of edges) {
        const v = getEdge(state, e);
        if (v === ON) on++;
        else if (v === UNKNOWN) unk.push(e);
      }
      if (on > 2) return false;
      if (unk.length > 0) {
        if (on === 2) {
          for (const e of unk) setEdge(state, e, OFF);
          changed = true;
        } else if (on === 1 && unk.length === 1) {
          setEdge(state, unk[0], ON);
          changed = true;
        } else if (on === 0 && unk.length === 1) {
          setEdge(state, unk[0], OFF);
          changed = true;
        }
      }
    }
  }
  return true;
}

/** True if the ON edges form exactly one simple closed loop. */
function isSingleLoop(n: number, state: EdgeState): boolean {
  const onEdges = allEdges(n).filter((e) => getEdge(state, e) === ON);
  if (onEdges.length === 0) return false;

  const vertexKey = (r: number, c: number) => r * (n + 1) + c;
  const adj = new Map<number, number[]>();
  const add = (a: number, b: number) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push(b);
  };
  for (const e of onEdges) {
    const [v1, v2] =
      e[0] === 'H' ? [vertexKey(e[1], e[2]), vertexKey(e[1], e[2] + 1)] : [vertexKey(e[1], e[2]), vertexKey(e[1] + 1, e[2])];
    add(v1, v2);
    add(v2, v1);
    if (adj.get(v1)!.length > 2 || adj.get(v2)!.length > 2) return false;
  }

  const start = adj.keys().next().value as number;
  const visited = new Set<number>();
  let prev = -1;
  let cur = start;
  let steps = 0;
  do {
    visited.add(cur);
    const neighbors = adj.get(cur)!;
    const next = neighbors[0] === prev ? neighbors[1] : neighbors[0];
    if (next === undefined) return false;
    prev = cur;
    cur = next;
    steps++;
    if (steps > onEdges.length + 1) return false;
  } while (cur !== start);
  return visited.size === adj.size;
}

export function solveSlitherlink(
  n: number,
  clue: ClueGrid,
  limit = 2,
  nodeCap = Infinity,
  initial?: EdgeState,
): { count: number; solutions: EdgeState[]; aborted: boolean } {
  const start = initial ? cloneEdgeState(initial) : emptyEdgeState(n);
  const solutions: EdgeState[] = [];
  let count = 0;
  let nodes = 0;
  let aborted = false;

  if (!propagate(n, clue, start)) return { count: 0, solutions: [], aborted: false };

  const edgeList = allEdges(n);

  function backtrack(state: EdgeState): void {
    if (count >= limit || aborted) return;
    nodes++;
    if (nodes > nodeCap) {
      aborted = true;
      return;
    }
    let next: Edge | null = null;
    for (const e of edgeList) {
      if (getEdge(state, e) === UNKNOWN) {
        next = e;
        break;
      }
    }
    if (!next) {
      if (isSingleLoop(n, state)) {
        count++;
        solutions.push(cloneEdgeState(state));
      }
      return;
    }
    for (const val of [ON, OFF]) {
      const s2 = cloneEdgeState(state);
      setEdge(s2, next, val);
      if (propagate(n, clue, s2)) backtrack(s2);
      if (count >= limit || aborted) return;
    }
  }

  backtrack(start);
  return { count, solutions, aborted };
}
