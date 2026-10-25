// An automatic player, used by the tests to play thousands of moves in a few seconds.
//
// For the current piece (and the one in hold) it tries every rotation and column,
// drops the piece in its head, and scores the board that would result with six
// features and the weights published by Islam El-Ashi in 2011, building on the
// features of Pierre Dellacherie. It is the starting point for the "Beat my algorithm"
// opponent of phase 3.

import { cellsOf, fits, clearFullRows, COLS, ROWS } from '../src/engine/board.js';

const WEIGHTS = {
  landingHeight: -4.500158825082766,
  rowsCleared: 3.4181268101392694,
  rowTransitions: -3.2178882868487753,
  columnTransitions: -9.348695305445199,
  holes: -7.899265427351652,
  wells: -3.3855972247263626,
};

function copyBoard(board) {
  return board.map((row) => row.slice());
}

/** Scores a board after a piece has landed: the higher, the better. */
function evaluate(board, landedCells, rowsCleared) {
  const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== null);

  const meanY = landedCells.reduce((sum, [, y]) => sum + y, 0) / landedCells.length;
  const landingHeight = ROWS - meanY;

  let rowTransitions = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = -1; x < COLS; x++) if (filled(x, y) !== filled(x + 1, y)) rowTransitions++;
  }

  let columnTransitions = 0;
  let holes = 0;
  let wells = 0;
  for (let x = 0; x < COLS; x++) {
    let seenBlock = false;
    let wellDepth = 0;
    for (let y = 0; y < ROWS; y++) {
      if (filled(x, y) !== filled(x, y + 1)) columnTransitions++;
      if (filled(x, y)) seenBlock = true;
      else if (seenBlock) holes++;
      // a well: an empty cell with both neighbors filled; deeper wells cost more
      if (!filled(x, y) && filled(x - 1, y) && filled(x + 1, y)) {
        wellDepth++;
        wells += wellDepth;
      } else {
        wellDepth = 0;
      }
    }
  }

  return (
    WEIGHTS.landingHeight * landingHeight +
    WEIGHTS.rowsCleared * rowsCleared +
    WEIGHTS.rowTransitions * rowTransitions +
    WEIGHTS.columnTransitions * columnTransitions +
    WEIGHTS.holes * holes +
    WEIGHTS.wells * wells
  );
}

/** The best { rotation, x, value } for a piece type, starting from row y. */
function bestPlacement(board, type, y) {
  let best = null;
  for (let rotation = 0; rotation < 4; rotation++) {
    for (let x = -3; x < COLS; x++) {
      let piece = { type, rotation, x, y };
      if (!fits(board, piece)) continue;
      while (fits(board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
      const after = copyBoard(board);
      const cells = cellsOf(piece);
      for (const [cx, cy] of cells) after[cy][cx] = type;
      const rows = clearFullRows(after).length;
      const value = evaluate(after, cells, rows);
      if (!best || value > best.value) best = { rotation, x, value };
    }
  }
  return best;
}

/** Decides what to do with the falling piece: { hold, rotation, x }. */
export function decide(game) {
  const { board, piece } = game;
  const here = bestPlacement(board, piece.type, piece.y);
  const heldType = game.holdType ?? game.nextPieces[0];
  const there = game.holdUsed ? null : bestPlacement(board, heldType, piece.y);
  if (there && (!here || there.value > here.value + 1)) return { hold: true, ...there };
  return { hold: false, ...(here ?? { rotation: 0, x: piece.x }) };
}

/** Plays one piece through the real inputs: hold, turn, slide, drop. */
export function playPiece(game) {
  const plan = decide(game);
  if (plan.hold) {
    game.press('hold');
    if (game.state !== 'playing') return;
  }
  const turns = { 0: [], 1: ['rotateCW'], 2: ['rotateCW', 'rotateCW'], 3: ['rotateCCW'] }[plan.rotation];
  for (const button of turns) game.press(button);
  for (let guard = 0; guard < COLS + 3 && game.piece.x !== plan.x; guard++) {
    const button = game.piece.x > plan.x ? 'left' : 'right';
    const before = game.piece.x;
    game.press(button);
    game.release(button);
    if (game.piece.x === before) break; // blocked
  }
  game.press('hardDrop');
}
