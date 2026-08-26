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

function findUnitSatisfied(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  for (const unit of allUnits(puzzle)) {
    const rest = unknownIn(state, unit.cells);
    if (rest.length > 0 && starCountIn(state, unit.cells) === 1) {
      return {
        title: 'Täht on juba paigas',
        explanation: `${capitalize(unit.label)} on täht juba olemas, seega kõik ülejäänud tühjad ruudud sealsamas jäävad tähetuks.`,
        assignments: rest.map(([r, c]) => ({ r, c, value: EMPTY })),
      };
    }
  }
  return null;
}

function findUnitForcedSingle(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  for (const unit of allUnits(puzzle)) {
    const rest = unknownIn(state, unit.cells);
    if (starCountIn(state, unit.cells) === 0 && rest.length === 1) {
      const [r, c] = rest[0];
      return {
        title: 'Ainus võimalik koht',
        explanation: `${capitalize(unit.label)} on jäänud ainult üks vaba ruut ja seal peab olema täht: rida ${r + 1}, veerg ${c + 1}.`,
        assignments: [{ r, c, value: STAR }],
      };
    }
  }
  return null;
}

/** A region whose remaining candidate cells all sit in one row/column forces the rest of that line empty. */
function findRegionLineReduction(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { n, regions } = puzzle;
  for (let id = 0; id < n; id++) {
    const cells = regionCells(regions, n, id);
    if (starCountIn(state, cells) > 0) continue;
    const rest = unknownIn(state, cells);
    if (rest.length < 2) continue;

    const rows = new Set(rest.map(([r]) => r));
    if (rows.size === 1) {
      const r = rest[0][0];
      const outside = rowCells(n, r).filter(([, c]) => regions[r][c] !== id && state[r][c] === UNKNOWN);
      if (outside.length > 0) {
        return {
          title: 'Ala on kitsendatud reale',
          explanation: `Selle ala kõik võimalikud tähekohad on real ${r + 1} — seega peab ala täht tulema sinna ritta ning rea ülejäänud, alasse mittekuuluvad ruudud jäävad tähetuks.`,
          assignments: outside.map(([rr, cc]) => ({ r: rr, c: cc, value: EMPTY })),
        };
      }
    }

    const cols = new Set(rest.map(([, c]) => c));
    if (cols.size === 1) {
      const c = rest[0][1];
      const outside = colCells(n, c).filter(([r]) => regions[r][c] !== id && state[r][c] === UNKNOWN);
      if (outside.length > 0) {
        return {
          title: 'Ala on kitsendatud veerule',
          explanation: `Selle ala kõik võimalikud tähekohad on veerus ${c + 1} — seega peab ala täht tulema sinna veergu ning veeru ülejäänud, alasse mittekuuluvad ruudud jäävad tähetuks.`,
          assignments: outside.map(([rr, cc]) => ({ r: rr, c: cc, value: EMPTY })),
        };
      }
    }
  }
  return null;
}

function findFallback(puzzle: StarBattlePuzzle, state: PlayState): StarBattleDeduction | null {
  const { n, regions } = puzzle;
  const { first } = solveStarBattle(n, regions, 1);
  if (!first) return null;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (state[r][c] === UNKNOWN) {
        return {
          title: 'Keerulisem samm',
          explanation: `See ruut (rida ${r + 1}, veerg ${c + 1}) vajab põhjalikumat loogikat. Vaata, kuhu tähed selles reas, veerus ja alas veel üldse mahuksid, ja proovi variante läbi mängida.`,
          assignments: [{ r, c, value: first[r][c] }],
        };
      }
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
    findUnitForcedSingle(puzzle, state) ??
    findRegionLineReduction(puzzle, state) ??
    findFallback(puzzle, state)
  );
}
