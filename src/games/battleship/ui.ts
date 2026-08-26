import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { SHIP, UNKNOWN, WATER, cloneOrEmpty, shipShapeClass, type PlayState } from './core';
import { generateBattleship } from './generate';
import { getBattleshipHint, type BattleshipDeduction } from './hints';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> leia ookeani peidetud laevastik. Laevad on horisontaalsed või vertikaalsed ega puutu teineteist, ka mitte nurgapidi.</p>
  <p>Numbrid rea lõpus ja veeru all näitavad, mitu ruutu selles reas/veerus on laevaosade all.</p>
  <p>Puuduta ruutu, et selle olek muutuks: tühi → laev → vesi → tühi. Mõnel ruudul võib juba valmis vihje olla.</p>
`;

const FLEET_NAMES: Record<number, string> = { 4: 'Emalaev', 3: 'Ristleja', 2: 'Kaater', 1: 'Skuuter' };

export function mountBattleship(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Laevade pommitamine');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    root.append(
      renderDifficultyPicker({
        gameTitle: 'Laevade pommitamine',
        emoji: '🚢',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty) {
    const puzzle = generateBattleship(difficulty);
    const { n, fleet, rowClue, colClue, solution, givens } = puzzle;
    const state: PlayState = cloneOrEmpty(givens, n);
    let hint: BattleshipDeduction | null = null;
    let errorCells = new Set<string>();
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});
    const fleetHost = el('div', { class: 'fleet-legend' });

    function shipsFound(): number {
      let count = 0;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (state[r][c] === SHIP && (c === 0 || state[r][c - 1] !== SHIP) && (r === 0 || state[r - 1][c] !== SHIP)) {
            count++;
          }
        }
      }
      return count;
    }

    function renderStatus() {
      clear(statusLine);
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${shipsFound()}/${fleet.length} laeva leitud`]));
    }

    function renderFleetLegend() {
      clear(fleetHost);
      const counts = new Map<number, number>();
      for (const len of fleet) counts.set(len, (counts.get(len) ?? 0) + 1);
      const items = [...counts.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([len, qty]) => el('span', { class: 'fleet-item' }, [`${FLEET_NAMES[len] ?? len + '-laev'} ×${qty}`]));
      fleetHost.append(...items);
    }

    function cycle(r: number, c: number) {
      if (solved || givens[r][c] !== UNKNOWN) return;
      const cur = state[r][c];
      state[r][c] = cur === UNKNOWN ? SHIP : cur === SHIP ? WATER : UNKNOWN;
      errorCells = new Set();
      hint = null;
      checkSolved();
      renderAll();
    }

    function checkSolved() {
      const complete = state.every((row) => row.every((v) => v !== UNKNOWN));
      if (!complete) return;
      const ok = state.every((row, r) => row.every((v, c) => v === solution[r][c]));
      if (ok) solved = true;
    }

    function checkBoard() {
      const bad = new Set<string>();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (state[r][c] !== UNKNOWN && state[r][c] !== solution[r][c]) bad.add(`${r},${c}`);
        }
      }
      errorCells = bad;
      renderAll();
    }

    function showHint() {
      if (solved) return;
      hint = getBattleshipHint(puzzle, state);
      renderAll();
    }

    function applyHint() {
      if (!hint) return;
      for (const a of hint.assignments) state[a.r][a.c] = a.value;
      hint = null;
      errorCells = new Set();
      checkSolved();
      renderAll();
    }

    function renderBoard() {
      clear(boardWrap);
      const grid = el('div', { class: 'battleship-grid' });
      grid.style.setProperty('--n', String(n + 1));
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const key = `${r},${c}`;
          const v = state[r][c];
          const classes = ['battleship-cell'];
          if (givens[r][c] !== UNKNOWN) classes.push('given');
          if (hint?.assignments.some((a) => a.r === r && a.c === c)) classes.push('hint-primary');
          if (errorCells.has(key)) classes.push('error');

          const cell = el('button', { class: classes.join(' ') });
          if (v === SHIP) {
            cell.append(el('span', { class: `ship-piece ${shipShapeClass(state, n, r, c)}` }));
          } else if (v === WATER) {
            cell.append(el('span', { class: 'water-mark' }, ['×']));
          }
          cell.addEventListener('click', () => cycle(r, c));
          grid.append(cell);
        }
        grid.append(el('div', { class: 'battleship-clue' }, [String(rowClue[r])]));
      }
      for (let c = 0; c < n; c++) {
        grid.append(el('div', { class: 'battleship-clue' }, [String(colClue[c])]));
      }
      grid.append(el('div', { class: 'battleship-clue corner' }, ['']));
      boardWrap.append(grid);
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Laevastik on täielikult leitud.'));
      else if (errorCells.size > 0) messageHost.append(renderMessage('error', 'Mõni märgitud ruut ei klapi lahendusega.'));
    }

    function renderHintHost() {
      clear(hintHost);
      if (hint) {
        hintHost.append(
          renderHintPanel({ title: hint.title, explanation: hint.explanation, primary: [], apply: applyHint }, applyHint, () => {
            hint = null;
            renderAll();
          }),
        );
      }
    }

    function renderAll() {
      renderStatus();
      renderBoard();
      renderHintHost();
      renderMessages();
    }

    clear(root);
    toolbar.append(toolbarButton('Vihje', showHint), toolbarButton('Kontrolli', checkBoard), toolbarButton('Uus mäng', showPicker));
    renderFleetLegend();
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['🚢 Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, fleetHost, boardWrap, hintHost, messageHost, rulesBox);
    renderAll();
  }

  showPicker();

  return () => {};
}
