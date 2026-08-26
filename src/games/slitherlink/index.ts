import type { GameDef } from '../../lib/types';
import { mountSlitherlink } from './ui';

export const slitherlinkGame: GameDef = {
  id: 'slitherlink',
  title: 'Hiina müür',
  emoji: '🧱',
  blurb: 'Tõmba jooned nii, et tekiks üks terviklik müür.',
  mount: mountSlitherlink,
};
