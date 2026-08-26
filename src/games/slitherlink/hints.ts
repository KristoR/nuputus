import {
  ON,
  OFF,
  UNKNOWN,
  type Edge,
  type EdgeState,
  type SlitherlinkPuzzle,
  allEdges,
  cellEdges,
  getEdge,
  vertexEdges,
} from './core';

export interface SlitherlinkDeduction {
  title: string;
  explanation: string;
  assignments: { edge: Edge; value: number }[];
}

function findClueSatisfied(puzzle: SlitherlinkPuzzle, state: EdgeState): SlitherlinkDeduction | null {
  const { n, clue } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (clue[r][c] < 0) continue;
      const { top, bottom, left, right } = cellEdges(r, c);
      const edges = [top, bottom, left, right];
      const on = edges.filter((e) => getEdge(state, e) === ON).length;
      const unk = edges.filter((e) => getEdge(state, e) === UNKNOWN);
      if (unk.length > 0 && on === clue[r][c]) {
        return {
          title: 'Vihje on juba täidetud',
          explanation: `Ruudu (rida ${r + 1}, veerg ${c + 1}) vihje on ${clue[r][c]} ja selle ümber on juba täpselt nii palju jooni — seega ülejäänud servad selle ruudu ümber jäävad kindlasti tühjaks.`,
          assignments: unk.map((e) => ({ edge: e, value: OFF })),
        };
      }
    }
  }
  return null;
}

function findClueForced(puzzle: SlitherlinkPuzzle, state: EdgeState): SlitherlinkDeduction | null {
  const { n, clue } = puzzle;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (clue[r][c] < 0) continue;
      const { top, bottom, left, right } = cellEdges(r, c);
      const edges = [top, bottom, left, right];
      const on = edges.filter((e) => getEdge(state, e) === ON).length;
      const unk = edges.filter((e) => getEdge(state, e) === UNKNOWN);
      if (unk.length > 0 && on + unk.length === clue[r][c]) {
        return {
          title: 'Vihje on sunnitud',
          explanation: `Ruudu (rida ${r + 1}, veerg ${c + 1}) vihje on ${clue[r][c]}. Praegu on ${on} joont ja alles on täpselt nii palju vabu servi kui veel vaja — seega peavad needki kõik olema jooned.`,
          assignments: unk.map((e) => ({ edge: e, value: ON })),
        };
      }
    }
  }
  return null;
}

function findVertexTwo(n: number, state: EdgeState): SlitherlinkDeduction | null {
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const edges = vertexEdges(n, r, c);
      const on = edges.filter((e) => getEdge(state, e) === ON).length;
      const unk = edges.filter((e) => getEdge(state, e) === UNKNOWN);
      if (on === 2 && unk.length > 0) {
        return {
          title: 'Punktist väljub juba kaks joont',
          explanation: `Igast punktist saab joon minna kas nulja või kahte suunda, mitte kolme. Punktis (rida ${r}, veerg ${c}) on juba kaks joont, seega ülejäänud sellest punktist väljuvad servad jäävad tühjaks.`,
          assignments: unk.map((e) => ({ edge: e, value: OFF })),
        };
      }
    }
  }
  return null;
}

function findVertexOneOne(n: number, state: EdgeState): SlitherlinkDeduction | null {
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const edges = vertexEdges(n, r, c);
      const on = edges.filter((e) => getEdge(state, e) === ON).length;
      const unk = edges.filter((e) => getEdge(state, e) === UNKNOWN);
      if (on === 1 && unk.length === 1) {
        return {
          title: 'Joon vajab teist otsa',
          explanation: `Punktist (rida ${r}, veerg ${c}) väljub juba üks joon. Kuna punktist peab joon minema kas nulja või kahte suunda, ja üks suund on juba kasutusel, peab ka viimane allesjäänud serv olema joon.`,
          assignments: [{ edge: unk[0], value: ON }],
        };
      }
    }
  }
  return null;
}

function findVertexZeroOne(n: number, state: EdgeState): SlitherlinkDeduction | null {
  for (let r = 0; r <= n; r++) {
    for (let c = 0; c <= n; c++) {
      const edges = vertexEdges(n, r, c);
      const on = edges.filter((e) => getEdge(state, e) === ON).length;
      const unk = edges.filter((e) => getEdge(state, e) === UNKNOWN);
      if (on === 0 && unk.length === 1) {
        return {
          title: 'Üksik joon oleks vale',
          explanation: `Punktist (rida ${r}, veerg ${c}) ei välju hetkel ühtegi joont ja peaaegu kõik servad on juba tühjad. Kuna punktist ei saa väljuda täpselt üks joon (ainult null või kaks), peab viimane allesjäänud serv samuti tühjaks jääma.`,
          assignments: [{ edge: unk[0], value: OFF }],
        };
      }
    }
  }
  return null;
}

function findFallback(puzzle: SlitherlinkPuzzle, state: EdgeState): SlitherlinkDeduction | null {
  const { n, solution } = puzzle;
  for (const e of allEdges(n)) {
    if (getEdge(state, e) === UNKNOWN) {
      const trueVal = getEdge(solution, e);
      return {
        title: 'Keerulisem samm',
        explanation:
          'See serv vajab põhjalikumat loogikat — proovi mõttes joont sinna tõmmata ja jälgida, kas see viib vastuoluni mõnes teises ruudus või punktis.',
        assignments: [{ edge: e, value: trueVal }],
      };
    }
  }
  return null;
}

export function getSlitherlinkHint(puzzle: SlitherlinkPuzzle, state: EdgeState): SlitherlinkDeduction | null {
  return (
    findClueSatisfied(puzzle, state) ??
    findClueForced(puzzle, state) ??
    findVertexTwo(puzzle.n, state) ??
    findVertexOneOne(puzzle.n, state) ??
    findVertexZeroOne(puzzle.n, state) ??
    findFallback(puzzle, state)
  );
}
