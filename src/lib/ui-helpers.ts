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

export function renderMessage(kind: 'success' | 'error', text: string): HTMLElement {
  return el('div', { class: `message-banner ${kind}` }, [text]);
}

export function toolbarButton(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const btn = el('button', { class: 'secondary-btn' }, [label]);
  if (disabled) btn.setAttribute('disabled', 'true');
  btn.addEventListener('click', onClick);
  return btn;
}
