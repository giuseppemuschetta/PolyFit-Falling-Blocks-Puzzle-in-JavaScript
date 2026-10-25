// Tests of a whole game: spawning, moving, locking, holding, scoring, the clock.

import { test, assert } from './harness.js';
import { Game } from '../src/engine/game.js';
import { cellsOf, HIDDEN_ROWS, ROWS } from '../src/engine/board.js';
import { PIECE_TYPES } from '../src/engine/pieces.js';
import { boardFrom, gameWith, tickUntilGrounded, tap, lastLock } from './helpers.js';

const ticks = (game, n) => {
  for (let i = 0; i < n; i++) game.tick();
};

test('game: pieces appear in the middle, with one row already in view', () => {
  for (const type of PIECE_TYPES) {
    const game = gameWith([], type);
    assert.equal(game.piece.x, 3, type);
    assert.equal(game.piece.y, HIDDEN_ROWS - 1, type);
    const rows = cellsOf(game.piece).map(([, y]) => y);
    assert.ok(rows.includes(HIDDEN_ROWS), `${type} reaches the first visible row`);
  }
});

test('game: at level 1 a piece falls one row per second', () => {
  const game = gameWith([], 'T');
  const y = game.piece.y;
  ticks(game, 59);
  assert.equal(game.piece.y, y);
  ticks(game, 2);
  assert.equal(game.piece.y, y + 1);
});

test('game: a held key repeats after 10 ticks, then every 3', () => {
  const game = gameWith([], 'T');
  game.press('left');
  assert.equal(game.piece.x, 2, 'moves at once');
  ticks(game, 9);
  assert.equal(game.piece.x, 2, 'still waiting');
  ticks(game, 1);
  assert.equal(game.piece.x, 1, 'first repeat');
  ticks(game, 3);
  assert.equal(game.piece.x, 0, 'second repeat');
  ticks(game, 6);
  assert.equal(game.piece.x, 0, 'stopped by the wall');
});

test('game: the last direction pressed wins', () => {
  const game = gameWith([], 'T');
  game.press('left');
  game.press('right');
  assert.equal(game.piece.x, 3);
  game.release('right');
  ticks(game, 10);
  assert.equal(game.piece.x, 2, 'left takes over and repeats');
  game.release('left');
  ticks(game, 20);
  assert.equal(game.piece.x, 2, 'nothing held, nothing moves');
});

test('game: hard drop lands the piece and scores 2 per row', () => {
  const game = gameWith([], 'T');
  const fromY = game.piece.y;
  game.press('hardDrop');
  const lock = lastLock(game);
  assert.equal(lock.piece.y, ROWS - 2);
  assert.equal(game.score, 2 * (ROWS - 2 - fromY));
  assert.equal(game.board[ROWS - 1].filter(Boolean).length, 3);
  assert.equal(game.board[ROWS - 2][4], 'T');
});

test('game: soft drop scores 1 per row', () => {
  const game = gameWith([], 'O');
  game.press('down');
  tickUntilGrounded(game);
  game.release('down');
  assert.equal(game.score, ROWS - 2 - (HIDDEN_ROWS - 1));
});

test('game: a piece on the ground locks after half a second', () => {
  const game = gameWith([], 'T');
  game.piece = { ...game.piece, y: ROWS - 2 };
  game.lowestY = ROWS - 2;
  ticks(game, 29);
  assert.equal(game.stats.pieces, 0);
  ticks(game, 1);
  assert.equal(game.stats.pieces, 1);
});

test('game: moving on the ground restarts the lock delay', () => {
  const game = gameWith([], 'T');
  game.piece = { ...game.piece, y: ROWS - 2 };
  game.lowestY = ROWS - 2;
  ticks(game, 20);
  tap(game, 'left');
  ticks(game, 29);
  assert.equal(game.stats.pieces, 0, 'the half second started again');
  ticks(game, 1);
  assert.equal(game.stats.pieces, 1);
});

test('game: after 15 resets the piece locks as soon as it touches', () => {
  const game = gameWith([], 'T');
  game.piece = { ...game.piece, y: ROWS - 2 };
  game.lowestY = ROWS - 2;
  for (let i = 0; i < 15; i++) tap(game, i % 2 === 0 ? 'left' : 'right');
  assert.equal(game.stats.pieces, 0);
  ticks(game, 1);
  assert.equal(game.stats.pieces, 1);
});

test('game: hold swaps the piece, once per piece', () => {
  const game = new Game({ seed: 9 });
  game.start();
  const first = game.piece.type;
  const second = game.nextPieces[0];
  game.press('hold');
  assert.equal(game.holdType, first);
  assert.equal(game.piece.type, second);
  game.press('hold');
  assert.equal(game.piece.type, second, 'a second hold does nothing');
  game.press('hardDrop');
  const third = game.piece.type;
  game.press('hold');
  assert.equal(game.piece.type, first, 'after a lock, hold works again');
  assert.equal(game.holdType, third);
});

test('game: each piece is counted once, when it comes into play', () => {
  const game = new Game({ seed: 9 });
  const total = () => Object.values(game.stats.dealt).reduce((a, b) => a + b, 0);
  assert.equal(total(), 0, 'nothing before the start');
  game.start();
  const first = game.piece.type;
  assert.equal(game.stats.dealt[first], 1, 'the falling piece counts at once');
  game.press('hold');
  assert.equal(total(), 2, 'the first hold brings in a new piece');
  game.press('hardDrop');
  assert.equal(total(), 3, 'a lock brings in a new piece');
  game.press('hold');
  assert.equal(game.piece.type, first);
  assert.equal(total(), 3, 'a piece back from hold is not new');
  assert.equal(game.stats.dealt[first], 1);
});

test('game: a Single scores 100', () => {
  const game = gameWith(['XXX....XXX', 'XXX....XXX'], 'I');
  game.press('hardDrop');
  const lock = lastLock(game);
  assert.equal(lock.lines, 1);
  assert.equal(lock.name, 'Single');
  assert.equal(lock.points, 100);
  assert.equal(game.lines, 1);
});

test('game: a PolyFit! with the I piece, then back-to-back', () => {
  const four = ['XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.', 'XXXXXXXXX.'];
  const game = gameWith(['X.........', ...four], 'I');
  game.press('rotateCW');
  for (let i = 0; i < 4; i++) tap(game, 'right');
  game.press('hardDrop');
  let lock = lastLock(game);
  assert.equal(lock.name, 'PolyFit!');
  assert.equal(lock.points, 800);

  // the same again: the second PolyFit! in a row is back-to-back (combo +50 too)
  game.board = boardFrom(['X.........', ...four]);
  game.spawn('I');
  game.press('rotateCW');
  for (let i = 0; i < 4; i++) tap(game, 'right');
  game.press('hardDrop');
  lock = lastLock(game);
  assert.ok(lock.backToBack);
  assert.equal(lock.points, 1200 + 50);
  assert.equal(game.stats.polyfits, 2);
  assert.equal(game.stats.maxBackToBack, 1);
});

test('game: a T-spin Double, rotated into its slot', () => {
  const game = gameWith(
    [
      '...X......',
      'XXX...XXXX',
      'XXXX.XXXXX',
    ],
    'T',
  );
  game.press('rotateCW'); // the T points right
  game.press('down');
  tickUntilGrounded(game);
  game.release('down');
  assert.deepEqual([game.piece.x, game.piece.y], [3, ROWS - 3]);
  game.press('rotateCW'); // turns into the slot, pointing down
  game.press('hardDrop');
  const lock = lastLock(game);
  assert.equal(lock.tspin, 'full');
  assert.equal(lock.name, 'T-spin Double');
  assert.equal(lock.lines, 2);
  assert.equal(lock.parts.tspin, 1200);
});

test('game: the 3-corner rule tells full T-spins from Minis', () => {
  const game = gameWith(['.X........'], 'T');
  // a T pointing right against the left wall, with one block under its right side
  game.piece = { type: 'T', rotation: 1, x: -1, y: ROWS - 3 };
  game.lastMoveWasRotation = true;
  game.lastKick = 0;
  assert.equal(game.detectTSpin(), 'mini', 'front corner missing');
  game.lastKick = 4;
  assert.equal(game.detectTSpin(), 'full', 'the longest kick makes it full');
  game.lastMoveWasRotation = false;
  assert.equal(game.detectTSpin(), 'none', 'last move was not a turn');
});

test('game: a perfect clear adds its bonus', () => {
  const game = gameWith(['XXX....XXX'], 'I');
  game.press('hardDrop');
  const lock = lastLock(game);
  assert.ok(lock.perfectClear);
  assert.equal(lock.points, 100 + 800);
  assert.equal(game.stats.perfectClears, 1);
});

test('game: lines are scored at the level before the level up', () => {
  const game = gameWith(['XXX....XXX', 'XXX....XXX'], 'I');
  game.lines = 9;
  game.press('hardDrop');
  const lock = lastLock(game);
  assert.equal(lock.points, 100, 'scored at level 1');
  assert.equal(game.level, 2);
  assert.equal(lock.levelUp, 2);
});

test('game: after 3 minutes the game ends, and the falling piece does not count', () => {
  const game = new Game({ seed: 3, seconds: 2 });
  game.start();
  ticks(game, 119);
  assert.equal(game.state, 'playing');
  ticks(game, 1);
  assert.equal(game.state, 'over');
  assert.equal(game.overReason, 'time');
  assert.equal(game.piece, null);
  assert.equal(game.stats.timeline.length, 2);
  game.press('hardDrop');
  assert.equal(game.stats.pieces, 0, 'inputs after the end are ignored');
});

test('game: no room for a new piece ends the game', () => {
  const game = gameWith([], 'T');
  for (const y of [HIDDEN_ROWS - 2, HIDDEN_ROWS - 1]) game.board[y][4] = 'X';
  game.spawn('O');
  assert.equal(game.state, 'over');
  assert.equal(game.overReason, 'topout');
});

test('game: a piece locked entirely above the field ends the game', () => {
  const rows = Array(20).fill('XXXXXXXXX.');
  const game = gameWith(rows, 'T');
  assert.equal(game.piece.y, HIDDEN_ROWS - 2, 'no room to drop into view');
  game.press('hardDrop');
  assert.equal(game.state, 'over');
  assert.equal(game.overReason, 'topout');
});
