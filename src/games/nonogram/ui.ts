import { el, clear } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { clearGame, loadGame, saveGame } from '../../lib/persist';
import { EMPTY, FILLED, UNKNOWN, emptyGrid, getCol, getRow, runsOf, sameClue, type Grid, type NonogramPuzzle } from './core';
import { generateNonogram } from './generate';
import { getNonogramHint, type NonogramDeduction } from './hints';

const GAME_ID = 'nonogram';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> värvi ruudud mustaks nii, et välja ilmub pilt.</p>
  <p>Numbrid rea ees ja veeru kohal ütlevad, mitu järjestikust musta ruutu seal on ja mis järjekorras. Näiteks <strong>3 1</strong> tähendab: kõigepealt 3 musta ruutu järjest, siis vähemalt üks tühi, siis 1 must.</p>
  <p>Vali all tööriist: <strong>■ Must</strong> või <strong>• Tühi</strong>. Puuduta ruutu või vea sõrmega üle mitme ruudu korraga. Hiirega paremklõps märgib tühja ruudu. Kui rida on õigesti täidetud, muutub selle vihje halliks.</p>
`;

export function mountNonogram(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Jaapani mõistatus');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    root.append(
      renderDifficultyPicker({
        prefKey: GAME_ID,
        gameTitle: 'Jaapani mõistatus',
        emoji: '🖼️',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty, resume?: { puzzle: NonogramPuzzle; state: Grid }) {
    const puzzle = resume?.puzzle ?? generateNonogram(difficulty);
    const { rows, cols, rowClues, colClues, solution } = puzzle;
    const state: Grid = resume?.state ?? emptyGrid(rows, cols);
    let tool: number = FILLED;
    let hint: NonogramDeduction | null = null;
    let hintIsError = false;
    let errorCells = new Set<string>();
    let checkedOk = false;
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const toolRow = el('div', { class: 'difficulty-row nonogram-tools' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});
    const cellEls: HTMLDivElement[][] = [];
    const rowClueEls: HTMLDivElement[] = [];
    const colClueEls: HTMLDivElement[] = [];

    function renderStatus() {
      clear(statusLine);
      const total = solution.flat().filter((v) => v === FILLED).length;
      const placed = state.flat().filter((v) => v === FILLED).length;
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${rows}×${cols} · ${placed}/${total} musta`]));
    }

    function persist() {
      if (solved) clearGame(GAME_ID);
      else saveGame(GAME_ID, { difficulty, puzzle, state });
    }

    /** Solved once the filled cells match the picture — dots are just an aid. */
    function checkSolved() {
      if (state.every((row, r) => row.every((v, c) => (v === FILLED) === (solution[r][c] === FILLED)))) solved = true;
    }

    function computeErrors(): Set<string> {
      const bad = new Set<string>();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (state[r][c] !== UNKNOWN && state[r][c] !== solution[r][c]) bad.add(`${r},${c}`);
        }
      }
      return bad;
    }

    function updateCell(r: number, c: number) {
      const v = state[r][c];
      const classes = ['nonogram-cell'];
      if (v === FILLED) classes.push('filled');
      if (v === EMPTY) classes.push('dot');
      if (c === cols - 1) classes.push('edge-right');
      else if (c % 5 === 4) classes.push('thick-right');
      if (r === rows - 1) classes.push('edge-bottom');
      else if (r % 5 === 4) classes.push('thick-bottom');
      if (hint?.assignments.some((a) => a.r === r && a.c === c)) classes.push('hint-primary');
      if (errorCells.has(`${r},${c}`)) classes.push('error');
      if (solved) classes.push('solved');
      cellEls[r][c].className = classes.join(' ');
    }

    function updateClues() {
      for (let r = 0; r < rows; r++) rowClueEls[r].classList.toggle('done', sameClue(runsOf(getRow(state, r)), rowClues[r]));
      for (let c = 0; c < cols; c++) colClueEls[c].classList.toggle('done', sameClue(runsOf(getCol(state, c)), colClues[c]));
    }

    function updateAll() {
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) updateCell(r, c);
      updateClues();
    }

    /** After any change to the board: drop stale hint/check results and refresh everything once. */
    function afterChange() {
      errorCells = new Set();
      checkedOk = false;
      hint = null;
      checkSolved();
      persist();
      updateAll();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    // ---- Painting: press on a cell, drag along its row or column. ----
    // The first cell decides the action: if it already has the tool's mark
    // the drag erases that mark, otherwise it paints the mark onto cells
    // that are still blank (never overwriting the other kind of mark).
    let drag: { value: number; mark: number; r0: number; c0: number; axis: 'row' | 'col' | null; pointerId: number } | null = null;

    function paint(r: number, c: number) {
      if (!drag) return;
      const v = state[r][c];
      if (drag.value === UNKNOWN ? v === drag.mark : v === UNKNOWN) {
        state[r][c] = drag.value;
        updateCell(r, c);
      }
    }

    function cellAt(x: number, y: number): [number, number] | null {
      const target = document.elementFromPoint(x, y) as HTMLElement | null;
      if (!target?.dataset?.r) return null;
      return [Number(target.dataset.r), Number(target.dataset.c)];
    }

    function onPointerDown(e: PointerEvent) {
      if (solved) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault();
      const [r, c] = hit;
      const mark = e.button === 2 ? EMPTY : tool;
      drag = { value: state[r][c] === mark ? UNKNOWN : mark, mark, r0: r, c0: c, axis: null, pointerId: e.pointerId };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      paint(r, c);
    }

    function onPointerMove(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (!hit) return;
      let [r, c] = hit;
      if (!drag.axis) {
        if (r === drag.r0 && c === drag.c0) return;
        drag.axis = Math.abs(r - drag.r0) > Math.abs(c - drag.c0) ? 'col' : 'row';
      }
      if (drag.axis === 'row') r = drag.r0;
      else c = drag.c0;
      // Fill every cell between the start and here, so a fast swipe that
      // skips over cells between pointer events doesn't leave gaps.
      if (drag.axis === 'row') for (let cc = Math.min(c, drag.c0); cc <= Math.max(c, drag.c0); cc++) paint(r, cc);
      else for (let rr = Math.min(r, drag.r0); rr <= Math.max(r, drag.r0); rr++) paint(rr, c);
    }

    function onPointerUp(e: PointerEvent) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      drag = null;
      afterChange();
    }

    function showHint() {
      if (solved) return;
      if (computeErrors().size > 0) {
        hintIsError = true;
        hint = {
          title: 'Midagi on praegu valesti',
          explanation: 'Osa juba märgitud ruutudest ei klapi õige lahendusega, seega ei saa neist veel edasi vihjata.',
          assignments: [],
        };
      } else {
        hintIsError = false;
        hint = getNonogramHint(puzzle, state);
      }
      updateAll();
      renderHintHost();
    }

    function applyHint() {
      if (!hint) return;
      for (const a of hint.assignments) state[a.r][a.c] = a.value;
      afterChange();
    }

    function checkBoard() {
      checkSolved();
      errorCells = computeErrors();
      checkedOk = errorCells.size === 0 && !solved;
      updateAll();
      renderMessages();
    }

    function revealErrors() {
      hint = null;
      checkBoard();
      renderHintHost();
    }

    function renderHintHost() {
      clear(hintHost);
      if (!hint) return;
      const onApply = hintIsError ? revealErrors : applyHint;
      hintHost.append(
        renderHintPanel(
          { title: hint.title, explanation: hint.explanation, primary: [], apply: onApply },
          onApply,
          () => {
            hint = null;
            updateAll();
            renderHintHost();
          },
          hintIsError ? { applyLabel: 'Näita, mis on valesti', kind: 'error' } : {},
        ),
      );
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Pilt on valmis.'));
      else if (errorCells.size > 0) messageHost.append(renderMessage('error', 'Mõni märgitud ruut ei klapi lahendusega.'));
      else if (checkedOk) messageHost.append(renderMessage('info', 'Seni märgitud ruudud on õiged — jätka!'));
    }

    function renderTools() {
      clear(toolRow);
      for (const [value, label] of [
        [FILLED, '■ Must'],
        [EMPTY, '• Tühi'],
      ] as [number, string][]) {
        const btn = el('button', { class: `pill-btn${tool === value ? ' active' : ''}` }, [label]);
        btn.addEventListener('click', () => {
          tool = value;
          renderTools();
        });
        toolRow.append(btn);
      }
    }

    function buildBoard() {
      clear(boardWrap);
      const maxRowClue = Math.max(1, ...rowClues.map((c) => c.length));
      const maxColClue = Math.max(1, ...colClues.map((c) => c.length));
      const grid = el('div', { class: 'nonogram-grid' });
      grid.style.setProperty('--units', String(cols + maxRowClue));
      grid.style.setProperty('--board-cols', String(cols));
      grid.style.setProperty('--board-rows', String(rows));
      grid.style.setProperty('--clue-cols', String(maxRowClue));
      grid.style.setProperty('--clue-rows', String(maxColClue));

      grid.append(el('div', { class: 'nonogram-corner' }));
      for (let c = 0; c < cols; c++) {
        const clue = colClues[c].length ? colClues[c] : [0];
        const box = el('div', { class: `nonogram-colclue${c % 2 ? ' alt' : ''}${c % 5 === 4 && c !== cols - 1 ? ' thick-right' : ''}` },
          clue.map((v) => el('span', {}, [String(v)])));
        colClueEls[c] = box;
        grid.append(box);
      }
      for (let r = 0; r < rows; r++) {
        const clue = rowClues[r].length ? rowClues[r] : [0];
        const box = el('div', { class: `nonogram-rowclue${r % 2 ? ' alt' : ''}${r % 5 === 4 && r !== rows - 1 ? ' thick-bottom' : ''}` },
          clue.map((v) => el('span', {}, [String(v)])));
        rowClueEls[r] = box;
        grid.append(box);
        cellEls[r] = [];
        for (let c = 0; c < cols; c++) {
          const cell = el('div', { class: 'nonogram-cell', 'data-r': String(r), 'data-c': String(c) });
          cellEls[r][c] = cell;
          grid.append(cell);
        }
      }

      grid.addEventListener('pointerdown', onPointerDown);
      grid.addEventListener('pointermove', onPointerMove);
      grid.addEventListener('pointerup', onPointerUp);
      grid.addEventListener('pointercancel', onPointerUp);
      grid.addEventListener('contextmenu', (e) => e.preventDefault());
      boardWrap.append(grid);
      updateAll();
    }

    clear(root);
    toolbar.append(
      toolbarButton('Vihje', showHint),
      toolbarButton('Kontrolli', checkBoard),
      toolbarButton('Uus mäng', () => {
        clearGame(GAME_ID);
        showPicker();
      }),
    );
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['🖼️ Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, toolRow, hintHost, messageHost, rulesBox);
    renderTools();
    buildBoard();
    checkSolved();
    renderStatus();
    renderMessages();
  }

  const saved = loadGame<NonogramPuzzle, Grid, Difficulty>(GAME_ID);
  if (saved) startGame(saved.difficulty, { puzzle: saved.puzzle, state: saved.state });
  else showPicker();

  return () => {};
}
