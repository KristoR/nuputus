import type { Difficulty } from './types';

/** A saved in-progress game: enough to resume exactly where the player left off. */
export interface GameSnapshot<P, S> {
  difficulty: Difficulty;
  puzzle: P;
  state: S;
}

const PREFIX = 'nuputus:';

/**
 * Games are saved to localStorage keyed by game id, so closing the tab or
 * switching apps on mobile doesn't lose progress. Storage can be
 * unavailable (private browsing, quota, disabled) — every call is best
 * effort and silently no-ops on failure rather than breaking the game.
 */
export function saveGame<P, S>(id: string, snapshot: GameSnapshot<P, S>): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadGame<P, S>(id: string): GameSnapshot<P, S> | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as GameSnapshot<P, S>) : null;
  } catch {
    return null;
  }
}

export function clearGame(id: string): void {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch {
    /* ignore */
  }
}
