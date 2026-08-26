import type { GameDef } from '../../lib/types';
import { mountSudoku } from './ui';

export const sudokuGame: GameDef = {
  id: 'sudoku',
  title: 'Sudoku',
  emoji: '🔢',
  blurb: 'Täida ruudustik numbritega 1–9, nii et need reas, veerus ja kastis ei korduks.',
  mount: mountSudoku,
};
