// Long tests: whole 3-minute games played by the bot and by random key mashing,
// with the rules checked after every single tick.

import { test, assert } from './harness.js';
import { Game, replay, BUTTONS } from '../src/engine/game.js';
import { fits, ROWS, COLS } from '../src/engine/board.js';
import { levelForLines } from '../src/engine/speed.js';
import { createRandom } from '../src/engine/random.js';
import { playPiece } from './bot.js';

/** Things that must be true at every moment of every game. */
function checkInvariants(game, previousScore) {
  assert.equal(game.board.length, ROWS, 'rows');
  for (const row of game.board) {
    assert.equal(row.length, COLS, 'columns');
    assert.ok(row.some((cell) => cell === null), 'a full row was left on the board');
  }
  if (game.state === 'playing') assert.ok(fits(game.board, game.piece), 'the piece overlaps the stack');
  const sum = Object.values(game.stats.points).reduce((a, b) => a + b, 0);
  assert.equal(game.score, sum, 'score = sum of its parts');
  assert.ok(game.score >= previousScore, 'the score never goes down');
  assert.equal(game.level, levelForLines(game.lines), 'level');
  if (game.state === 'playing') {
    const dealt = Object.values(game.stats.dealt);
    const inPlay = game.stats.pieces + 1 + (game.holdType ? 1 : 0); // locked, falling, held
    assert.equal(dealt.reduce((a, b) => a + b, 0), inPlay, 'every piece counted once');
    assert.ok(Math.max(...dealt) - Math.min(...dealt) <= 1, 'with the bag, the counts stay within one');
  }
}

/** The bot plays a full game, thinking `delay` ticks before every piece. */
function botGame(seed, delay) {
  const game = new Game({ seed });
  game.start();
  let waited = 0;
  let previous = 0;
  while (game.state === 'playing') {
    if (waited >= delay) {
      playPiece(game);
      waited = 0;
    } else {
      game.tick();
      waited++;
    }
    checkInvariants(game, previous);
    previous = game.score;
    game.drainEvents();
  }
  return game;
}

test('stress: the bot plays ten games without breaking a rule', () => {
  // At level 15 pieces fall more than two rows per tick: a bot that waits before
  // every piece can top out there, and that is fine. What matters is the rules.
  const results = [];
  for (const seed of [11, 22, 33, 44, 55]) {
    for (const delay of [20, 6]) {
      const game = botGame(seed, delay);
      assert.ok(game.lines > 100, `seed ${seed}: only ${game.lines} lines`);
      if (delay === 20) results.push(`${game.score.toLocaleString('en-US')} (${game.lines} lines)`);
    }
  }
  globalThis.botScores = results;
});

test('stress: random key mashing never breaks a rule', () => {
  for (const seed of [1, 2, 3]) {
    const random = createRandom(seed * 7919);
    const game = new Game({ seed });
    game.start();
    let previous = 0;
    while (game.state === 'playing') {
      if (random() < 0.3) {
        const button = BUTTONS[Math.floor(random() * BUTTONS.length)];
        if (random() < 0.5) game.press(button);
        else game.release(button);
      }
      game.tick();
      checkInvariants(game, previous);
      previous = game.score;
      game.drainEvents();
    }
  }
});

test('replay: the same seed and inputs give exactly the same game', () => {
  for (const seed of [101, 202]) {
    const original = botGame(seed, 8);
    const again = replay(seed, original.log);
    assert.equal(again.score, original.score, 'score');
    assert.equal(again.lines, original.lines, 'lines');
    assert.equal(again.ticks, original.ticks, 'ticks');
    assert.deepEqual(again.board, original.board, 'board');
    assert.deepEqual(again.stats, original.stats, 'stats');
  }
});

test('replay: a changed input gives a different game', () => {
  const original = botGame(303, 8);
  const log = original.log.map((entry) => entry.slice());
  const i = log.findIndex(([, button]) => button === 'hardDrop');
  log.splice(i, 0, [log[i][0], 'left', 1], [log[i][0], 'left', 0]);
  const changed = replay(303, log);
  assert.ok(JSON.stringify(changed.board) !== JSON.stringify(original.board) || changed.score !== original.score);
});
