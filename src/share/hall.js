// Checks the Hall of Fame: every entry is a challenge link, replayed here to get its score.

import { replay } from '../engine/game.js';
import { decodeGame, gameFrom } from './link.js';

/**
 * Returns the entries that replay, best score first: { name, score, lines, level, date, game }.
 * `pause()` is awaited before each replay, so the check can wait while someone is playing.
 */
export async function checkHall(entries, { pause = async () => {} } = {}) {
  const rows = [];
  const seen = new Set();
  for (const entry of entries) {
    await pause();
    try {
      const game = await decodeGame(gameFrom(entry.link));
      if (seen.has(game.fingerprint)) continue; // a copy of a game already in the list
      seen.add(game.fingerprint);
      const played = replay(game.seed, game.log);
      rows.push({ name: game.name || 'Unnamed', score: played.score, lines: played.lines, level: played.level, date: game.date, game });
    } catch (error) {
      console.warn('Hall of Fame: an entry does not open', entry, error);
    }
  }
  return rows.sort((a, b) => b.score - a.score);
}
