import type { GameDef } from '../../lib/types';
import { mountStarBattle } from './ui';

export const starBattleGame: GameDef = {
  id: 'starbattle',
  title: 'Tähesõda',
  emoji: '⭐',
  blurb: 'Paiguta tähed nii, et need üksteist ei puutuks.',
  mount: mountStarBattle,
};
