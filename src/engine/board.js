// The board: a grid of 10 columns and 40 rows.
//
// Only the bottom 20 rows are visible. The 20 rows above them are hidden: new pieces
// appear there, just above the visible field. The board is an array of rows,
// board[y][x], with y = 0 at the top. An empty cell is null; a filled cell holds the
// letter of the piece that left it ('T', 'I', …), which tells the screen its color.

import { SHAPES } from './pieces.js';

export const COLS = 10;
export const ROWS = 40;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = ROWS - VISIBLE_ROWS; // rows 0–19 hidden, rows 20–39 visible

export function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

/** The board cells covered by a piece: { type, rotation, x, y } → [[x, y], …]. */
export function cellsOf(piece) {
  return SHAPES[piece.type][piece.rotation].map(([cx, cy]) => [piece.x + cx, piece.y + cy]);
}

/** True if (x, y) is a block, a wall or the floor. Outside the board counts as filled. */
export function isFilled(board, x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
  return board[y][x] !== null;
}

/** True if the piece can stand where it is, without overlapping anything. */
export function fits(board, piece) {
  return cellsOf(piece).every(([x, y]) => !isFilled(board, x, y));
}

/** Writes the piece into the board, where it becomes part of the stack. */
export function place(board, piece) {
  for (const [x, y] of cellsOf(piece)) board[y][x] = piece.type;
}

/**
 * Removes every full row and lets the rows above fall down.
 * Returns the indexes of the removed rows, as they were before falling.
 */
export function clearFullRows(board) {
  const cleared = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every((cell) => cell !== null)) cleared.push(y);
  }
  // Remove from the bottom up, so the indexes still to remove do not shift.
  for (let i = cleared.length - 1; i >= 0; i--) board.splice(cleared[i], 1);
  for (let i = 0; i < cleared.length; i++) board.unshift(Array(COLS).fill(null));
  return cleared;
}

export function isEmpty(board) {
  return board.every((row) => row.every((cell) => cell === null));
}

/** The topmost row that holds a block, or ROWS if the board is empty. */
export function stackTop(board) {
  const y = board.findIndex((row) => row.some((cell) => cell !== null));
  return y === -1 ? ROWS : y;
}
