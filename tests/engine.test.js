// Tests of the building blocks: random numbers, pieces, board and speed.

import { test, assert } from './harness.js';
import { createRandom, createBag } from '../src/engine/random.js';
import { SHAPES, PIECE_TYPES, kicksFor } from '../src/engine/pieces.js';
import { clearFullRows, fits, isEmpty, stackTop, ROWS } from '../src/engine/board.js';
import { secondsPerRow, gravityPerTick, levelForLines, MAX_LEVEL } from '../src/engine/speed.js';
import { boardFrom } from './helpers.js';

const sorted = (cells) => cells.map(([x, y]) => `${x},${y}`).sort();

test('random: the same seed gives the same numbers', () => {
  const a = createRandom(42);
  const b = createRandom(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('random: different seeds give different numbers', () => {
  const a = createRandom(1);
  const b = createRandom(2);
  const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
  assert.ok(same < 2, 'two seeds should not give the same sequence');
});

test('random: numbers stay in [0, 1)', () => {
  const r = createRandom(7);
  for (let i = 0; i < 10000; i++) {
    const n = r();
    assert.ok(n >= 0 && n < 1, `out of range: ${n}`);
  }
});

test('bag: every group of 7 pieces holds each piece exactly once', () => {
  const next = createBag(createRandom(123));
  for (let bag = 0; bag < 200; bag++) {
    const group = Array.from({ length: 7 }, next).sort().join('');
    assert.equal(group, [...PIECE_TYPES].sort().join(''), `bag ${bag}:`);
  }
});

test('pieces: every rotation state has 4 cells inside its box', () => {
  for (const type of PIECE_TYPES) {
    for (const cells of SHAPES[type]) {
      assert.equal(cells.length, 4, type);
      const size = type === 'I' || type === 'O' ? 4 : 3;
      assert.ok(cells.every(([x, y]) => x >= 0 && y >= 0 && x < size && y < size), type);
    }
  }
});

test('pieces: T states match the SRS pictures', () => {
  assert.deepEqual(sorted(SHAPES.T[0]), sorted([[1, 0], [0, 1], [1, 1], [2, 1]])); // points up
  assert.deepEqual(sorted(SHAPES.T[1]), sorted([[1, 0], [1, 1], [2, 1], [1, 2]])); // points right
  assert.deepEqual(sorted(SHAPES.T[2]), sorted([[0, 1], [1, 1], [2, 1], [1, 2]])); // points down
  assert.deepEqual(sorted(SHAPES.T[3]), sorted([[1, 0], [0, 1], [1, 1], [1, 2]])); // points left
});

test('pieces: I turns around the center of its 4×4 box', () => {
  assert.deepEqual(sorted(SHAPES.I[1]), sorted([[2, 0], [2, 1], [2, 2], [2, 3]]));
  assert.deepEqual(sorted(SHAPES.I[2]), sorted([[0, 2], [1, 2], [2, 2], [3, 2]]));
  assert.deepEqual(sorted(SHAPES.I[3]), sorted([[1, 0], [1, 1], [1, 2], [1, 3]]));
});

test('pieces: kicks are flipped to rows that grow downward', () => {
  // published (−1, +1) means one column left and one row UP: [−1, −1] on our board
  assert.deepEqual(kicksFor('T', 0, 1)[2], [-1, -1]);
  assert.deepEqual(kicksFor('T', 0, 1)[3], [0, 2]);
  assert.deepEqual(kicksFor('I', 0, 1)[4], [1, -2]);
  assert.deepEqual(kicksFor('O', 0, 1), [[0, 0]]);
  assert.equal(kicksFor('S', 3, 0).length, 5);
});

test('board: full rows disappear and the rows above fall', () => {
  const board = boardFrom([
    '..X.......',
    'XXXXXXXXXX',
    'X.........',
    'XXXXXXXXXX',
  ]);
  const cleared = clearFullRows(board);
  assert.deepEqual(cleared, [ROWS - 3, ROWS - 1]);
  assert.equal(board[ROWS - 1].join(','), ['X', ...Array(9).fill(null)].join(','));
  assert.equal(board[ROWS - 2][2], 'X');
  assert.equal(stackTop(board), ROWS - 2);
});

test('board: walls and floor block a piece', () => {
  const board = boardFrom([]);
  assert.ok(fits(board, { type: 'O', rotation: 0, x: -1, y: 0 }));
  assert.ok(!fits(board, { type: 'O', rotation: 0, x: -2, y: 0 }));
  assert.ok(!fits(board, { type: 'O', rotation: 0, x: 8, y: 0 }));
  assert.ok(!fits(board, { type: 'O', rotation: 0, x: 3, y: ROWS - 1 }));
  assert.ok(isEmpty(board));
});

test('speed: seconds per row follow the official formula', () => {
  const table = [1.0, 0.79, 0.62, 0.47, 0.36, 0.26, 0.19, 0.13, 0.09, 0.06, 0.04, 0.03, 0.02, 0.01];
  table.forEach((seconds, i) => assert.equal(Number(secondsPerRow(i + 1).toFixed(2)), seconds, `level ${i + 1}`));
  assert.equal(Number(secondsPerRow(15).toFixed(3)), 0.007, 'level 15');
});

test('speed: every level is faster than the one before', () => {
  for (let level = 2; level <= MAX_LEVEL; level++) {
    assert.ok(gravityPerTick(level) > gravityPerTick(level - 1), `level ${level}`);
  }
});

test('speed: one level every 10 lines, up to 15', () => {
  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(9), 1);
  assert.equal(levelForLines(10), 2);
  assert.equal(levelForLines(139), 14);
  assert.equal(levelForLines(500), 15);
});
