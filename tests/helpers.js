// Small tools shared by the test files.

import { Game } from '../src/engine/game.js';
import { COLS, ROWS } from '../src/engine/board.js';

/**
 * Builds the bottom of a board from a picture, top row first:
 *   boardFrom(['...X......',
 *              'XXX...XXXX',
 *              'XXXX.XXXXX'])
 * "X" is a block, "." is empty. Every row above the picture is empty.
 */
export function boardFrom(picture) {
  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  picture.forEach((line, i) => {
    const y = ROWS - picture.length + i;
    [...line].forEach((ch, x) => {
      if (ch !== '.') board[y][x] = 'X';
    });
  });
  return board;
}

/** A started game whose board is the picture and whose falling piece is `type`. */
export function gameWith(picture, type, options = {}) {
  const game = new Game({ seed: 1, ...options });
  game.start();
  game.board = boardFrom(picture);
  game.spawn(type);
  game.drainEvents();
  return game;
}

/** Ticks until the piece rests on something (at most `limit` ticks). */
export function tickUntilGrounded(game, limit = 2000) {
  for (let i = 0; i < limit && game.state === 'playing' && !game.isGrounded(); i++) game.tick();
}

export function tap(game, button) {
  game.press(button);
  game.release(button);
}

/** The last 'lock' event since the last drain. */
export function lastLock(game) {
  return game.drainEvents().filter((e) => e.type === 'lock').pop();
}
