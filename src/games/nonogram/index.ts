import type { GameDef } from '../../lib/types';
import { mountNonogram } from './ui';

export const nonogramGame: GameDef = {
  id: 'nonogram',
  title: 'Jaapani mõistatus',
  emoji: '🖼️',
  blurb: 'Värvi ruudud numbrite järgi mustaks ja leia peidetud pilt.',
  mount: mountNonogram,
};
