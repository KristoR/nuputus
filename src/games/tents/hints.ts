import {
  GRASS,
  TENT,
  UNKNOWN,
  type PlayState,
  type TentsPuzzle,
  allNeighbors,
  colCells,
  isTreeAdjacent,
  orthoNeighbors,
  rowCells,
} from './core';
import { solveTents } from './solve';

export interface TentsDeduction {
  title: string;
  explanation: string;
  assignments: { r: number; c: number; value: number }[];
}

function unknownIn(state: PlayState, cells: [number, number][]): [number, number][] {
  return cells.filter(([r, c]) => state[r][c] === UNKNOWN);
}

function tentCountIn(state: PlayState, cells: [number, number][]): number {
  return cells.filter(([r, c]) => state[r][c] === TENT).length;
}

/** Cells that structurally can never hold a tent (not adjacent to any tree). */
function findImpossibleCells(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n, trees } = puzzle;
  const found: [number, number][] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (trees[r][c] || state[r][c] !== UNKNOWN) continue;
      if (!isTreeAdjacent(trees, n, r, c)) found.push([r, c]);
    }
  }
  if (found.length === 0) return null;
  return {
    title: 'Puuga mitte külgnevad ruudud',
    explanation:
      'Need ruudud ei külgne ühegi puuga, seega ei saa neisse kunagi telki tulla — need on kindlasti rohi.',
    assignments: found.map(([r, c]) => ({ r, c, value: GRASS })),
  };
}

/** A row or column whose tent quota is already met — the rest must be grass. */
function findRowColSatisfied(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n, rowClue, colClue } = puzzle;
  for (let r = 0; r < n; r++) {
    const cells = rowCells(n, r);
    const rest = unknownIn(state, cells);
    if (rest.length > 0 && tentCountIn(state, cells) === rowClue[r]) {
      return {
        title: 'Rida on täis',
        explanation: `Real ${r + 1} on juba kõik ${rowClue[r]} telki paigas, seega ülejäänud tühjad ruudud sellel real on rohi.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: GRASS })),
      };
    }
  }
  for (let c = 0; c < n; c++) {
    const cells = colCells(n, c);
    const rest = unknownIn(state, cells);
    if (rest.length > 0 && tentCountIn(state, cells) === colClue[c]) {
      return {
        title: 'Veerg on täis',
        explanation: `Veerus ${c + 1} on juba kõik ${colClue[c]} telki paigas, seega ülejäänud tühjad ruudud selles veerus on rohi.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: GRASS })),
      };
    }
  }
  return null;
}

/** A row or column whose remaining empty cells exactly match the remaining tent quota. */
function findRowColForced(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n, rowClue, colClue } = puzzle;
  for (let r = 0; r < n; r++) {
    const cells = rowCells(n, r);
    const rest = unknownIn(state, cells);
    const need = rowClue[r] - tentCountIn(state, cells);
    if (need > 0 && rest.length === need) {
      return {
        title: 'Rida on sunnitud',
        explanation: `Real ${r + 1} on vaja veel ${need} telki ja täpselt nii palju tühje ruute ongi jäänud — seega kõik need ruudud peavad olema telgid.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: TENT })),
      };
    }
  }
  for (let c = 0; c < n; c++) {
    const cells = colCells(n, c);
    const rest = unknownIn(state, cells);
    const need = colClue[c] - tentCountIn(state, cells);
    if (need > 0 && rest.length === need) {
      return {
        title: 'Veerg on sunnitud',
        explanation: `Veerus ${c + 1} on vaja veel ${need} telki ja täpselt nii palju tühje ruute ongi jäänud — seega kõik need ruudud peavad olema telgid.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: TENT })),
      };
    }
  }
  return null;
}

/** A tree with only one remaining possible adjacent tent cell. */
function findForcedTreePartner(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n, trees } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!trees[r][c]) continue;
      const neigh = orthoNeighbors(n, r, c);
      const alreadyHasTent = neigh.some(([rr, cc]) => state[rr][cc] === TENT);
      if (alreadyHasTent) continue;
      const candidates = neigh.filter(([rr, cc]) => state[rr][cc] === UNKNOWN);
      if (candidates.length === 1) {
        const [tr, tc] = candidates[0];
        return {
          title: 'Puul on ainult üks võimalus',
          explanation: `Puul (rida ${r + 1}, veerg ${c + 1}) on alles jäänud ainult üks vaba naaberruut, kuhu telk saab tulla: rida ${tr + 1}, veerg ${tc + 1}.`,
          assignments: [{ r: tr, c: tc, value: TENT }],
        };
      }
    }
  }
  return null;
}

/** Cells touching an already-placed tent (orthogonally or diagonally) must be grass. */
function findTentNeighborsGrass(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state[r][c] !== TENT) continue;
      const rest = allNeighbors(n, r, c).filter(([rr, cc]) => state[rr][cc] === UNKNOWN);
      if (rest.length > 0) {
        return {
          title: 'Telkide vahel peab olema vahe',
          explanation: `Telgid ei tohi omavahel kokku puutuda, isegi mitte nurgapidi. Kuna ruudus (rida ${r + 1}, veerg ${c + 1}) on telk, peavad kõik selle naaberruudud olema rohi.`,
          assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: GRASS })),
        };
      }
    }
  }
  return null;
}

function findFallback(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  const { n, trees, rowClue, colClue } = puzzle;
  const { first } = solveTents(n, trees, rowClue, colClue, 1);
  if (!first) return null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (trees[r][c] || state[r][c] !== UNKNOWN) continue;
      return {
        title: 'Keerulisem samm',
        explanation: `See ruut (rida ${r + 1}, veerg ${c + 1}) vajab põhjalikumat loogikat — proovi mõttes läbi mängida, mis juhtuks, kui siia paneksid telgi või rohu, ning vaata, kumb viib vastuoluni.`,
        assignments: [{ r, c, value: first[r][c] }],
      };
    }
  }
  return null;
}

export function getTentsHint(puzzle: TentsPuzzle, state: PlayState): TentsDeduction | null {
  return (
    findImpossibleCells(puzzle, state) ??
    findRowColSatisfied(puzzle, state) ??
    findForcedTreePartner(puzzle, state) ??
    findRowColForced(puzzle, state) ??
    findTentNeighborsGrass(puzzle, state) ??
    findFallback(puzzle, state)
  );
}
