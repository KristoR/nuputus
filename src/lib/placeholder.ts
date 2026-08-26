import { el } from './dom';
import type { GameDef } from './types';

export function placeholderGame(id: string, title: string, emoji: string, blurb: string): GameDef {
  return {
    id,
    title,
    emoji,
    blurb,
    mount(container, setTitle) {
      setTitle(title);
      container.append(
        el('div', { class: 'home-header' }, [
          el('div', { class: 'emoji', style: 'font-size: 2.2rem;' }, [emoji]),
          el('h2', {}, [title]),
          el('p', {}, ['See mäng on veel valmimisel. Tule varsti tagasi!']),
        ]),
      );
      return () => {};
    },
  };
}
