// Levels and falling speed.
//
// The game runs in "ticks": 60 small steps per second, whatever the screen's refresh rate.
// Speed is counted in whole numbers only (1/65536 of a row per tick), so the same game
// gives exactly the same result on every computer: that is what makes a replay possible.

export const TICKS_PER_SECOND = 60;
export const MAX_LEVEL = 15;
export const LINES_PER_LEVEL = 10;
export const ONE_ROW = 65536;

/** Level 1 at the start, one more every 10 lines, up to level 15. */
export function levelForLines(lines) {
  return Math.min(MAX_LEVEL, 1 + Math.floor(lines / LINES_PER_LEVEL));
}

/** Seconds a piece takes to fall one row, from the official formula. */
export function secondsPerRow(level) {
  return Math.pow(0.8 - (level - 1) * 0.007, level - 1);
}

// GRAVITY[level] = how much of a row a piece falls in one tick, in 1/65536 of a row.
// Level 1 ≈ 1092 (one row per second), level 15 ≈ 156000 (more than two rows per tick).
const GRAVITY = [0];
for (let level = 1; level <= MAX_LEVEL; level++) {
  GRAVITY.push(Math.round(ONE_ROW / (secondsPerRow(level) * TICKS_PER_SECOND)));
}

export function gravityPerTick(level) {
  return GRAVITY[level];
}
