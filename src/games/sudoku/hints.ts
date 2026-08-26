import { boxCells, candidates, type Board } from './core';

export interface SudokuDeduction {
  r: number;
  c: number;
  v: number;
  title: string;
  explanation: string;
  primary: [number, number][];
  secondary: [number, number][];
}

type Unit = { cells: [number, number][]; label: string };

function rowUnit(r: number): Unit {
  const cells: [number, number][] = [];
  for (let c = 0; c < 9; c++) cells.push([r, c]);
  return { cells, label: `real ${r + 1}` };
}

function colUnit(c: number): Unit {
  const cells: [number, number][] = [];
  for (let r = 0; r < 9; r++) cells.push([r, c]);
  return { cells, label: `veerus ${c + 1}` };
}

function boxUnit(b: number): Unit {
  return { cells: boxCells(b), label: `kastis ${b + 1}` };
}

function allUnits(): Unit[] {
  const units: Unit[] = [];
  for (let i = 0; i < 9; i++) units.push(rowUnit(i), colUnit(i), boxUnit(i));
  return units;
}

/** A cell with exactly one remaining candidate. */
function findNakedSingle(board: Board): SudokuDeduction | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      const cand = candidates(board, r, c);
      if (cand.length === 1) {
        const [v] = cand;
        return {
          r,
          c,
          v,
          title: 'Ainus võimalus',
          explanation: `Ruutu (rida ${r + 1}, veerg ${c + 1}) sobib ainult number ${v} — kõik teised numbrid 1–9 esinevad juba selles reas, veerus või 3×3 kastis.`,
          primary: [[r, c]],
          secondary: [],
        };
      }
    }
  }
  return null;
}

/** A value that fits in only one cell within a row, column, or box. */
function findHiddenSingle(board: Board): SudokuDeduction | null {
  for (const unit of allUnits()) {
    for (let v = 1; v <= 9; v++) {
      const spots = unit.cells.filter(([r, c]) => board[r][c] === 0 && candidates(board, r, c).includes(v));
      if (spots.length === 1) {
        const already = unit.cells.some(([r, c]) => board[r][c] === v);
        if (already) continue;
        const [r, c] = spots[0];
        return {
          r,
          c,
          v,
          title: 'Peidetud üksik',
          explanation: `Numbrile ${v} on ${unit.label} alles jäänud ainult üks vaba koht: rida ${r + 1}, veerg ${c + 1}. Kõigis teistes selle ala vabades ruutudes on ${v} juba mõne teise täidetud numbri tõttu välistatud.`,
          primary: [[r, c]],
          secondary: unit.cells.filter(([ur, uc]) => !(ur === r && uc === c)),
        };
      }
    }
  }
  return null;
}

/**
 * Fallback for deductions that need techniques beyond naked/hidden singles.
 * Picks the empty cell with fewest candidates and reveals its value from the
 * known solution, being honest that this needs deeper logic than the two
 * taught techniques.
 */
function findFallback(board: Board, solution: Board): SudokuDeduction | null {
  let best: [number, number, number] | null = null; // r, c, candidateCount
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c] !== 0) continue;
      const n = candidates(board, r, c).length;
      if (!best || n < best[2]) best = [r, c, n];
    }
  }
  if (!best) return null;
  const [r, c] = best;
  const v = solution[r][c];
  return {
    r,
    c,
    v,
    title: 'Keerulisem samm',
    explanation: `See koht (rida ${r + 1}, veerg ${c + 1}) vajab põhjalikumat loogikat kui "ainus võimalus" või "peidetud üksik" — siia sobib number ${v}. Proovi mitme väärtuse jaoks läbi mõelda, millistesse ruutudesse see number samas kastis, reas ja veerus üldse mahuks.`,
    primary: [[r, c]],
    secondary: [],
  };
}

export function getSudokuHint(board: Board, solution: Board): SudokuDeduction | null {
  return findNakedSingle(board) ?? findHiddenSingle(board) ?? findFallback(board, solution);
}
