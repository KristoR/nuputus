import { el, clear, svgEl } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
import {
  OFF,
  ON,
  UNKNOWN,
  type Edge,
  type EdgeState,
  allEdges,
  edgeKey,
  emptyEdgeState,
  getEdge,
  setEdge,
} from './core';
import { generateSlitherlink } from './generate';
import { getSlitherlinkHint, type SlitherlinkDeduction } from './hints';

const RULES_HTML = `
  <p><strong>Eesmärk:</strong> tõmba jooni ruudustiku punktide vahele nii, et tekiks üks terviklik, katkematu müür (silmus).</p>
  <p>Numbrid ruutude sees näitavad, mitu selle ruudu neljast servast peab olema joonega kaetud.</p>
  <p>Puuduta serva, et selle olek muutuks: tühi → joon → rist (kindlasti tühi) → tühi. Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
`;

const CELL = 48;

export function mountSlitherlink(container: HTMLElement, setTitle: (t: string) => void): () => void {
  setTitle('Hiina müür');

  const root = el('div', { class: 'game-screen' });
  container.append(root);

  function showPicker() {
    clear(root);
    root.append(
      renderDifficultyPicker({
        gameTitle: 'Hiina müür',
        emoji: '🧱',
        rulesHtml: RULES_HTML,
        onStart: (d) => startGame(d),
      }),
    );
  }

  function startGame(difficulty: Difficulty) {
    const puzzle = generateSlitherlink(difficulty);
    const { n, clue, solution } = puzzle;
    const state: EdgeState = emptyEdgeState(n);
    let hint: SlitherlinkDeduction | null = null;
    let errorEdges = new Set<string>();
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});

    function onEdgeCount(): number {
      return allEdges(n).filter((e) => getEdge(state, e) === ON).length;
    }

    function renderStatus() {
      clear(statusLine);
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${onEdgeCount()} joont tõmmatud`]));
    }

    function cycle(e: Edge) {
      if (solved) return;
      const cur = getEdge(state, e);
      setEdge(state, e, cur === UNKNOWN ? ON : cur === ON ? OFF : UNKNOWN);
      errorEdges = new Set();
      hint = null;
      checkSolved();
      renderAll();
    }

    function checkSolved() {
      const complete = allEdges(n).every((e) => getEdge(state, e) !== UNKNOWN);
      if (!complete) return;
      const ok = allEdges(n).every((e) => getEdge(state, e) === getEdge(solution, e));
      if (ok) solved = true;
    }

    function checkBoard() {
      const bad = new Set<string>();
      for (const e of allEdges(n)) {
        const v = getEdge(state, e);
        if (v !== UNKNOWN && v !== getEdge(solution, e)) bad.add(edgeKey(e));
      }
      errorEdges = bad;
      renderAll();
    }

    function showHint() {
      if (solved) return;
      hint = getSlitherlinkHint(puzzle, state);
      renderAll();
    }

    function applyHint() {
      if (!hint) return;
      for (const a of hint.assignments) setEdge(state, a.edge, a.value);
      hint = null;
      errorEdges = new Set();
      checkSolved();
      renderAll();
    }

    function renderBoard() {
      clear(boardWrap);
      const size = n * CELL;
      const svg = svgEl('svg', { viewBox: `-6 -6 ${size + 12} ${size + 12}`, width: size, height: size });

      // clue numbers
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (clue[r][c] < 0) continue;
          const text = svgEl('text', {
            x: c * CELL + CELL / 2,
            y: r * CELL + CELL / 2 + 1,
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            'font-size': CELL * 0.42,
            fill: 'var(--ink)',
            'font-family': "'Iowan Old Style', Georgia, serif",
          });
          text.textContent = String(clue[r][c]);
          svg.append(text);
        }
      }

      // visible edge marks (line for ON, small cross for OFF)
      for (const e of allEdges(n)) {
        const v = getEdge(state, e);
        const [x1, y1, x2, y2] = edgeCoords(e);
        const isHinted = hint?.assignments.some((a) => a.edge[0] === e[0] && a.edge[1] === e[1] && a.edge[2] === e[2]);
        const isError = errorEdges.has(edgeKey(e));
        if (v === ON) {
          svg.append(
            svgEl('line', {
              x1,
              y1,
              x2,
              y2,
              stroke: isError ? 'var(--bad)' : isHinted ? '#c98a2b' : 'var(--ink)',
              'stroke-width': 5,
              'stroke-linecap': 'round',
            }),
          );
        } else if (v === OFF) {
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const s = 4.5;
          const color = isError ? 'var(--bad)' : isHinted ? '#c98a2b' : 'var(--ink-faint)';
          svg.append(svgEl('line', { x1: mx - s, y1: my - s, x2: mx + s, y2: my + s, stroke: color, 'stroke-width': 2 }));
          svg.append(svgEl('line', { x1: mx - s, y1: my + s, x2: mx + s, y2: my - s, stroke: color, 'stroke-width': 2 }));
        } else if (isHinted) {
          svg.append(
            svgEl('line', { x1, y1, x2, y2, stroke: '#c98a2b', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.4 }),
          );
        }
      }

      // dots at vertices
      for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
          svg.append(svgEl('circle', { cx: c * CELL, cy: r * CELL, r: 3, fill: 'var(--ink)' }));
        }
      }

      // invisible click catchers, topmost so taps always register
      for (const e of allEdges(n)) {
        const [x1, y1, x2, y2] = edgeCoords(e);
        const catcher = svgEl('line', {
          x1,
          y1,
          x2,
          y2,
          stroke: 'transparent',
          'stroke-width': 18,
        });
        catcher.style.cursor = 'pointer';
        catcher.addEventListener('click', () => cycle(e));
        svg.append(catcher);
      }

      boardWrap.append(svg);
    }

    function edgeCoords(e: Edge): [number, number, number, number] {
      if (e[0] === 'H') {
        const [, r, c] = e;
        return [c * CELL, r * CELL, (c + 1) * CELL, r * CELL];
      }
      const [, r, c] = e;
      return [c * CELL, r * CELL, c * CELL, (r + 1) * CELL];
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Müür on terviklik.'));
      else if (errorEdges.size > 0) messageHost.append(renderMessage('error', 'Mõni märgitud serv ei klapi lahendusega.'));
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
    rulesBox.append(el('summary', {}, ['🧱 Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, rulesBox);
    renderAll();
  }

  showPicker();

  return () => {};
}
