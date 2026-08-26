import type { GameDef } from '../../lib/types';
import { mountTents } from './ui';

export const tentsGame: GameDef = {
  id: 'tents',
  title: 'Telklaager',
  emoji: '⛺',
  blurb: 'Aseta telgid puude kõrvale — igas reas ja veerus täpne kogus.',
  mount: mountTents,
};
