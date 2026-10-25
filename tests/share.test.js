// Tests of what travels and what is kept: challenge links, the replayer that runs a
// recorded game in step with another, and the top 10 of the device.

import { test, assert } from './harness.js';
import { Game, replay } from '../src/engine/game.js';
import { Replayer } from '../src/engine/replayer.js';
import { createRandom } from '../src/engine/random.js';
import { encodeGame, decodeGame, packGame, plainText, linkFor, gameFrom, fingerprint, cleanName } from '../src/share/link.js';
import { insertGame, updateEntry, TOP_SIZE } from '../src/records.js';
import { playPiece } from './bot.js';

/**
 * A full game with inputs like a person's: keys held down for a while, soft drops, then
 * the bot places the piece. Games of the bot alone have taps only.
 */
function playedGame(seed) {
  const game = new Game({ seed });
  game.start();
  const random = createRandom(seed * 31 + 7);
  const hold = (button, ticks) => {
    game.press(button);
    for (let i = 0; i < ticks && game.state === 'playing'; i++) game.tick();
    game.release(button);
  };
  let wait = 0;
  while (game.state === 'playing') {
    if (wait-- > 0) {
      game.tick();
    } else {
      if (random() < 0.3) hold(random() < 0.5 ? 'left' : 'right', 4 + Math.floor(random() * 16));
      if (random() < 0.3 && game.state === 'playing') hold('down', 3 + Math.floor(random() * 10));
      if (game.state === 'playing') playPiece(game);
      wait = 15 + Math.floor(random() * 40);
    }
    game.drainEvents();
  }
  return game;
}

const games = new Map();
function gameFor(seed) {
  if (!games.has(seed)) games.set(seed, playedGame(seed));
  return games.get(seed);
}

async function roundTrip(game, name = 'Marco R.') {
  const text = await encodeGame({ seed: game.seed, log: game.log, name, date: '2026-10-24' });
  return { text, back: await decodeGame(text) };
}

async function refused(text) {
  try {
    await decodeGame(text);
  } catch (error) {
    return error.reason;
  }
  return null;
}

test('link: a game comes back identical, every input in place', async () => {
  const game = gameFor(41);
  const { back } = await roundTrip(game, 'Niccolò R.');
  assert.equal(back.seed, game.seed, 'seed');
  assert.equal(back.name, 'Niccolò R.', 'name');
  assert.equal(back.date, '2026-10-24', 'date');
  assert.deepEqual(back.log, game.log, 'inputs');
});

test('link: the score comes from replaying the game, not from the link', async () => {
  const game = gameFor(42);
  const { back } = await roundTrip(game);
  const again = replay(back.seed, back.log);
  assert.equal(again.score, game.score, 'score');
  assert.equal(again.lines, game.lines, 'lines');
  assert.ok(game.score > 0, 'the test game scored');
});

test('link: one changed input makes another game, with another fingerprint', async () => {
  const game = gameFor(43);
  const log = game.log.map((entry) => entry.slice());
  const i = log.findIndex(([, button]) => button === 'hardDrop');
  log.splice(i, 0, [log[i][0], 'rotateCW', 1]);
  const changed = await decodeGame(await encodeGame({ seed: game.seed, log, date: '2026-10-24' }));
  const original = (await roundTrip(game)).back;
  assert.ok(changed.fingerprint !== original.fingerprint, 'fingerprint');
  const a = replay(changed.seed, changed.log);
  assert.ok(a.score !== game.score || JSON.stringify(a.board) !== JSON.stringify(game.board), 'a different game');
});

test('link: the fingerprint ignores the name and the day', async () => {
  const game = gameFor(41);
  const one = (await roundTrip(game, 'Anna')).back;
  const two = await decodeGame(await encodeGame({ seed: game.seed, log: game.log, name: 'Someone else', date: '2026-12-31' }));
  assert.equal(one.fingerprint, two.fingerprint);
  assert.equal(one.fingerprint, fingerprint(game.seed, game.log));
  assert.ok(fingerprint(game.seed + 1, game.log) !== one.fingerprint, 'other pieces, other fingerprint');
});

test('link: a whole 3-minute game fits in a few kilobytes', async () => {
  const sizes = [];
  for (const seed of [41, 42, 43]) {
    const game = gameFor(seed);
    const { text } = await roundTrip(game);
    const address = linkFor(text, 'https://giuseppemuschetta.com/challenge/');
    assert.ok(address.length < 8000, `${address.length} characters`);
    sizes.push(`${game.log.length} inputs → ${address.length} characters`);
  }
  globalThis.linkSizes = sizes;
});

test('link: the address keeps only the game part', () => {
  assert.equal(gameFrom('https://giuseppemuschetta.com/challenge/#c=zAb-_9'), 'zAb-_9');
  assert.equal(gameFrom('#c=uAAA'), 'uAAA');
  assert.equal(gameFrom('https://giuseppemuschetta.com/challenge/#moves'), null);
  assert.equal(gameFrom('https://giuseppemuschetta.com/challenge/'), null);
  assert.equal(linkFor('zAb', 'https://example.test/challenge/'), 'https://example.test/challenge/#c=zAb');
});

test('link: damaged or foreign links are refused', async () => {
  const game = gameFor(42);
  const { text } = await roundTrip(game);
  assert.equal(await refused(''), 'damaged', 'empty');
  assert.equal(await refused('x' + text.slice(1)), 'damaged', 'unknown kind');
  assert.equal(await refused(text.slice(0, text.length - 40)), 'damaged', 'cut short');
  assert.equal(await refused('z' + 'A'.repeat(64)), 'damaged', 'not a game');
  assert.equal(await refused('u***'), 'damaged', 'not base64');

  const bytes = packGame({ seed: game.seed, log: game.log, name: 'Anna', date: '2026-10-24' });
  assert.equal(await refused(plainText(bytes.slice(0, bytes.length - 1))), 'damaged', 'an input cut in half');
  assert.equal(await refused(plainText(Uint8Array.from([...bytes, 0]))), 'damaged', 'extra bytes');
  const rules = bytes.slice();
  rules[1] = 99;
  assert.equal(await refused(plainText(rules)), 'old', 'other rules');
  assert.equal((await decodeGame(plainText(bytes))).name, 'Anna', 'the same bytes, uncompressed, open fine');
});

test('link: names keep letters, digits and a few signs only', () => {
  assert.equal(cleanName('  Marco    R. '), 'Marco R.');
  assert.equal(cleanName("José-María O'Neil"), "José-María O'Neil");
  assert.equal(cleanName('<b>Ana</b>'), 'bAnab', 'no markup signs');
  assert.equal(cleanName('ann@mail.com'), 'annmail.com', 'no addresses');
  assert.equal(cleanName('Bob‮evil'), 'Bobevil', 'no invisible characters');
  assert.equal(cleanName('Marco 🔥'), 'Marco');
  assert.equal(cleanName('A very long name indeed, really'), 'A very long name ind');
  assert.equal(cleanName(null), '');
});

test('replayer: in step with replay(), however it is advanced', () => {
  const game = gameFor(43);
  const steps = new Replayer(game.seed, game.log);
  const random = createRandom(5);
  while (steps.game.state === 'playing') {
    const target = steps.game.ticks + 1 + Math.floor(random() * 90);
    steps.advanceTo(target);
    steps.advanceTo(target); // asking twice changes nothing
    steps.game.drainEvents();
  }
  const once = replay(game.seed, game.log);
  assert.equal(steps.game.score, once.score, 'score');
  assert.equal(steps.game.ticks, once.ticks, 'ticks');
  assert.deepEqual(steps.game.board, once.board, 'board');
  assert.equal(steps.game.score, game.score, 'the original score');
});

test('replayer: at any tick it shows the original game at that tick', () => {
  const game = gameFor(41);
  const live = new Game({ seed: game.seed });
  live.start();
  const steps = new Replayer(game.seed, game.log);
  let i = 0;
  for (let t = 0; t < 1800 && live.state === 'playing'; t++) {
    while (i < game.log.length && game.log[i][0] === live.ticks) {
      const [, button, down] = game.log[i++];
      if (down) live.press(button);
      else live.release(button);
    }
    steps.advanceTo(live.ticks);
    assert.equal(steps.game.score, live.score, `score at tick ${t}`);
    assert.deepEqual(steps.game.piece, live.piece, `piece at tick ${t}`);
    live.tick();
  }
});

test('records: the top 10 keeps the best ten, and ties go below', () => {
  let top = [];
  const entry = (id, score) => ({ id, name: '', score, lines: 0, level: 1, date: '2026-10-24', code: null });
  for (let i = 1; i <= 12; i++) top = insertGame(top, entry(`g${i}`, i * 100)).top;
  assert.equal(top.length, TOP_SIZE);
  assert.equal(top[0].score, 1200);
  assert.equal(top.at(-1).score, 300);
  const low = insertGame(top, entry('low', 50));
  assert.equal(low.place, 0, 'not good enough');
  const tie = insertGame(top, entry('tie', 1200));
  assert.equal(tie.place, 2, 'below the older 1,200');
  const named = updateEntry(tie.top, 'tie', { name: 'Anna' });
  assert.equal(named[1].name, 'Anna');
  assert.equal(tie.top[1].name, '', 'the old list is untouched');
});
