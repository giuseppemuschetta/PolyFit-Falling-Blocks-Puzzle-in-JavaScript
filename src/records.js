// The visitor's own games, kept in their browser: the top 10 of this device with names,
// like the high-score table of an arcade cabinet, and the name they typed last.
//
// Each entry: { id, name, score, lines, level, date, code }. `id` is the game's fingerprint,
// `code` the game itself (as in a challenge link, without the name), used by Watch and by
// the "vs your best" count. Entries saved before codes existed have code null.

import { load, save } from './storage.js';

export const TOP_SIZE = 10;

const isEntry = (e) =>
  e && typeof e === 'object' && typeof e.id === 'string' && Number.isFinite(e.score) && e.score > 0 && typeof e.date === 'string';

/** Puts a game in the list if it is good enough. Returns the new list and the game's place (0 = not in it). */
export function insertGame(top, entry) {
  // A stable sort: a game that only equals an older score goes below it.
  const list = [...top, entry].sort((a, b) => b.score - a.score).slice(0, TOP_SIZE);
  return { top: list, place: list.indexOf(entry) + 1 };
}

/** The list with one entry changed. */
export function updateEntry(top, id, changes) {
  return top.map((e) => (e.id === id ? { ...e, ...changes } : e));
}

export function loadTop() {
  const top = load('top', null);
  if (Array.isArray(top)) return top.filter(isEntry).slice(0, TOP_SIZE);
  // Before this list existed only the best score was kept: it opens the list.
  const best = load('best', null);
  if (best && Number.isFinite(best.score) && best.score > 0) {
    return [{ id: 'best', name: '', score: best.score, lines: best.lines ?? 0, level: best.level ?? 1, date: best.date ?? '', code: null }];
  }
  return [];
}

export function saveTop(top) {
  save('top', top);
}

export const loadName = () => load('name', '');
export const saveName = (name) => save('name', name);
