import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { cellKey } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { cloneBoard, isComplete, type Board } from './core';
import { generateSudoku } from './generate';
import { getSudokuHint, type SudokuDeduction } from './hints';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> täida iga rida, veerg ja 3×3 kast numbritega 1–9, iga number täpselt üks kord.</p>
  <p>Vali ruut ja sisesta number numbriklaviatuurilt. Antud (paksus kirjas) numbreid muuta ei saa.</p>
  <p>Kui jääd kinni, kasuta nuppu <strong>Vihje</strong> — see näitab, milline ruut on loogiliselt tuletatav ja miks.</p>
`;

export function mountSudoku(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Sudoku');

  let disposed = false;
  let disposeGame: (() => void) | null = null;
  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    disposeGame?.();
    disposeGame = null;
    clear(root);
    root.append(
      renderDifficultyPicker({
        gameTitle: 'Sudoku',
        emoji: '🔢',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty) {
    disposeGame?.();
    disposeGame = null;
    const puzzle = generateSudoku(difficulty);
    const givens = puzzle.givens;
    const solution = puzzle.solution;
    const current: Board = cloneBoard(givens);
    let selected: [number, number] | null = null;
    let hint: SudokuDeduction | null = null;
    let errorCells = new Set<string>();
    let solved = false;
    const startedAt = Date.now();
    let timerHandle: number | undefined;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});
    const padHost = el('div', {});

    function elapsedLabel(): string {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      const m = Math.floor(s / 60);
      const ss = s % 60;
      return `${m}:${ss.toString().padStart(2, '0')}`;
    }

    function renderStatus() {
      const filled = current.flat().filter((v) => v !== 0).length;
      clear(statusLine);
      statusLine.append(
        el('span', {}, [`${difficultyLabel(difficulty)} · ${filled}/81 täidetud`]),
        el('span', {}, [elapsedLabel()]),
      );
    }

    function renderBoard() {
      clear(boardWrap);
      const table = el('div', { class: 'sudoku-grid' });
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          const key = cellKey(r, c);
          const isGiven = givens[r][c] !== 0;
          const v = current[r][c];
          const classes = ['sudoku-cell'];
          if (isGiven) classes.push('given');
          if (r % 3 === 0) classes.push('edge-top');
          if (c % 3 === 0) classes.push('edge-left');
          if (r === 8) classes.push('edge-bottom');
          if (c === 8) classes.push('edge-right');
          if (r % 3 === 2 && r !== 8) classes.push('box-bottom');
          if (c % 3 === 2 && c !== 8) classes.push('box-right');
          if (selected && selected[0] === r && selected[1] === c) classes.push('selected');
          else if (selected && (selected[0] === r || selected[1] === c)) classes.push('peer');
          if (hint?.primary.some(([hr, hc]) => hr === r && hc === c)) classes.push('hint-primary');
          else if (hint?.secondary.some(([hr, hc]) => hr === r && hc === c)) classes.push('hint-secondary');
          if (errorCells.has(key)) classes.push('error');

          const cell = el('button', { class: classes.join(' '), 'data-key': key }, [v ? String(v) : '']);
          cell.addEventListener('click', () => {
            if (isGiven) return;
            selected = [r, c];
            hint = null;
            renderAll();
          });
          table.append(cell);
        }
      }
      boardWrap.append(table);
    }

    function renderPad() {
      clear(padHost);
      const pad = el('div', { class: 'numpad' });
      for (let v = 1; v <= 9; v++) {
        const b = el('button', { class: 'numpad-btn' }, [String(v)]);
        b.addEventListener('click', () => setValue(v));
        pad.append(b);
      }
      const eraseBtn = el('button', { class: 'numpad-btn erase' }, ['⌫']);
      eraseBtn.addEventListener('click', () => setValue(0));
      pad.append(eraseBtn);
      padHost.append(pad);
    }

    function setValue(v: number) {
      if (!selected) return;
      const [r, c] = selected;
      if (givens[r][c] !== 0) return;
      current[r][c] = v;
      errorCells = new Set();
      hint = null;
      checkSolved();
      renderAll();
    }

    function checkSolved() {
      if (isComplete(current)) {
        const ok = current.every((row, r) => row.every((v, c) => v === solution[r][c]));
        if (ok) {
          solved = true;
          window.clearInterval(timerHandle);
        }
      }
    }

    function checkBoard() {
      const bad = new Set<string>();
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (current[r][c] !== 0 && current[r][c] !== solution[r][c]) bad.add(cellKey(r, c));
        }
      }
      errorCells = bad;
      renderAll();
    }

    function showHint() {
      if (solved) return;
      hint = getSudokuHint(current, solution);
      renderAll();
    }

    function applyHint() {
      if (!hint) return;
      current[hint.r][hint.c] = hint.v;
      hint = null;
      errorCells = new Set();
      checkSolved();
      renderAll();
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) {
        messageHost.append(renderMessage('success', `Lahendatud! Aeg: ${elapsedLabel()}.`));
      } else if (errorCells.size > 0) {
        messageHost.append(renderMessage('error', 'Mõni ruut ei klapi — need on punasega märgitud.'));
      }
    }

    function renderHintHost() {
      clear(hintHost);
      if (hint) {
        hintHost.append(
          renderHintPanel(
            { title: hint.title, explanation: hint.explanation, primary: [], apply: applyHint },
            applyHint,
            () => {
              hint = null;
              renderAll();
            },
          ),
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
    toolbar.append(
      toolbarButton('Vihje', showHint),
      toolbarButton('Kontrolli', checkBoard),
      toolbarButton('Uus mäng', showPicker),
    );
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['🔢 Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, padHost, rulesBox);
    renderPad();
    renderAll();

    timerHandle = window.setInterval(() => {
      if (!disposed && !solved) renderStatus();
    }, 1000);

    const keyHandler = (e: KeyboardEvent) => {
      if (!selected) return;
      const [r, c] = selected;
      if (e.key >= '1' && e.key <= '9') setValue(Number(e.key));
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') setValue(0);
      else if (e.key === 'ArrowUp') selected = [Math.max(0, r - 1), c];
      else if (e.key === 'ArrowDown') selected = [Math.min(8, r + 1), c];
      else if (e.key === 'ArrowLeft') selected = [r, Math.max(0, c - 1)];
      else if (e.key === 'ArrowRight') selected = [r, Math.min(8, c + 1)];
      else return;
      e.preventDefault();
      renderAll();
    };
    window.addEventListener('keydown', keyHandler);

    disposeGame = () => {
      window.clearInterval(timerHandle);
      window.removeEventListener('keydown', keyHandler);
    };
  }

  showPicker();

  return () => {
    disposed = true;
    disposeGame?.();
  };
}
