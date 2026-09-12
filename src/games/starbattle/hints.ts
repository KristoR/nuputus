import {
  EMPTY,
  STAR,
  UNKNOWN,
  type PlayState,
  type StarBattlePuzzle,
  colCells,
  neighbors8,
  regionCells,
  rowCells,
} from './core';
import { solveStarBattle } from './solve';

export interface StarBattleDeduction {
  title: string;
  explanation: string;
  assignments: { r: number; c: number; value: number }[];
}

type Unit = { cells: [number, number][]; label: string };

function unknownIn(state: PlayState, cells: [number, number][]): [number, number][] {
  return cells.filter(([r, c]) => state[r][c] === UNKNOWN);
}

function starCountIn(state: PlayState, cells: [number, number][]): number {
  return cells.filter(([r, c]) => state[r][c] === STAR).length;
}

function allUnits(puzzle: StarBattlePuzzle): Unit[] {
  const { n, regions } = puzzle;
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    units.push({ cells: rowCells(n, i), label: `real ${i + 1}` });
    units.push({ cells: colCells(n, i), label: `veerus ${i + 1}` });
    units.push({ cells: regionCells(regions, n, i), label: `selles alas` });
  }
  return units;
}

function starWord(count: number): string {
  return count === 1 ? '1 täht' : `${count} tähte`;
}

function findAdjacencyExclusion(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { n } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state[r][c] !== STAR) continue;
      const rest = neighbors8(n, r, c).filter(([rr, cc]) => state[rr][cc] === UNKNOWN);
      if (rest.length > 0) {
        return {
          title: 'Tähed ei tohi puutuda',
          explanation: `Tähed ei tohi teineteist puutuda ka nurgapidi. Kuna ruudus (rida ${r + 1}, veerg ${c + 1}) on täht, peavad kõik selle naaberruudud jääma tühjaks.`,
          assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: EMPTY })),
        };
      }
    }
  }
  return null;
}

/** A unit that already has all its required stars: every other cell in it must be empty. */
function findUnitSatisfied(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { stars } = puzzle;
  for (const unit of allUnits(puzzle)) {
    const rest = unknownIn(state, unit.cells);
    if (rest.length > 0 && starCountIn(state, unit.cells) === stars) {
      return {
        title: 'Täht on juba paigas',
        explanation: `${capitalize(unit.label)} on juba ${starWord(stars)}, seega kõik ülejäänud tühjad ruudud sealsamas jäävad tähetuks.`,
        assignments: rest.map(([r, c]) => ({ r, c, value: EMPTY })),
      };
    }
  }
  return null;
}

/** A unit whose remaining unknown cells exactly match its remaining needed stars: they must all be stars. */
function findUnitForcedFill(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { stars } = puzzle;
  for (const unit of allUnits(puzzle)) {
    const rest = unknownIn(state, unit.cells);
    const needed = stars - starCountIn(state, unit.cells);
    if (needed > 0 && rest.length === needed) {
      const single = needed === 1;
      return {
        title: single ? 'Ainus võimalik koht' : 'Ainsad võimalikud kohad',
        explanation: single
          ? `${capitalize(unit.label)} on jäänud ainult üks vaba ruut ja seal peab olema täht: rida ${rest[0][0] + 1}, veerg ${rest[0][1] + 1}.`
          : `${capitalize(unit.label)} on vaja veel ${starWord(needed)} ja vabu ruute on täpselt sama palju, seega peavad kõik need ruudud olema tähed.`,
        assignments: rest.map(([r, c]) => ({ r, c, value: STAR })),
      };
    }
  }
  return null;
}

/** A region whose remaining candidate stars all sit in one row/column, matching that row/column's own remaining need, forces the rest of that line empty. */
function findRegionLineReduction(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { n, regions, stars } = puzzle;
  for (let id = 0; id < n; id++) {
    const cells = regionCells(regions, n, id);
    const needed = stars - starCountIn(state, cells);
    if (needed <= 0) continue;
    const rest = unknownIn(state, cells);
    if (rest.length <= needed) continue; // already covered by findUnitForcedFill

    const rows = new Set(rest.map(([r]) => r));
    if (rows.size === 1) {
      const r = rest[0][0];
      const rowNeeded = stars - starCountIn(state, rowCells(n, r));
      if (rowNeeded === needed) {
        const outside = rowCells(n, r).filter(([, c]) => regions[r][c] !== id && state[r][c] === UNKNOWN);
        if (outside.length > 0) {
          return {
            title: 'Ala on kitsendatud reale',
            explanation: `Selle ala kõik ülejäänud võimalikud tähekohad on real ${r + 1} — seega peavad selle rea ülejäänud tähed tulema sealt alast ning rea teised, alasse mittekuuluvad ruudud jäävad tähetuks.`,
            assignments: outside.map(([rr, cc]) => ({ r: rr, c: cc, value: EMPTY })),
          };
        }
      }
    }

    const cols = new Set(rest.map(([, c]) => c));
    if (cols.size === 1) {
      const c = rest[0][1];
      const colNeeded = stars - starCountIn(state, colCells(n, c));
      if (colNeeded === needed) {
        const outside = colCells(n, c).filter(([r]) => regions[r][c] !== id && state[r][c] === UNKNOWN);
        if (outside.length > 0) {
          return {
            title: 'Ala on kitsendatud veerule',
            explanation: `Selle ala kõik ülejäänud võimalikud tähekohad on veerus ${c + 1} — seega peavad selle veeru ülejäänud tähed tulema sealt alast ning veeru teised, alasse mittekuuluvad ruudud jäävad tähetuks.`,
            assignments: outside.map(([rr, cc]) => ({ r: rr, c: cc, value: EMPTY })),
          };
        }
      }
    }
  }
  return null;
}

/** How "in-progress" a cell's neighbourhood is — fewer remaining unknowns in its tightest unit means it's the more natural next spot to reason about. */
function localityScore(puzzle: StarBattlePuzzle, state: PlayState, r: number, c: number): number {
  const { n, regions } = puzzle;
  const rowLeft = unknownIn(state, rowCells(n, r)).length;
  const colLeft = unknownIn(state, colCells(n, c)).length;
  const regionLeft = unknownIn(state, regionCells(regions, n, regions[r][c])).length;
  return Math.min(rowLeft, colLeft, regionLeft);
}

/**
 * For a cell that no direct rule resolves yet, try both values and see
 * which one still lets the puzzle be completed at all (the puzzle has a
 * unique solution, so exactly one of the two will remain solvable). This
 * mirrors genuine "if this were X, the puzzle would be stuck" reasoning
 * rather than just revealing the answer, and — by checking the most
 * constrained cells first — points at the part of the board that's
 * furthest along, i.e. the logical next spot to work on.
 */
function findContradiction(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { n, regions, stars } = puzzle;
  const candidates: [number, number][] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (state[r][c] === UNKNOWN) candidates.push([r, c]);
  candidates.sort((a, b) => localityScore(puzzle, state, ...a) - localityScore(puzzle, state, ...b));

  for (const [r, c] of candidates) {
    const asStar = state.map((row) => row.slice());
    asStar[r][c] = STAR;
    const starFeasible = solveStarBattle(n, regions, stars, 1, asStar).count > 0;

    const asEmpty = state.map((row) => row.slice());
    asEmpty[r][c] = EMPTY;
    const emptyFeasible = solveStarBattle(n, regions, stars, 1, asEmpty).count > 0;

    if (starFeasible && !emptyFeasible) {
      return {
        title: 'Loogiline tuletus',
        explanation: `Ruut (rida ${r + 1}, veerg ${c + 1}) peab olema täht — kui see jääks tähetuks, ei oleks mõistatust enam üldse võimalik lahendada.`,
        assignments: [{ r, c, value: STAR }],
      };
    }
    if (emptyFeasible && !starFeasible) {
      return {
        title: 'Loogiline tuletus',
        explanation: `Ruut (rida ${r + 1}, veerg ${c + 1}) peab jääma tähetuks — kui siia paigutada täht, ei oleks mõistatust enam üldse võimalik lahendada.`,
        assignments: [{ r, c, value: EMPTY }],
      };
    }
  }
  return null;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function getStarBattleHint(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  return (
    findAdjacencyExclusion(puzzle, state) ??
    findUnitSatisfied(puzzle, state) ??
    findUnitForcedFill(puzzle, state) ??
    findRegionLineReduction(puzzle, state) ??
    findContradiction(puzzle, state)
  );
}

/**
 * Whether the puzzle can be fully solved from scratch using only the cheap,
 * "obvious" techniques (no trial-and-error contradiction search). Used at
 * generation time to reject puzzles that don't actually require any real
 * reasoning, so the hardest difficulty tier is guaranteed to need it.
 */
export function solvableWithSimpleTechniques(puzzle: StarBattlePuzzle): boolean {
  const { n } = puzzle;
  const state: PlayState = Array.from({ length: n }, () => Array(n).fill(UNKNOWN));
  while (true) {
    const solved = state.every((row) => row.every((v) => v !== UNKNOWN));
    if (solved) return true;
    const step =
      findAdjacencyExclusion(puzzle, state) ??
      findUnitSatisfied(puzzle, state) ??
      findUnitForcedFill(puzzle, state) ??
      findRegionLineReduction(puzzle, state);
    if (!step) return false;
    for (const a of step.assignments) state[a.r][a.c] = a.value;
  }
}
