import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { GRASS, TENT, UNKNOWN, emptyPlay, type PlayState } from './core';
import { generateTents } from './generate';
import { getTentsHint, type TentsDeduction } from './hints';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> aseta igale puule 🌲 üks telk ⛺ vahetult kõrvalasuvasse (mitte diagonaalses) ruutu.</p>
  <p>Telgid ei tohi omavahel kokku puutuda, ka mitte nurgapidi. Numbrid rea lõpus ja veeru all näitavad, mitu telki peab seal olema.</p>
  <p>Puuduta ruutu, et selle olek muutuks: tühi → telk → rohi → tühi. Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
`;

export function mountTents(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Telklaager');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    root.append(
      renderDifficultyPicker({
        gameTitle: 'Telklaager',
        emoji: '⛺',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty) {
    const puzzle = generateTents(difficulty);
    const { n, trees, rowClue, colClue, solution } = puzzle;
    const state: PlayState = emptyPlay(n);
    let hint: TentsDeduction | null = null;
    let errorCells = new Set<string>();
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});

    function tentsPlaced(): number {
      return state.flat().filter((v) => v === TENT).length;
    }

    function renderStatus() {
      clear(statusLine);
      const total = trees.flat().filter(Boolean).length;
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${tentsPlaced()}/${total} telki`]));
    }

    function cycle(r: number, c: number) {
      if (trees[r][c] || solved) return;
      const cur = state[r][c];
      state[r][c] = cur === UNKNOWN ? TENT : cur === TENT ? GRASS : UNKNOWN;
      errorCells = new Set();
      hint = null;
      checkSolved();
      renderAll();
    }

    function checkSolved() {
      const complete = state.every((row, r) => row.every((v, c) => (trees[r][c] ? true : v !== UNKNOWN)));
      if (!complete) return;
      const ok = state.every((row, r) => row.every((v, c) => trees[r][c] || v === solution[r][c]));
      if (ok) solved = true;
    }

    function checkBoard() {
      const bad = new Set<string>();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (!trees[r][c] && state[r][c] !== UNKNOWN && state[r][c] !== solution[r][c]) {
            bad.add(`${r},${c}`);
          }
        }
      }
      errorCells = bad;
      renderAll();
    }

    function showHint() {
      if (solved) return;
      hint = getTentsHint(puzzle, state);
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

    function glyphFor(r: number, c: number): string {
      if (trees[r][c]) return '🌲';
      const v = state[r][c];
      if (v === TENT) return '⛺';
      if (v === GRASS) return '·';
      return '';
    }

    function renderBoard() {
      clear(boardWrap);
      const grid = el('div', { class: 'tents-grid' });
      grid.style.setProperty('--n', String(n + 1));
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const key = `${r},${c}`;
          const classes = ['tents-cell'];
          if (trees[r][c]) classes.push('tree');
          if (state[r][c] === TENT) classes.push('tent');
          if (state[r][c] === GRASS) classes.push('grass');
          if (hint?.assignments.some((a) => a.r === r && a.c === c)) classes.push('hint-primary');
          if (errorCells.has(key)) classes.push('error');
          const cell = el('button', { class: classes.join(' ') }, [glyphFor(r, c)]);
          cell.addEventListener('click', () => cycle(r, c));
          grid.append(cell);
        }
        const rowClueCell = el('div', { class: 'tents-clue' }, [String(rowClue[r])]);
        grid.append(rowClueCell);
      }
      for (let c = 0; c < n; c++) {
        grid.append(el('div', { class: 'tents-clue' }, [String(colClue[c])]));
      }
      grid.append(el('div', { class: 'tents-clue corner' }, ['']));
      boardWrap.append(grid);
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Kõik telgid on õigel kohal.'));
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
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['⛺ Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, rulesBox);
    renderAll();
  }

  showPicker();

  return () => {};
}
