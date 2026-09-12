import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { attachPrimarySecondary, difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { EMPTY, STAR, UNKNOWN, emptyPlay, type PlayState } from './core';
import { generateStarBattle, type StarCount } from './generate';
import { getStarBattleHint, type StarBattleDeduction } from './hints';

function rulesHtml(stars: number | null): string {
  const goal =
    stars === null
      ? 'aseta igasse ritta, veergu ja värvilisse alasse täpselt nii mitu tähte, kui valitud versioon nõuab (1 või 2) ⭐'
      : stars === 1
        ? 'aseta igasse ritta, veergu ja värvilisse alasse täpselt üks täht ⭐'
        : `aseta igasse ritta, veergu ja värvilisse alasse täpselt ${stars} tähte ⭐⭐`;
  return `
    <p><strong>Eesmärk:</strong> ${goal}.</p>
    <p>Tähed ei tohi teineteist puutuda ka mitte nurga pealt.</p>
    <p>Puuduta ruutu, et sinna tuleks täht. Hoia all (või paremklõpsa hiirega), et märkida ruut kindlasti tähetuks (×). Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
  `;
}

const PALETTE = ['#e7d9c4', '#d8e3d3', '#dbe0ea', '#ecd9df', '#e0e6c8', '#dde3ec', '#ecdccb', '#d6e6e2', '#e5dcec', '#e9e0cf'];

export function mountStarBattle(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Tähesõda');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    let stars: StarCount = 1;

    const starButtons = ([1, 2] as StarCount[]).map((s) => {
      const btn = el('button', { class: `pill-btn${s === stars ? ' active' : ''}` }, [
        s === 1 ? '⭐ 1 täht' : '⭐⭐ 2 tähte',
      ]);
      btn.addEventListener('click', () => {
        stars = s;
        starRow.querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
      });
      return btn;
    });
    const starRow = el('div', { class: 'difficulty-row' }, starButtons);

    root.append(
      renderDifficultyPicker({
        gameTitle: 'Tähesõda',
        emoji: '⭐',
        rulesHtml: rulesHtml(null),
        extra: starRow,
        onStart: (d) => startGame(d, stars),
      }),
    );
  }

  function startGame(difficulty: Difficulty, starCount: StarCount) {
    // 2-star puzzles can take up to ~2s to generate; show a loading state
    // and defer the heavy work a tick so the message actually paints first.
    clear(root);
    root.append(el('p', { class: 'rules-box' }, ['Genereerin mõistatust...']));
    window.setTimeout(() => buildGame(generateStarBattle(difficulty, starCount), difficulty), 10);
  }

  function buildGame(puzzle: ReturnType<typeof generateStarBattle>, difficulty: Difficulty) {
    const { n, stars, regions, solution } = puzzle;
    const state: PlayState = emptyPlay(n);
    let hint: StarBattleDeduction | null = null;
    let errorCells = new Set<string>();
    let checkedOk = false;
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});
    const cellEls: HTMLButtonElement[][] = [];

    function starsPlaced(): number {
      return state.flat().filter((v) => v === STAR).length;
    }

    function renderStatus() {
      clear(statusLine);
      const label = stars === 1 ? difficultyLabel(difficulty) : `${difficultyLabel(difficulty)} · ${stars}★`;
      statusLine.append(el('span', {}, [`${label} · ${starsPlaced()}/${n * stars} tähte`]));
    }

    function setCell(r: number, c: number, value: number) {
      if (solved) return;
      state[r][c] = value;
      errorCells = new Set();
      checkedOk = false;
      hint = null;
      checkSolved();
      updateAllCells();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    function togglePrimary(r: number, c: number) {
      setCell(r, c, state[r][c] === STAR ? UNKNOWN : STAR);
    }

    function toggleSecondary(r: number, c: number) {
      setCell(r, c, state[r][c] === EMPTY ? UNKNOWN : EMPTY);
    }

    /** Solved once every star matches the solution — X marks are just an optional aid. */
    function checkSolved() {
      const ok = state.every((row, r) => row.every((v, c) => (v === STAR) === (solution[r][c] === STAR)));
      if (ok) solved = true;
    }

    function checkBoard() {
      checkSolved();
      const bad = new Set<string>();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (state[r][c] !== UNKNOWN && state[r][c] !== solution[r][c]) bad.add(`${r},${c}`);
        }
      }
      errorCells = bad;
      checkedOk = bad.size === 0 && !solved;
      updateAllCells();
      renderMessages();
    }

    function showHint() {
      if (solved) return;
      hint = getStarBattleHint(puzzle, state);
      updateAllCells();
      renderHintHost();
    }

    function applyHint() {
      if (!hint) return;
      for (const a of hint.assignments) state[a.r][a.c] = a.value;
      hint = null;
      errorCells = new Set();
      checkedOk = false;
      checkSolved();
      updateAllCells();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    function glyphFor(r: number, c: number): string {
      const v = state[r][c];
      if (v === STAR) return '⭐';
      if (v === EMPTY) return '×';
      return '';
    }

    function updateCell(r: number, c: number) {
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

      const cell = cellEls[r][c];
      cell.className = classes.join(' ');
      cell.textContent = glyphFor(r, c);
    }

    function updateAllCells() {
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) updateCell(r, c);
    }

    function buildBoard() {
      clear(boardWrap);
      const grid = el('div', { class: 'starbattle-grid' });
      grid.style.setProperty('--n', String(n));
      for (let r = 0; r < n; r++) {
        cellEls[r] = [];
        for (let c = 0; c < n; c++) {
          const region = regions[r][c];
          const cell = el('button', { class: 'starbattle-cell', style: `background:${PALETTE[region % PALETTE.length]}` });
          attachPrimarySecondary(
            cell,
            () => togglePrimary(r, c),
            () => toggleSecondary(r, c),
          );
          cellEls[r][c] = cell;
          grid.append(cell);
        }
      }
      boardWrap.append(grid);
      updateAllCells();
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Kõik tähed on õigel kohal.'));
      else if (errorCells.size > 0) messageHost.append(renderMessage('error', 'Mõni märgitud ruut ei klapi lahendusega.'));
      else if (checkedOk) messageHost.append(renderMessage('info', 'Seni märgitud ruudud on õiged — jätka!'));
    }

    function renderHintHost() {
      clear(hintHost);
      if (hint) {
        hintHost.append(
          renderHintPanel({ title: hint.title, explanation: hint.explanation, primary: [], apply: applyHint }, applyHint, () => {
            hint = null;
            updateAllCells();
            renderHintHost();
          }),
        );
      }
    }

    clear(root);
    toolbar.append(toolbarButton('Vihje', showHint), toolbarButton('Kontrolli', checkBoard), toolbarButton('Uus mäng', showPicker));
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['⭐ Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = rulesHtml(stars);
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, rulesBox);
    buildBoard();
    renderStatus();
  }

  showPicker();

  return () => {};
}
