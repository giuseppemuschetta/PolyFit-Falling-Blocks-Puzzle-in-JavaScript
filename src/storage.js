// Small values kept in the visitor's browser (localStorage): the best score and the settings.
// Storage can be missing or blocked (private windows, strict settings): then the game
// simply forgets, it never breaks.

const PREFIX = 'polyfit:';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // nothing to do: the value just will not be remembered
  }
}
