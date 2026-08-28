import { el, clear, svgEl } from '../../lib/dom';
import type { Difficulty } from '../../lib/types';
import { attachPrimarySecondary, difficultyLabel, renderDifficultyPicker, renderHintPanel, renderMessage, toolbarButton } from '../../lib/ui-helpers';
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
  <p>Puuduta serva, et sinna tuleks joon. Hoia all (või paremklõpsa hiirega), et märkida serv kindlasti tühjaks (rist). Kasuta <strong>Vihjet</strong>, kui jääd kinni.</p>
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
    let checkedOk = false;
    let solved = false;

    const toolbar = el('div', { class: 'toolbar' });
    const statusLine = el('div', { class: 'status-line' });
    const boardWrap = el('div', { class: 'board-wrap' });
    const hintHost = el('div', {});
    const messageHost = el('div', {});
    const edgeVisuals = new Map<string, SVGGElement>();

    function onEdgeCount(): number {
      return allEdges(n).filter((e) => getEdge(state, e) === ON).length;
    }

    function renderStatus() {
      clear(statusLine);
      statusLine.append(el('span', {}, [`${difficultyLabel(difficulty)} · ${onEdgeCount()} joont tõmmatud`]));
    }

    function setEdgeValue(e: Edge, value: number) {
      if (solved) return;
      setEdge(state, e, value);
      errorEdges = new Set();
      checkedOk = false;
      hint = null;
      checkSolved();
      updateAllEdges();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    function togglePrimary(e: Edge) {
      setEdgeValue(e, getEdge(state, e) === ON ? UNKNOWN : ON);
    }

    function toggleSecondary(e: Edge) {
      setEdgeValue(e, getEdge(state, e) === OFF ? UNKNOWN : OFF);
    }

    /** Solved once the drawn lines exactly match the solution — X marks are just an optional aid. */
    function checkSolved() {
      const ok = allEdges(n).every((e) => (getEdge(state, e) === ON) === (getEdge(solution, e) === ON));
      if (ok) solved = true;
    }

    function checkBoard() {
      checkSolved();
      const bad = new Set<string>();
      for (const e of allEdges(n)) {
        const v = getEdge(state, e);
        if (v !== UNKNOWN && v !== getEdge(solution, e)) bad.add(edgeKey(e));
      }
      errorEdges = bad;
      checkedOk = bad.size === 0 && !solved;
      updateAllEdges();
      renderMessages();
    }

    function showHint() {
      if (solved) return;
      hint = getSlitherlinkHint(puzzle, state);
      updateAllEdges();
      renderHintHost();
    }

    function applyHint() {
      if (!hint) return;
      for (const a of hint.assignments) setEdge(state, a.edge, a.value);
      hint = null;
      errorEdges = new Set();
      checkedOk = false;
      checkSolved();
      updateAllEdges();
      renderStatus();
      renderHintHost();
      renderMessages();
    }

    function edgeCoords(e: Edge): [number, number, number, number] {
      if (e[0] === 'H') {
        const [, r, c] = e;
        return [c * CELL, r * CELL, (c + 1) * CELL, r * CELL];
      }
      const [, r, c] = e;
      return [c * CELL, r * CELL, c * CELL, (r + 1) * CELL];
    }

    function updateEdge(e: Edge) {
      const group = edgeVisuals.get(edgeKey(e))!;
      clear(group);
      const v = getEdge(state, e);
      const [x1, y1, x2, y2] = edgeCoords(e);
      const isHinted = hint?.assignments.some((a) => a.edge[0] === e[0] && a.edge[1] === e[1] && a.edge[2] === e[2]);
      const isError = errorEdges.has(edgeKey(e));
      if (v === ON) {
        group.append(
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
        group.append(svgEl('line', { x1: mx - s, y1: my - s, x2: mx + s, y2: my + s, stroke: color, 'stroke-width': 2 }));
        group.append(svgEl('line', { x1: mx - s, y1: my + s, x2: mx + s, y2: my - s, stroke: color, 'stroke-width': 2 }));
      } else if (isHinted) {
        group.append(
          svgEl('line', { x1, y1, x2, y2, stroke: '#c98a2b', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.4 }),
        );
      }
    }

    function updateAllEdges() {
      for (const e of allEdges(n)) updateEdge(e);
    }

    function buildBoard() {
      clear(boardWrap);
      const size = n * CELL;
      const svg = svgEl('svg', { viewBox: `-6 -6 ${size + 12} ${size + 12}`, width: size, height: size });

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

      for (const e of allEdges(n)) {
        const group = svgEl('g', {});
        edgeVisuals.set(edgeKey(e), group);
        svg.append(group);
      }

      for (let r = 0; r <= n; r++) {
        for (let c = 0; c <= n; c++) {
          svg.append(svgEl('circle', { cx: c * CELL, cy: r * CELL, r: 3, fill: 'var(--ink)' }));
        }
      }

      // invisible click/touch catchers, topmost so taps always register
      for (const e of allEdges(n)) {
        const [x1, y1, x2, y2] = edgeCoords(e);
        const catcher = svgEl('line', { x1, y1, x2, y2, stroke: 'transparent', 'stroke-width': 18 });
        catcher.style.cursor = 'pointer';
        attachPrimarySecondary(
          catcher,
          () => togglePrimary(e),
          () => toggleSecondary(e),
        );
        svg.append(catcher);
      }

      boardWrap.append(svg);
      updateAllEdges();
    }

    function renderMessages() {
      clear(messageHost);
      if (solved) messageHost.append(renderMessage('success', 'Lahendatud! Müür on terviklik.'));
      else if (errorEdges.size > 0) messageHost.append(renderMessage('error', 'Mõni märgitud serv ei klapi lahendusega.'));
      else if (checkedOk) messageHost.append(renderMessage('info', 'Seni märgitud servad on õiged — jätka!'));
    }

    function renderHintHost() {
      clear(hintHost);
      if (hint) {
        hintHost.append(
          renderHintPanel({ title: hint.title, explanation: hint.explanation, primary: [], apply: applyHint }, applyHint, () => {
            hint = null;
            updateAllEdges();
            renderHintHost();
          }),
        );
      }
    }

    clear(root);
    toolbar.append(toolbarButton('Vihje', showHint), toolbarButton('Kontrolli', checkBoard), toolbarButton('Uus mäng', showPicker));
    const rulesBox = el('details', { class: 'rules-box' });
    rulesBox.append(el('summary', {}, ['🧱 Reeglid']));
    const rulesBody = el('div', {});
    rulesBody.innerHTML = RULES_HTML;
    rulesBox.append(rulesBody);

    root.append(toolbar, statusLine, boardWrap, hintHost, messageHost, rulesBox);
    buildBoard();
    renderStatus();
  }

  showPicker();

  return () => {};
}
