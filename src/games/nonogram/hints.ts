import { EMPTY, FILLED, UNKNOWN, getCol, getRow, runsOf, sameClue, type Grid, type NonogramPuzzle } from './core';
import { solveLine } from './solve';

export interface NonogramDeduction {
  title: string;
  explanation: string;
  assignments: { r: number; c: number; value: number }[];
}

type LineRef = { kind: 'row' | 'col'; index: number; clue: number[]; line: number[] };

function lines(puzzle: NonogramPuzzle, state: Grid): LineRef[] {
  const out: LineRef[] = [];
  for (let r = 0; r < puzzle.rows; r++) out.push({ kind: 'row', index: r, clue: puzzle.rowClues[r], line: getRow(state, r) });
  for (let c = 0; c < puzzle.cols; c++) out.push({ kind: 'col', index: c, clue: puzzle.colClues[c], line: getCol(state, c) });
  return out;
}

function lineName(l: LineRef): string {
  return l.kind === 'row' ? `Rida ${l.index + 1}` : `Veerg ${l.index + 1}`;
}

function clueText(clue: number[]): string {
  return clue.length === 0 ? '0' : clue.join(' ');
}

/** "ruut veerus 3 on must" / "ruudud veergudes 3, 4 on mustad", with singular/plural handled. */
function cellsAre(l: LineRef, idx: number[], what: 'must' | 'tühi', extra = ''): string {
  const nums = idx.map((i) => i + 1).join(', ');
  const word = what === 'must' ? (idx.length === 1 ? 'must' : 'mustad') : idx.length === 1 ? 'tühi' : 'tühjad';
  const mid = extra ? ` ${extra} ` : ' ';
  if (idx.length === 1) return `ruut ${l.kind === 'row' ? 'veerus' : 'real'} ${nums} on${mid}${word}`;
  return `ruudud ${l.kind === 'row' ? 'veergudes' : 'ridadel'} ${nums} on${mid}${word}`;
}

/**
 * Picks the reason that best fits what happened in this line, from the
 * most specific (and easiest to see) to the general "every placement
 * agrees" argument that covers all line logic.
 */
function explain(l: LineRef, filled: number[], emptied: number[]): { title: string; explanation: string } {
  const n = l.line.length;
  const name = lineName(l);
  const clue = clueText(l.clue);
  const hadAny = l.line.some((v) => v !== UNKNOWN);

  if (l.clue.length === 0) {
    return { title: 'Tühi rida', explanation: `${name} vihje on 0, seega jäävad kõik selle ruudud tühjaks.` };
  }
  if (sameClue(runsOf(l.line), l.clue) && filled.length === 0) {
    return {
      title: 'Plokid on paigas',
      explanation: `${name} (vihje ${clue}) kõik plokid on juba mustad, seega ülejäänud ruudud jäävad tühjaks.`,
    };
  }
  const minLen = l.clue.reduce((a, b) => a + b, 0) + l.clue.length - 1;
  if (!hadAny && minLen === n && l.clue.length === 1) {
    return { title: 'Täpselt täis', explanation: `${name} vihje on ${clue}, ehk kogu ${l.kind === 'row' ? 'rida' : 'veerg'} on must.` };
  }
  if (!hadAny && minLen === n) {
    return {
      title: 'Täpselt täis',
      explanation: `${name} vihje on ${clue}: plokid koos ühe tühja ruuduga nende vahel võtavad täpselt ${n} ruutu, ehk kogu rea. Seega on igal ruudul ainult üks võimalus.`,
    };
  }
  if (!hadAny) {
    return {
      title: 'Ülekate',
      explanation: `${name} vihje on ${clue}. Kui lükata plokid nii palju vasakule${l.kind === 'col' ? ' (üles)' : ''} kui võimalik ja siis nii palju paremale${l.kind === 'col' ? ' (alla)' : ''} kui võimalik, kattub sama plokk mõlemas asendis iseendaga. Seega ${cellsAre(l, filled, 'must', 'igal juhul')}.`,
    };
  }
  const parts: string[] = [];
  if (filled.length > 0) parts.push(cellsAre(l, filled, 'must', 'igas variandis'));
  if (emptied.length > 0) parts.push(cellsAre(l, emptied, 'tühi', 'igas variandis'));
  return {
    title: 'Kõik variandid nõustuvad',
    explanation: `${name} vihje on ${clue}. Arvestades juba märgitud ruute, mahuvad plokid sinna ainult mõnel viisil. Kui need kõik läbi proovida, siis ${parts.join(' ja ')}.`,
  };
}

/**
 * Next step by line logic: for each row and column, every placement of
 * its blocks that fits the cells already marked; cells that agree across
 * all of them are forced. Prefers the line where the step is simplest to
 * see (a finished line, an empty one, then overlap on a fresh line), then
 * the one that reveals the most.
 */
export function getNonogramHint(puzzle: NonogramPuzzle, state: Grid): NonogramDeduction | null {
  let best: { rank: number; size: number; deduction: NonogramDeduction } | null = null;
  for (const l of lines(puzzle, state)) {
    if (!l.line.includes(UNKNOWN)) continue;
    const next = solveLine(l.clue, l.line);
    if (!next) continue;
    const filled: number[] = [];
    const emptied: number[] = [];
    next.forEach((v, i) => {
      if (l.line[i] !== UNKNOWN) return;
      if (v === FILLED) filled.push(i);
      else if (v === EMPTY) emptied.push(i);
    });
    if (filled.length + emptied.length === 0) continue;
    const { title, explanation } = explain(l, filled, emptied);
    const rank = ['Tühi rida', 'Plokid on paigas', 'Täpselt täis', 'Ülekate'].indexOf(title);
    const size = filled.length + emptied.length;
    const assignments = [...filled.map((i) => ({ i, value: FILLED })), ...emptied.map((i) => ({ i, value: EMPTY }))].map(({ i, value }) =>
      l.kind === 'row' ? { r: l.index, c: i, value } : { r: i, c: l.index, value },
    );
    const r = rank === -1 ? 99 : rank;
    if (!best || r < best.rank || (r === best.rank && size > best.size)) {
      best = { rank: r, size, deduction: { title, explanation, assignments } };
    }
  }
  return best?.deduction ?? null;
}
