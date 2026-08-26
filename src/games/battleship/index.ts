import type { GameDef } from '../../lib/types';
import { mountBattleship } from './ui';

export const battleshipGame: GameDef = {
  id: 'battleship',
  title: 'Laevade pommitamine',
  emoji: '🚢',
  blurb: 'Leia peidetud laevastik loogika abil.',
  mount: mountBattleship,
};
