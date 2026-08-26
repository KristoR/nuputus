import {
  SHIP,
  UNKNOWN,
  WATER,
  type BattleshipPuzzle,
  type PlayState,
  colCells,
  diagonalNeighbors,
  rowCells,
} from './core';

export interface BattleshipDeduction {
  title: string;
  explanation: string;
  assignments: { r: number; c: number; value: number }[];
}

function unknownIn(state: PlayState, cells: [number, number][]): [number, number][] {
  return cells.filter(([r, c]) => state[r][c] === UNKNOWN);
}

function shipCountIn(state: PlayState, cells: [number, number][]): number {
  return cells.filter(([r, c]) => state[r][c] === SHIP).length;
}

function findDiagonalExclusion(puzzle: BattleshipPuzzle, state: PlayState): BattleshipDeduction | null {
  const { n } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state[r][c] !== SHIP) continue;
      const rest = diagonalNeighbors(n, r, c).filter(([rr, cc]) => state[rr][cc] === UNKNOWN);
      if (rest.length > 0) {
        return {
          title: 'Laevad ei puutu diagonaalselt',
          explanation: `Laevaosad ei puutu kunagi teineteist nurga pealt. Kuna ruudus (rida ${r + 1}, veerg ${c + 1}) on laev, on selle diagonaalsed naaberruudud kindlasti vesi.`,
          assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: WATER })),
        };
      }
    }
  }
  return null;
}

function findRowColSatisfied(puzzle: BattleshipPuzzle, state: PlayState): BattleshipDeduction | null {
  const { n, rowClue, colClue } = puzzle;
  for (let r = 0; r < n; r++) {
    const cells = rowCells(n, r);
    const rest = unknownIn(state, cells);
    if (rest.length > 0 && shipCountIn(state, cells) === rowClue[r]) {
      return {
        title: 'Rida on täis',
        explanation: `Real ${r + 1} on juba kõik ${rowClue[r]} laevaruutu leitud, seega ülejäänud tühjad ruudud sellel real on kindlasti vesi.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: WATER })),
      };
    }
  }
  for (let c = 0; c < n; c++) {
    const cells = colCells(n, c);
    const rest = unknownIn(state, cells);
    if (rest.length > 0 && shipCountIn(state, cells) === colClue[c]) {
      return {
        title: 'Veerg on täis',
        explanation: `Veerus ${c + 1} on juba kõik ${colClue[c]} laevaruutu leitud, seega ülejäänud tühjad ruudud selles veerus on kindlasti vesi.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: WATER })),
      };
    }
  }
  return null;
}

function findRowColForced(puzzle: BattleshipPuzzle, state: PlayState): BattleshipDeduction | null {
  const { n, rowClue, colClue } = puzzle;
  for (let r = 0; r < n; r++) {
    const cells = rowCells(n, r);
    const rest = unknownIn(state, cells);
    const need = rowClue[r] - shipCountIn(state, cells);
    if (need > 0 && rest.length === need) {
      return {
        title: 'Rida on sunnitud',
        explanation: `Real ${r + 1} on vaja veel ${need} laevaruutu ja täpselt nii palju tühje ruute ongi jäänud — seega on need kõik laevaosad.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: SHIP })),
      };
    }
  }
  for (let c = 0; c < n; c++) {
    const cells = colCells(n, c);
    const rest = unknownIn(state, cells);
    const need = colClue[c] - shipCountIn(state, cells);
    if (need > 0 && rest.length === need) {
      return {
        title: 'Veerg on sunnitud',
        explanation: `Veerus ${c + 1} on vaja veel ${need} laevaruutu ja täpselt nii palju tühje ruute ongi jäänud — seega on need kõik laevaosad.`,
        assignments: rest.map(([rr, cc]) => ({ r: rr, c: cc, value: SHIP })),
      };
    }
  }
  return null;
}

function findFallback(puzzle: BattleshipPuzzle, state: PlayState): BattleshipDeduction | null {
  const { n, solution } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state[r][c] === UNKNOWN) {
        return {
          title: 'Keerulisem samm',
          explanation: `See ruut (rida ${r + 1}, veerg ${c + 1}) vajab põhjalikumat loogikat — vaata laevastiku suurusi ning mõtle, kuhu ülejäänud laevad üldse mahuksid.`,
          assignments: [{ r, c, value: solution[r][c] }],
        };
      }
    }
  }
  return null;
}

export function getBattleshipHint(puzzle: BattleshipPuzzle, state: PlayState): BattleshipDeduction | null {
  return (
    findDiagonalExclusion(puzzle, state) ??
    findRowColSatisfied(puzzle, state) ??
    findRowColForced(puzzle, state) ??
    findFallback(puzzle, state)
  );
}
