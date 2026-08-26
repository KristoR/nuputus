import { el } from './lib/dom';
import type { GameDef } from './lib/types';

export function renderHome(games: GameDef[], onOpen: (id: string) => void): HTMLElement {
  const cards = games.map((g) => {
    const card = el('button', { class: 'game-card' }, [
      el('div', { class: 'emoji' }, [g.emoji]),
      el('h3', {}, [g.title]),
      el('p', {}, [g.blurb]),
    ]);
    card.addEventListener('click', () => onOpen(g.id));
    return card;
  });

  return el('div', {}, [
    el('div', { class: 'home-header' }, [
      el('h1', {}, ['Nuputus']),
      el('p', {}, ['Eestikeelsed nuputusmängud — harjuta loogilist tuletamist, samm-sammult.']),
    ]),
    el('div', { class: 'game-grid' }, cards),
  ]);
}
