export type Difficulty = 'lihtne' | 'keskmine' | 'raske';

export const DIFFICULTIES: Difficulty[] = ['lihtne', 'keskmine', 'raske'];

export interface HintStep {
  /** Short title of the technique, e.g. "Ainus võimalus" */
  title: string;
  /** Full Estonian explanation of the reasoning */
  explanation: string;
  /** Coordinates (as opaque keys) to highlight as the deduced target */
  primary: string[];
  /** Coordinates to highlight as supporting evidence (row/col/region already full, etc.) */
  secondary?: string[];
  /** Mutates the puzzle state to apply this deduction. */
  apply: () => void;
}

export interface GameDef {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  /** Mounts the game screen (difficulty picker + board) into container. Returns a cleanup function. */
  mount: (container: HTMLElement, setTitle: (t: string) => void) => () => void;
}

export function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}
