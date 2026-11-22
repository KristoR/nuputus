import type { Level } from './types';

/** A saved in-progress game: enough to resume exactly where the player left off. */
export interface GameSnapshot<P, S, D extends Level = Level> {
  difficulty: D;
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
export function saveGame<P, S, D extends Level>(id: string, snapshot: GameSnapshot<P, S, D>): void {
  try {
    localStorage.setItem(PREFIX + id, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

export function loadGame<P, S, D extends Level = Level>(id: string): GameSnapshot<P, S, D> | null {
  try {
    const raw = localStorage.getItem(PREFIX + id);
    return raw ? (JSON.parse(raw) as GameSnapshot<P, S, D>) : null;
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

/** Small per-game preferences (last chosen difficulty, variant...), so the picker opens where the player left off. */
export function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + 'pref:' + key, value);
  } catch {
    /* ignore */
  }
}

export function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + 'pref:' + key);
  } catch {
    return null;
  }
}
