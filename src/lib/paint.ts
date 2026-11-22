import { el, clear } from './dom';

/**
 * Shared "brush" input for grid games where each cell is blank (0) or
 * carries one of two marks (e.g. filled / dot, star / ×).
 *
 * - A press uses the selected tool; the tool's mark toggles on that cell.
 * - Dragging paints the same action onto further cells: if the first
 *   cell got the mark, blank cells along the way get it too; if the first
 *   cell lost it, cells along the way with that mark are cleared. Cells
 *   holding the other mark are left alone.
 * - The opposite tool, for a single gesture: long press (touch/pen),
 *   right mouse button, or holding Shift. Long press then drag paints
 *   the opposite mark along the drag.
 */
export interface BrushOptions {
  grid: HTMLElement;
  /** 0 = blank. */
  get: (r: number, c: number) => number;
  /** Sets a cell and refreshes just that cell's visuals. */
  set: (r: number, c: number, value: number) => void;
  /** The currently selected tool's mark. */
  tool: () => number;
  /** The other mark (what long press / right click / Shift uses). */
  opposite: (mark: number) => number;
  /** Whether dragging may spread this mark (e.g. stars can't sit next to each other, so no). */
  canDrag?: (mark: number) => boolean;
  /** Lock a drag to the starting row or column (nonogram style). */
  axisLock?: boolean;
  /** Ignore input, e.g. once solved. */
  locked?: () => boolean;
  /** Called once when a gesture ends and something may have changed. */
  onCommit: () => void;
}

const LONG_PRESS_MS = 450;
const BLANK = 0;

export function attachBrush(opts: BrushOptions): void {
  const { grid } = opts;
  type Drag = {
    pointerId: number;
    mark: number;
    value: number;
    r0: number;
    c0: number;
    orig: number;
    last: [number, number];
    axis: 'row' | 'col' | null;
    moved: boolean;
    timer: number | undefined;
  };
  let drag: Drag | null = null;

  function cellAt(x: number, y: number): [number, number] | null {
    const target = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = target?.closest<HTMLElement>('[data-r]');
    if (!cell || !grid.contains(cell)) return null;
    return [Number(cell.dataset.r), Number(cell.dataset.c)];
  }

  function begin(d: Drag, mark: number) {
    d.mark = mark;
    d.value = d.orig === mark ? BLANK : mark;
    // The pressed cell always gets the action, even over the other mark.
    opts.set(d.r0, d.c0, d.value);
  }

  /** Applies the drag's action to one cell passed over (not the first one). */
  function paint(d: Drag, r: number, c: number) {
    if (r === d.r0 && c === d.c0) return;
    const v = opts.get(r, c);
    if (d.value === BLANK ? v === d.mark : v === BLANK) opts.set(r, c, d.value);
  }

  function stopTimer(d: Drag) {
    if (d.timer !== undefined) window.clearTimeout(d.timer);
    d.timer = undefined;
  }

  grid.addEventListener('pointerdown', (e) => {
    if (opts.locked?.() || drag) return;
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    const [r, c] = hit;
    const useOpposite = e.button === 2 || e.shiftKey;
    const tool = opts.tool();
    const d: Drag = {
      pointerId: e.pointerId,
      mark: tool,
      value: BLANK,
      r0: r,
      c0: c,
      orig: opts.get(r, c),
      last: [r, c],
      axis: null,
      moved: false,
      timer: undefined,
    };
    drag = d;
    try {
      grid.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    begin(d, useOpposite ? opts.opposite(tool) : tool);

    if (e.pointerType !== 'mouse' && !useOpposite) {
      d.timer = window.setTimeout(() => {
        d.timer = undefined;
        if (drag !== d || d.moved) return;
        // Undo the tap's action and switch this gesture to the other tool.
        opts.set(d.r0, d.c0, d.orig);
        begin(d, opts.opposite(tool));
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    }
  });

  grid.addEventListener('pointermove', (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit) return;
    let [r, c] = hit;
    if (r === d.last[0] && c === d.last[1]) return;
    d.moved = true;
    stopTimer(d);
    if (opts.canDrag && !opts.canDrag(d.mark)) return;

    if (opts.axisLock) {
      if (!d.axis) d.axis = Math.abs(r - d.r0) > Math.abs(c - d.c0) ? 'col' : 'row';
      if (d.axis === 'row') r = d.r0;
      else c = d.c0;
    }
    // Walk from the previous cell to this one so a fast swipe that skips
    // cells between pointer events still paints every cell it crossed.
    const [lr, lc] = d.last;
    const steps = Math.max(Math.abs(r - lr), Math.abs(c - lc));
    for (let i = 1; i <= steps; i++) {
      paint(d, Math.round(lr + ((r - lr) * i) / steps), Math.round(lc + ((c - lc) * i) / steps));
    }
    d.last = [r, c];
  });

  const end = (e: PointerEvent) => {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId) return;
    stopTimer(d);
    drag = null;
    opts.onCommit();
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
  grid.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Two-button tool picker plus a keyboard shortcut (Space or X) to flip
 * between the tools, for iPad/desktop keyboards. Returns the row element
 * and a cleanup that removes the key listener.
 */
export function renderToolToggle(opts: {
  tools: { value: number; label: string }[];
  get: () => number;
  set: (value: number) => void;
}): { element: HTMLElement; dispose: () => void } {
  const row = el('div', { class: 'difficulty-row brush-tools' });
  const wrap = el('div', { class: 'brush-toolbar' }, [
    row,
    el('p', { class: 'brush-tip' }, ['Pikk vajutus kasutab teist tööriista. Klaviatuuril vahetab tööriista tühik või X.']),
  ]);

  function render() {
    clear(row);
    for (const t of opts.tools) {
      const btn = el('button', { class: `pill-btn${opts.get() === t.value ? ' active' : ''}` }, [t.label]);
      btn.addEventListener('click', () => {
        opts.set(t.value);
        render();
      });
      row.append(btn);
    }
  }

  function toggle() {
    const i = opts.tools.findIndex((t) => t.value === opts.get());
    opts.set(opts.tools[(i + 1) % opts.tools.length].value);
    render();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      toggle();
    }
  };
  window.addEventListener('keydown', onKey);
  render();
  return { element: wrap, dispose: () => window.removeEventListener('keydown', onKey) };
}
