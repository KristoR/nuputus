import './style.css';
import { el, clear } from './lib/dom';
import type { GameDef } from './lib/types';
import { renderHome } from './home';
import { sudokuGame } from './games/sudoku';
import { tentsGame } from './games/tents';
import { starBattleGame } from './games/starbattle';
import { placeholderGame } from './lib/placeholder';

const games: GameDef[] = [
  sudokuGame,
  tentsGame,
  starBattleGame,
  placeholderGame('battleship', 'Laevade pommitamine', '🚢', 'Leia peidetud laevastik loogika abil.'),
  placeholderGame('slitherlink', 'Hiina müür', '🧱', 'Tõmba jooned nii, et tekiks üks terviklik müür.'),
];

const app = document.getElementById('app')!;

const topbar = el('div', { class: 'topbar' });
const backBtn = el('button', { class: 'icon-btn', 'aria-label': 'Tagasi' }, ['←']);
const titleEl = el('h1', {}, ['Nuputus']);
topbar.append(backBtn, titleEl);

const main = el('main');
const footer = el('footer', { class: 'app-footer' }, ['Nuputus — eestikeelsed loogikamõistatused']);

app.append(topbar, main, footer);

let cleanupCurrent: (() => void) | null = null;

function setTitle(t: string) {
  titleEl.textContent = t;
}

function showHome() {
  cleanupCurrent?.();
  cleanupCurrent = null;
  setTitle('Nuputus');
  backBtn.style.visibility = 'hidden';
  clear(main);
  main.append(renderHome(games, (id) => {
    location.hash = `#/game/${id}`;
  }));
}

function showGame(id: string) {
  const game = games.find((g) => g.id === id);
  if (!game) {
    location.hash = '#/';
    return;
  }
  cleanupCurrent?.();
  backBtn.style.visibility = 'visible';
  clear(main);
  cleanupCurrent = game.mount(main, setTitle);
}

backBtn.addEventListener('click', () => {
  location.hash = '#/';
});

function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  if (parts[0] === 'game' && parts[1]) {
    showGame(parts[1]);
  } else {
    showHome();
  }
}

window.addEventListener('hashchange', route);
route();
