import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { EMPTY, STAR, UNKNOWN, emptyPlay, type PlayState } from './core';
import { generateStarBattle } from './generate';
import { getStarBattleHint, type StarBattleDeduction } from './hints';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> aseta igasse ritta, veergu ja värvilisse alasse täpselt üks täht ⭐.</p>
  <p>Tähed ei tohi teineteist puutuda ka mitte nurga pealt.</p>
  <p>Puuduta ruutu, et selle olek muutuks: tühi → täht → rist → tühi. Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
`;

const PALETTE = ['#e7d9c4', '#d8e3d3', '#dbe0ea', '#ecd9df', '#e0e6c8', '#dde3ec', '#ecdccb', '#d6e6e2', '#e5dcec', '#e9e0cf'];

export function mountStarBattle(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Tähesõda');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    root.append(
      renderDifficultyPicker({
        gameTitle: 'Tähesõda',
        emoji: '⭐',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty) {
    const puzzle = generateStarBattle(difficulty);
    const { n, regions, solution } = puzzle;
    const state: PlayState = emptyPlay(n);
    let hint: StarBattleDeduction | null = null;
    let errorCells = new Set<string>();
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});

    function starsPlaced(): number {
      return state.flat().filter((v) => v === STAR).length;
    }

    function renderStatus() {
      clear(statusLine);
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${starsPlaced()}/${n} tähte`]));
    }

    function cycle(r: number, c: number) {
      if (solved) return;
      const cur = state[r][c];
      state[r][c] = cur === UNKNOWN ? STAR : cur === STAR ? EMPTY : UNKNOWN;
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
      hint = getStarBattleHint(puzzle, state);
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
      const v = state[r][c];
      if (v === STAR) return '⭐';
      if (v === EMPTY) return '×';
      return '';
    }

    function renderBoard() {
      clear(boardWrap);
      const grid = el('div', { class: 'starbattle-grid' });
      grid.style.setProperty('--n', String(n));
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const key = `${r},${c}`;
          const region = regions[r][c];
          const classes = ['starbattle-cell'];
          if (r === 0 || regions[r - 1][c] !== region) classes.push('border-top');
          if (c === 0 || regions[r][c - 1] !== region) classes.push('border-left');
          if (r === n - 1 || regions[r + 1][c] !== region) classes.push('border-bottom');
          if (c === n - 1 || regions[r][c + 1] !== region) classes.push('border-right');
          if (hint?.assignments.some((a) => a.r === r && a.c === c)) classes.push('hint-primary');
          if (errorCells.has(key)) classes.push('error');
          if (state[r][c] === EMPTY) classes.push('empty-mark');

          const cell = el(
            'button',
            { class: classes.join(' '), style: `background:${PALETTE[region % PALETTE.length]}` },
            [glyphFor(r, c)],
          );
          cell.addEventListener('click', () => cycle(r, c));
          grid.append(cell);
        }
      }
      boardWrap.append(grid);
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Kõik tähed on õigel kohal.'));
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
    rulesBox.append(el('summary', {}, ['⭐ Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, rulesBox);
    renderAll();
  }

  showPicker();

  return () => {};
}
