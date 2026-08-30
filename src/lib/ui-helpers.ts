import { el } from './dom';
import type { Difficulty, HintStep } from './types';
import { DIFFICULTIES } from './types';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  lihtne: 'Lihtne',
  keskmine: 'Keskmine',
  raske: 'Raske',
};

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_LABEL[d];
}

export function renderDifficultyPicker(opts: {
  gameTitle: string;
  emoji: string;
  rulesHtml: string;
  onStart: (d: Difficulty) => void;
  initial?: Difficulty;
}): HTMLElement {
  let selected: Difficulty = opts.initial ?? 'lihtne';

  const pills = DIFFICULTIES.map((d) => {
    const btn = el('button', { class: `pill-btn${d === selected ? ' active' : ''}` }, [
      difficultyLabel(d),
    ]);
    btn.addEventListener('click', () => {
      selected = d;
      wrap.querySelectorAll('.pill-btn').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
    });
    return btn;
  });

  const startBtn = el('button', { class: 'primary-btn' }, ['Alusta mängu']);
  startBtn.addEventListener('click', () => opts.onStart(selected));

  const rulesBox = el('details', { class: 'rules-box' });
  rulesBox.append(el('summary', {}, [`${opts.emoji} Kuidas mängida`]));
  const rulesBody = el('div', { class: 'rules-body' });
  rulesBody.innerHTML = opts.rulesHtml;
  rulesBox.append(rulesBody);

  const wrap = el('div', { class: 'difficulty-screen' }, [
    el('h2', {}, [`${opts.emoji} ${opts.gameTitle}`]),
    el('p', { style: 'color: var(--ink-dim); font-family: system-ui, sans-serif;' }, [
      'Vali raskusaste ja alusta.',
    ]),
    el('div', { class: 'difficulty-row' }, pills),
    startBtn,
    rulesBox,
  ]);
  return wrap;
}

export function renderHintPanel(
  hint: HintStep,
  onApply: (() => void) | null,
  onDismiss: () => void,
): HTMLElement {
  const buttons: HTMLElement[] = [];
  if (onApply) {
    const applyBtn = el('button', { class: 'primary-btn' }, ['Täida ära']);
    applyBtn.addEventListener('click', onApply);
    buttons.push(applyBtn);
  }
  const dismissBtn = el('button', { class: 'secondary-btn' }, ['Selge']);
  dismissBtn.addEventListener('click', onDismiss);
  buttons.push(dismissBtn);

  return el('div', { class: 'hint-panel' }, [
    el('h4', {}, [hint.title]),
    el('p', {}, [hint.explanation]),
    el('div', { class: 'hint-actions' }, buttons),
  ]);
}

export function renderMessage(kind: 'success' | 'error' | 'info', text: string): HTMLElement {
  return el('div', { class: `message-banner ${kind}` }, [text]);
}

export function toolbarButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const btn = el('button', { class: 'secondary-btn' }, [label]);
  if (disabled) btn.setAttribute('disabled', 'true');
  btn.addEventListener('click', onClick);
  return btn;
}

/**
 * Wires up a cell/edge for two distinct marks instead of one shared cycle:
 * a tap/left-click for the "primary" mark (star, tent, ship, line, ...) and
 * a right-click (desktop) or long-press (touch) for the "secondary" mark
 * (definitely-empty, grass, water, definitely-no-line). This means placing
 * either mark is always exactly one interaction, never a multi-step cycle.
 */
export function attachPrimarySecondary(
  target: HTMLElement | SVGElement,
  onPrimary: () => void,
  onSecondary: () => void,
): void {
  let longPressFired = false;
  let moved = false;
  let startX = 0;
  let startY = 0;
  let timer: number | undefined;
  const MOVE_TOLERANCE = 10;

  const clearTimer = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };

  // Taps are handled entirely by hand on touch (touchend calls onPrimary
  // directly) rather than relying on the browser's synthetic click, because
  // preventDefault on touchstart — needed below to stop Android's native
  // long-press gesture — also suppresses that synthetic click. Without our
  // own tap handling, a plain short tap would stop doing anything.
  target.addEventListener(
    'touchstart',
    (evt: Event) => {
      const e = evt as TouchEvent;
      e.preventDefault();
      longPressFired = false;
      moved = false;
      clearTimer();
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      timer = window.setTimeout(() => {
        longPressFired = true;
        onSecondary();
      }, 450);
    },
    { passive: false },
  );

  target.addEventListener(
    'touchmove',
    (evt: Event) => {
      const e = evt as TouchEvent;
      const t = e.touches[0];
      if (!t) return;
      if (Math.abs(t.clientX - startX) > MOVE_TOLERANCE || Math.abs(t.clientY - startY) > MOVE_TOLERANCE) {
        moved = true;
        clearTimer();
      }
    },
    { passive: true },
  );

  target.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      clearTimer();
      if (!longPressFired && !moved) onPrimary();
      longPressFired = false;
      moved = false;
    },
    { passive: false },
  );

  target.addEventListener('touchcancel', () => {
    clearTimer();
    longPressFired = false;
    moved = false;
  });

  // Reached only by a real mouse right-click — touch never gets here since
  // touchstart/touchend above already prevent the native long-press path.
  target.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    onSecondary();
  });

  // Reached only by a real mouse click, for the same reason.
  target.addEventListener('click', onPrimary);
}
