import { el, clear } from '../../lib/dom';
import type { Level } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import { clearGame, loadGame, loadPref, savePref, saveGame } from '../../lib/persist';
import { attachBrush, renderToolToggle } from '../../lib/paint';
import { EMPTY, STAR, UNKNOWN, emptyPlay, type PlayState, type StarBattlePuzzle } from './core';
import { generateStarBattleAsync, type StarCount } from './generate';
import { getStarBattleHint, type StarBattleDeduction } from './hints';

const GAME_ID = 'starbattle';
const LEVELS: Level[] = ['lihtne', 'keskmine', 'raske', 'ekspert'];

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
    <p>Vali all tööriist: <strong>⭐ Täht</strong> või <strong>× Tühi</strong>. Tühja tööriistaga saab sõrme lohistades märkida mitu ruutu korraga. Pikk vajutus (või paremklõps, või Shift) kasutab teist tööriista. Klaviatuuril vahetab tööriista tühik või X. Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
  `;
}

const PALETTE = ['#e7d9c4', '#d8e3d3', '#dbe0ea', '#ecd9df', '#e0e6c8', '#dde3ec', '#ecdccb', '#d6e6e2', '#e5dcec', '#e9e0cf'];

export function mountStarBattle(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Tähesõda');

  const root = el('div', { class: 'game-screen' });
  container.append(root);
  let disposeTools: (() => void) | null = null;

  function showPicker() {
    disposeTools?.();
    disposeTools = null;
    clear(root);
    let stars: StarCount = loadPref(GAME_ID + ':stars') === '1' ? 1 : 2;

    const starButtons = ([1, 2] as StarCount[]).map((s) => {
      const btn = el('button', { class: `pill-btn${s === stars ? ' active' : ''}` }, [
        s === 1 ? '⭐ 1 täht' : '⭐⭐ 2 tähte',
      ]);
      btn.addEventListener('click', () => {
        stars = s;
        savePref(GAME_ID + ':stars', String(s));
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
        levels: LEVELS,
        initial: 'ekspert',
        prefKey: GAME_ID,
        extra: starRow,
        onStart: (d) => startGame(d, stars),
      }),
    );
  }

  let generation = 0;

  function startGame(difficulty: Level, starCount: StarCount) {
    // Harder tiers search through several candidates for a hard enough one
    // (several seconds on a phone); show progress, and ignore the result if
    // the player has left this screen in the meantime.
    clear(root);
    const loading = el('p', { class: 'rules-box' }, ['Genereerin mõistatust...']);
    root.append(loading);
    const myGeneration = ++generation;
    window.setTimeout(async () => {
      const puzzle = await generateStarBattleAsync(difficulty, starCount, (tried) => {
        loading.textContent = `Otsin piisavalt rasket mõistatust... (${tried} kandidaati läbi vaadatud)`;
      });
      if (myGeneration === generation) buildGame(puzzle, difficulty);
    }, 10);
  }

  function buildGame(puzzle: StarBattlePuzzle, difficulty: Level, resumeState?: PlayState) {
    const { n, stars, regions, solution } = puzzle;
    const state: PlayState = resumeState ?? emptyPlay(n);
    let hint: StarBattleDeduction | null = null;
    let hintIsError = false;
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

    function persist() {
      if (solved) clearGame(GAME_ID);
      else saveGame(GAME_ID, { difficulty, puzzle, state });
    }

    let tool = STAR;

    /** After a gesture changed the board: drop stale hint/check results and refresh once. */
    function afterChange() {
      errorCells = new Set();
      checkedOk = false;
      hint = null;
      checkSolved();
      persist();
      updateAllCells();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    /** Solved once every star matches the solution — X marks are just an optional aid. */
    function checkSolved() {
      const ok = state.every((row, r) => row.every((v, c) => (v === STAR) === (solution[r][c] === STAR)));
      if (ok) solved = true;
    }

    function computeErrors(): Set<string> {
      const bad = new Set<string>();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (state[r][c] !== UNKNOWN && state[r][c] !== solution[r][c]) bad.add(`${r},${c}`);
        }
      }
      return bad;
    }

    function checkBoard() {
      checkSolved();
      errorCells = computeErrors();
      checkedOk = errorCells.size === 0 && !solved;
      updateAllCells();
      renderMessages();
    }

    function showHint() {
      if (solved) return;
      // A hint reasons forward from the board as it stands, so if something
      // already on the board is wrong, check that first rather than build
      // a "logical" hint on top of a mistake.
      if (computeErrors().size > 0) {
        hintIsError = true;
        hint = {
          title: 'Midagi on praegu valesti',
          explanation: 'Osa juba lauale märgitud ruutudest ei klapi õige lahendusega, seega ei saa neist veel edasi vihjata.',
          assignments: [],
        };
      } else {
        hintIsError = false;
        hint = getStarBattleHint(puzzle, state);
      }
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
      persist();
      updateAllCells();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    function revealErrors() {
      hint = null;
      checkBoard();
      renderHintHost();
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
          const cell = el('button', {
            class: 'starbattle-cell',
            style: `background:${PALETTE[region % PALETTE.length]}`,
            'data-r': String(r),
            'data-c': String(c),
          });
          cellEls[r][c] = cell;
          grid.append(cell);
        }
      }
      attachBrush({
        grid,
        get: (r, c) => state[r][c],
        set: (r, c, v) => {
          state[r][c] = v;
          updateCell(r, c);
        },
        tool: () => tool,
        opposite: (m) => (m === STAR ? EMPTY : STAR),
        // Stars can never touch, so only × marks spread along a drag.
        canDrag: (m) => m === EMPTY,
        locked: () => solved,
        onCommit: afterChange,
      });
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
        const onApply = hintIsError ? revealErrors : applyHint;
        hintHost.append(
          renderHintPanel(
            { title: hint.title, explanation: hint.explanation, primary: [], apply: onApply },
            onApply,
            () => {
              hint = null;
              updateAllCells();
              renderHintHost();
            },
            hintIsError ? { applyLabel: 'Näita, mis on valesti', kind: 'error' } : {},
          ),
        );
      }
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
    rulesBox.append(el('summary', {}, ['⭐ Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = rulesHtml(stars);
    rulesBox.append(rulesBody);

    disposeTools?.();
    const tools = renderToolToggle({
      tools: [
        { value: STAR, label: '⭐ Täht' },
        { value: EMPTY, label: '× Tühi' },
      ],
      get: () => tool,
      set: (v) => {
        tool = v;
      },
    });
    disposeTools = tools.dispose;

    root.append(toolbar, statusLine, boardWrap, tools.element, hintHost, messageHost, rulesBox);
    buildBoard();
    renderStatus();
  }

  const saved = loadGame<StarBattlePuzzle, PlayState>(GAME_ID);
  if (saved) buildGame(saved.puzzle, saved.difficulty, saved.state);
  else showPicker();

  return () => {
    generation++;
    disposeTools?.();
  };
}
