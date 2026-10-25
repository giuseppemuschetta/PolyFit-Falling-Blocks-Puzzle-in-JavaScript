// PolyFit starts here. This file connects the pieces: the rules (engine/), the screen
// (view/), the controls (input/), the sound (audio/) and the links (share/), and runs the
// main loop.
//
// The app moves through these modes:
//   intro → countdown → playing ⇄ paused → over → (Play again) countdown → …
//   intro or over → watching (a recorded game plays on the board) → intro
// A challenge link (…/challenge/#c=…) turns the next games into a duel: the same pieces
// as the challenger, whose game is replayed next to the board, tick by tick.

import { Game, replay } from './engine/game.js';
import { Replayer } from './engine/replayer.js';
import { randomSeed } from './engine/random.js';
import { TICKS_PER_SECOND } from './engine/speed.js';
import { Renderer } from './view/renderer.js';
import { Hud } from './view/hud.js';
import { DealtView } from './view/dealt.js';
import { Summary } from './view/summary.js';
import { RivalView } from './view/rival.js';
import { Boards } from './view/boards.js';
import { attachKeyboard } from './input/keyboard.js';
import { attachTouch, attachButtons } from './input/touch.js';
import { Sound } from './audio/sound.js';
import { Music } from './audio/music.js';
import { load, save } from './storage.js';
import { loadTop, saveTop, insertGame, updateEntry, loadName, saveName } from './records.js';
import { encodeGame, decodeGame, linkFor, gameFrom, fingerprint, cleanName } from './share/link.js';
import { checkHall } from './share/hall.js';
import { startCounting, track } from './analytics.js';
import { RECORD, RECORD_LINK, PROJECTS_URL, EMAIL, LINKEDIN_URL } from './config.js';
import { HALL_OF_FAME } from './hall-of-fame.js';

const STEP_MS = 1000 / TICKS_PER_SECOND; // one tick of the rules
const MAX_CATCH_UP_MS = 250; // after a freeze, never run more than this in one go
const SPEEDS = [1, 2, 4]; // replay speeds
const HURRY = { seconds: 30, tempo: 1.15 }; // the music speeds up for the last 30 seconds
const $ = (id) => document.getElementById(id);
const format = (n) => n.toLocaleString('en-US');
const today = () => new Date().toISOString().slice(0, 10);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const app = {
  mode: 'intro',
  game: new Game({ seed: randomSeed() }), // a game that has not started: empty board, pieces ready
  countdown: null,
  lastTime: 0,
  pending: 0, // milliseconds of play not yet turned into ticks
  settings: { sound: false, music: false, marks: true, ...load('settings', {}) },
  best: load('best', null),
  top: loadTop(), // this device's top 10
  name: cleanName(loadName()),
  bestGame: null, // the device's best game ({ seed, log }): what "vs your best" counts against
  challenge: null, // the game of a challenge link: { seed, log, name, date, score, own }
  linkProblem: null, // why a challenge link did not open
  rival: null, // the challenger's game, replayed in step with the player's
  pacer: null, // the game the gap is counted against: the rival, or the best game
  against: [], // its name in "+1,240 vs …", long and short
  watch: null, // { replayer, name, speed, over } while a recorded game plays on the board
  last: null, // the game just finished: { game, id, date, place, link }
};

const renderer = new Renderer({ board: $('board'), hold: $('hold'), next: $('next'), rival: $('rival-board'), dealt: $('dealt-shapes') });
const hud = new Hud();
const dealtView = new DealtView();
const sound = new Sound();
const music = new Music();
const rivalView = new RivalView(renderer);
const summary = new Summary($('summary'), {
  onPlayAgain: () => newGame(),
  onLeave: () => leaveChallenge(true),
  onName: (name) => setName(name),
  onShare: () => shareGame(),
  onSend: () => sendToGiuseppe(),
  projectsUrl: PROJECTS_URL,
  linkedinUrl: LINKEDIN_URL,
  record: RECORD,
});
const boards = new Boards({ onWatch: (game, name) => watch(game, name), onClear: () => clearTop(), record: RECORD });

// ---------------------------------------------------------------- the main loop

function frame(now) {
  requestAnimationFrame(frame);
  if (app.countdown) updateCountdown(now);

  const game = app.game;
  if (app.mode === 'playing' || app.mode === 'watching') {
    // Turn the real time that passed into fixed ticks of 1/60 s each.
    const speed = app.watch?.speed ?? 1;
    app.pending = Math.min(app.pending + (now - app.lastTime) * speed, MAX_CATCH_UP_MS * speed);
    app.lastTime = now;
    while (app.pending >= STEP_MS && game.state === 'playing') {
      if (app.watch) app.watch.replayer.advanceTo(game.ticks + 1);
      else game.tick();
      app.pending -= STEP_MS;
    }
    // The rival and the best game move in step with the player: same tick, same moment.
    if (!app.watch) app.pacer?.advanceTo(game.ticks);
  }

  react(game.drainEvents(), now);
  if (app.rival) rivalView.update(app.rival.game, now);
  else app.pacer?.game.drainEvents();
  if (app.mode === 'playing' && game.state === 'over') finish();
  if (app.watch && !app.watch.over && game.state === 'over') watchOver();
  // the music plays only while the clock runs: it stops for the pause and at the end
  music.update(app.mode === 'playing' && game.state === 'playing', game.secondsLeft < HURRY.seconds ? HURRY.tempo : 1);

  renderer.draw(game, now, { hidden: app.mode === 'paused', faded: app.mode === 'over' || Boolean(app.watch?.over) });
  hud.update(game);
  dealtView.update(game, now);
  hud.pace(app.pacer && !app.watch && game.state !== 'ready' ? game.score - app.pacer.game.score : null, app.against);
}

/** Effects, sounds and popups for what just happened in the game. */
function react(events, now) {
  let dropped = false;
  for (const e of events) {
    switch (e.type) {
      case 'move':
        sound.play('move');
        break;
      case 'rotate':
        sound.play('rotate');
        break;
      case 'hold':
        sound.play('hold');
        break;
      case 'hardDrop':
        dropped = true;
        renderer.addEffect('drop', e, now);
        sound.play('drop');
        break;
      case 'lock':
        renderer.addEffect('lock', { cells: e.cells }, now);
        if (e.lines > 0) renderer.addEffect('clear', { rows: e.cleared }, now);
        if (e.lines > 0 || e.tspin !== 'none') sound.play('clear', e);
        else if (!dropped) sound.play('lock');
        hud.announce(e);
        if (e.levelUp) {
          hud.levelUp(e.levelUp);
          renderer.addEffect('level', {}, now);
          sound.play('level');
        }
        break;
      case 'over':
        sound.play('over');
        break;
    }
  }
}

// ---------------------------------------------------------------- modes

/** Shows a sequence like 3, 2, 1, Go! and calls `then` when the label at `fireAt` appears. */
function startCountdown(labels, stepMs, fireAt, then) {
  app.mode = 'countdown';
  app.countdown = { labels, stepMs, fireAt, then, start: performance.now(), shown: -1, fired: false };
  $('countdown').hidden = false;
}

function updateCountdown(now) {
  const c = app.countdown;
  const i = Math.floor((now - c.start) / c.stepMs);
  if (i >= c.fireAt && !c.fired) {
    c.fired = true;
    c.then(now);
  }
  if (i >= c.labels.length) {
    app.countdown = null;
    $('countdown').hidden = true;
    return;
  }
  if (i !== c.shown) {
    c.shown = i;
    const count = $('count');
    count.textContent = c.labels[i];
    count.classList.toggle('go', c.labels[i] === 'Go!');
    // restart the CSS animation for every number
    count.style.animation = 'none';
    void count.offsetWidth;
    count.style.animation = '';
    sound.play(c.labels[i] === 'Go!' ? 'go' : 'count');
  }
}

function stopCountdown() {
  app.countdown = null;
  $('countdown').hidden = true;
}

/** The rival's panel, shown during a duel (and the replay bar while watching): phones make room for it. */
function showSidePanels({ rival = null, watching = false }) {
  if (rival) rivalView.show(rival);
  else rivalView.hide();
  $('watchbar').hidden = !watching;
  $('stage').classList.toggle('with-rival', Boolean(rival) || watching);
}

function newGame() {
  app.watch = null;
  summary.hide();
  $('intro').hidden = true;
  $('paused').hidden = true;
  stopCountdown();
  const c = app.challenge;
  app.game = new Game({ seed: c ? c.seed : randomSeed() });
  app.rival = c ? new Replayer(c.seed, c.log) : null;
  app.pacer = app.rival ?? (app.bestGame ? new Replayer(app.bestGame.seed, app.bestGame.log) : null);
  app.against = c ? [c.own ? 'my record' : c.name, 'rival'] : ['your best', 'best'];
  showSidePanels({ rival: c ? (c.own ? 'Giuseppe' : c.name) : null });
  hud.reset();
  renderer.effects = [];
  music.reset();
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  startCountdown(['3', '2', '1', 'Go!'], 600, 3, (now) => {
    app.game.start();
    app.mode = 'playing';
    app.lastTime = now;
    app.pending = 0;
    track('start');
    if (c) track(c.own ? 'race-start' : 'challenge-start');
  });
}

function pause() {
  const resuming = app.mode === 'countdown' && app.game.state === 'playing';
  if (app.mode !== 'playing' && !resuming) return;
  stopCountdown();
  app.game.releaseAll();
  app.mode = 'paused';
  $('paused').hidden = false;
  $('resume-btn').focus({ preventScroll: true });
}

function resume() {
  if (app.mode !== 'paused') return;
  $('paused').hidden = true;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  startCountdown(['3', '2', '1'], 450, 3, (now) => {
    app.mode = 'playing';
    app.lastTime = now;
    app.pending = 0;
  });
}

function finish() {
  app.mode = 'over';
  const game = app.game;
  hud.banner(game.overReason === 'time' ? 'Time!' : 'Topped out');
  const date = today();
  const newBest = game.score > 0 && game.score > (app.best?.score ?? 0);
  if (newBest) {
    app.best = { score: game.score, lines: game.lines, level: game.level, date };
    save('best', app.best);
  }

  // Into this device's top 10, if good enough; the game itself is packed for Watch and for "vs your best".
  const id = fingerprint(game.seed, game.log);
  let place = 0;
  if (game.score > 0) {
    const entry = { id, name: app.name, score: game.score, lines: game.lines, level: game.level, date, code: null };
    ({ top: app.top, place } = insertGame(app.top, entry));
    if (place) saveTop(app.top);
  }
  const packed = encodeGame({ seed: game.seed, log: game.log, date })
    .then((code) => {
      if (!place) return;
      app.top = updateEntry(app.top, id, { code });
      saveTop(app.top);
      boards.showLocal(app.top, id);
      if (app.top[0].id === id) app.bestGame = { seed: game.seed, log: game.log };
    })
    .catch(() => {});
  app.last = { game, id, date, place, link: null };
  prepareLink();
  showIntroTexts();
  boards.showLocal(app.top, id);
  track('end');

  Promise.all([packed, wait(1200)]).then(() => {
    if (app.mode !== 'over' || app.game !== game) return;
    const c = app.challenge;
    summary.show(game, {
      best: app.best,
      newBest,
      place,
      name: app.name,
      challenge: c && { name: c.name, score: c.score, own: c.own },
      canSend: Boolean(RECORD) && game.score > RECORD.score,
    });
  });
}

function command(name) {
  const { mode } = app;
  switch (name) {
    case 'confirm':
      if (mode === 'intro' || mode === 'over') newGame();
      else if (mode === 'paused') resume();
      else if (mode === 'watching') stopWatching();
      break;
    case 'pause':
      if (mode === 'watching') stopWatching();
      else if (mode === 'paused') resume();
      else pause();
      break;
    case 'restart':
      if (mode === 'paused' || mode === 'over') newGame();
      break;
    case 'sound':
      setSound(!app.settings.sound);
      break;
    case 'music':
      setMusic(!app.settings.music);
      break;
  }
}

/** Back to the start screen, with an empty board under it. */
function backToIntro() {
  app.watch = null;
  summary.hide();
  stopCountdown();
  $('paused').hidden = true;
  app.mode = 'intro';
  app.game = new Game({ seed: randomSeed() });
  app.rival = null;
  app.pacer = null;
  showSidePanels({});
  hud.reset();
  renderer.effects = [];
  showIntroTexts();
  $('intro').hidden = false;
}

// ---------------------------------------------------------------- challenges

/** Opens the game of a challenge link: the next games are played on its pieces, against it. */
async function openChallenge(text, own = false) {
  try {
    const game = await decodeGame(text);
    const played = replay(game.seed, game.log); // the score comes from the moves, never from the link
    app.challenge = { ...game, name: own ? 'Giuseppe' : game.name || 'A friend', score: played.score, own };
    app.linkProblem = null;
    if (own && RECORD && played.score !== RECORD.score) console.warn(`RECORD_LINK replays to ${played.score}, RECORD says ${RECORD.score}`);
    track(own ? 'race-open' : 'challenge-open');
  } catch (error) {
    app.challenge = null;
    app.linkProblem = error.reason ?? 'damaged';
  }
  showIntroTexts();
}

function leaveChallenge(start = false) {
  app.challenge = null;
  app.linkProblem = null;
  if (gameFrom(location.href)) history.replaceState(null, '', location.pathname + location.search);
  showIntroTexts();
  if (start) newGame();
}

async function raceRecord() {
  await openChallenge(gameFrom(RECORD_LINK), true);
  if (app.challenge) newGame();
}

/** This page's address, without "?" or "#": challenge links start with it. */
function pageAddress() {
  return location.origin + location.pathname;
}

/** Packs the finished game with the current name into its link, ahead of any click. */
function prepareLink() {
  const last = app.last;
  const name = app.name;
  last.link = null;
  last.pending = encodeGame({ seed: last.game.seed, log: last.game.log, name, date: last.date }).then((text) => {
    const link = linkFor(text, pageAddress());
    if (app.last === last && app.name === name) last.link = link;
    return link;
  });
  return last.pending;
}

function setName(text) {
  app.name = cleanName(text);
  saveName(app.name);
  const last = app.last;
  if (!last) return;
  if (last.place) {
    app.top = updateEntry(app.top, last.id, { name: app.name });
    saveTop(app.top);
    boards.showLocal(app.top, last.id);
  }
  last.link = null;
  clearTimeout(setName.timer);
  setName.timer = setTimeout(prepareLink, 150);
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** "Challenge a friend": the share sheet on phones, the clipboard elsewhere. */
async function shareGame() {
  // A ready link keeps the click's permission to share or copy: no waiting before it.
  const link = app.last.link ?? (await prepareLink());
  track('challenge-made');
  const text = `I scored ${format(app.last.game.score)} points on PolyFit, Giuseppe Muschetta's 3-minute challenge. Same pieces, your turn:`;
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'PolyFit challenge', text, url: link });
      return { kind: 'shared', link };
    } catch (error) {
      if (error.name === 'AbortError') return { kind: 'cancelled', link };
    }
  }
  return { kind: (await copy(link)) ? 'copied' : 'manual', link };
}

/** "Send it to Giuseppe": an email with the game inside, and the link copied as well. */
async function sendToGiuseppe() {
  const link = app.last.link ?? (await prepareLink());
  const copied = copy(link);
  const body = [
    'Hi Giuseppe,',
    '',
    `I scored ${format(app.last.game.score)} points on PolyFit. Here is my game, ready to replay:`,
    link,
    '',
    `Please add me to the Hall of Fame as: ${app.name || '(your name here)'}`,
  ].join('\n');
  location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('I beat your PolyFit record')}&body=${encodeURIComponent(body)}`;
  track('sent');
  return { kind: (await copied) ? 'copied' : 'manual', link };
}

// ---------------------------------------------------------------- watching a recorded game

/** Plays a recorded game on the board: `game` is { seed, log } or a packed game. */
async function watch(game, name) {
  if (app.mode !== 'intro' && app.mode !== 'over') return;
  if (typeof game === 'string') {
    try {
      game = await decodeGame(game);
    } catch {
      return;
    }
  }
  summary.hide();
  stopCountdown();
  $('intro').hidden = true;
  const replayer = new Replayer(game.seed, game.log);
  app.watch = { replayer, game, name, speed: 1, over: false };
  app.game = replayer.game;
  app.rival = null;
  app.pacer = null;
  showSidePanels({ watching: true });
  $('watch-name').textContent = name;
  setSpeed(1);
  $('watch-again').hidden = true;
  hud.reset();
  renderer.effects = [];
  app.mode = 'watching';
  app.lastTime = performance.now();
  app.pending = 0;
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
  track('watch');
}

function watchOver() {
  app.watch.over = true;
  hud.banner(`${format(app.game.score)} points`);
  $('watch-again').hidden = false;
}

function stopWatching() {
  if (app.watch) backToIntro();
}

function setSpeed(speed) {
  if (!app.watch) return;
  app.watch.speed = speed;
  $('watch-speed').textContent = `${speed}×`;
}

$('watch-speed').addEventListener('click', () => {
  if (app.watch) setSpeed(SPEEDS[(SPEEDS.indexOf(app.watch.speed) + 1) % SPEEDS.length]);
});
$('watch-again').addEventListener('click', () => {
  const w = app.watch;
  if (!w) return;
  app.mode = 'intro'; // watch() starts from the start screen or the end of a game
  watch(w.game, w.name).then(() => setSpeed(w.speed));
});
$('watch-stop').addEventListener('click', () => stopWatching());

// ---------------------------------------------------------------- the leaderboards

function clearTop() {
  app.top = [];
  saveTop(app.top);
  app.best = null;
  save('best', null);
  app.bestGame = null;
  boards.showLocal(app.top);
  showIntroTexts();
}

/** The best game of this device, unpacked once: the reference for "vs your best". */
async function loadBestGame() {
  const code = app.top[0]?.code;
  if (!code) return;
  try {
    const game = await decodeGame(code);
    app.bestGame = { seed: game.seed, log: game.log };
  } catch {
    app.bestGame = null;
  }
}

/** Resolves when nobody is playing: the Hall of Fame is checked between games, never during one. */
function notPlaying() {
  return new Promise((resolve) => {
    const check = () => (app.mode === 'playing' || app.mode === 'countdown' ? setTimeout(check, 400) : setTimeout(resolve, 0));
    check();
  });
}

// ---------------------------------------------------------------- controls

const tap = (button) => {
  app.game.press(button);
  app.game.release(button);
};

attachKeyboard({
  onPress: (button) => {
    if (app.mode === 'playing') app.game.press(button);
  },
  onRelease: (button) => app.game.release(button),
  onCommand: command,
  capturing: () => ['countdown', 'playing', 'paused'].includes(app.mode),
});

attachTouch($('well'), {
  tap,
  press: (button) => app.game.press(button),
  release: (button) => app.game.release(button),
  cellSize: () => renderer.cell,
  active: () => app.mode === 'playing',
});

attachButtons(document.querySelectorAll('.pad'), (button) => {
  if (button === 'pause') command('pause');
  else if (app.mode === 'playing') tap(button);
});

$('play-btn').addEventListener('click', () => newGame());
$('resume-btn').addEventListener('click', () => resume());
$('restart-btn').addEventListener('click', () => newGame());
$('watch-btn').addEventListener('click', () => {
  const c = app.challenge;
  if (c) watch(c, c.own ? 'my record game' : c.name);
  else if (RECORD_LINK) watch(gameFrom(RECORD_LINK), 'my record game');
});
$('leave-btn').addEventListener('click', () => leaveChallenge(true));
$('race-btn').addEventListener('click', () => raceRecord());

// Leaving the tab or the window pauses the game: the clock must never run unseen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
});
window.addEventListener('blur', () => pause());

// A challenge link pasted into the address bar of an open page.
window.addEventListener('hashchange', async () => {
  const text = gameFrom(location.href);
  if (!text || (app.mode !== 'intro' && app.mode !== 'over')) return;
  await openChallenge(text);
  backToIntro();
});

// ---------------------------------------------------------------- settings

function setSound(on) {
  app.settings.sound = on;
  save('settings', app.settings);
  sound.setEnabled(on);
  const btn = $('sound-btn');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Sound on' : 'Sound off';
}

function setMusic(on) {
  app.settings.music = on;
  save('settings', app.settings);
  music.setEnabled(on);
  const btn = $('music-btn');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Music on' : 'Music off';
}

function setMarks(on) {
  app.settings.marks = on;
  save('settings', app.settings);
  renderer.showMarks = on;
  const btn = $('marks-btn');
  btn.setAttribute('aria-pressed', String(on));
  btn.textContent = on ? 'Piece marks on' : 'Piece marks off';
}

$('sound-btn').addEventListener('click', () => setSound(!app.settings.sound));
$('music-btn').addEventListener('click', () => setMusic(!app.settings.music));
$('marks-btn').addEventListener('click', () => setMarks(!app.settings.marks));

// The same light / dark switch as the website, stored under the same key.
$('theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme
    ? root.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try {
    localStorage.setItem('theme', root.dataset.theme);
  } catch {
    // not remembered, still switched
  }
  renderer.refreshTheme();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => renderer.refreshTheme());

// ---------------------------------------------------------------- start screen

const DEFAULT_TITLE = [...$('intro-title').childNodes].map((node) => node.cloneNode(true));
const DEFAULT_EYEBROW = $('intro-eyebrow').textContent;
const DEFAULT_LEDE = $('intro-lede').textContent;
const LINK_PROBLEMS = {
  damaged: 'This challenge link is damaged or incomplete: you play with new pieces.',
  old: 'This challenge link comes from an older version of the rules and cannot be replayed.',
  browser: 'This browser is too old to open challenge links: update it to accept this one.',
};

/** The start screen: the plain challenge, or the duel a link brought, with the scores to beat. */
function showIntroTexts() {
  const c = app.challenge;
  const em = (text) => Object.assign(document.createElement('em'), { textContent: text });
  const bold = (text) => Object.assign(document.createElement('b'), { textContent: text });

  $('intro-eyebrow').textContent = c ? (c.own ? 'Race my record game' : 'A challenge for you') : DEFAULT_EYEBROW;
  const title = $('intro-title');
  // no-break spaces keep the last two words together on narrow screens
  if (c) title.replaceChildren(...(c.own ? ['Beat me, ', em('piece by\u00a0piece.')] : [`${c.name} `, em('challenges\u00a0you.')]));
  else if (RECORD) title.replaceChildren('Beat my\u00a0', em('record.'));
  else title.replaceChildren(...DEFAULT_TITLE.map((node) => node.cloneNode(true)));
  $('intro-lede').textContent = !c
    ? DEFAULT_LEDE
    : c.own
      ? `The same pieces I had, in the same order, with my game playing next to yours: ${format(c.score)} points to beat.`
      : `${format(c.score)} points in three minutes. The same pieces, in the same order, with their game playing next to yours.`;

  const note = $('intro-note');
  note.textContent = c ? '✓ Verified: replayed in your browser, move by move.' : (LINK_PROBLEMS[app.linkProblem] ?? '');
  note.hidden = !note.textContent;
  note.classList.toggle('warn', !c && Boolean(app.linkProblem));

  const record = $('intro-record');
  record.hidden = !RECORD || Boolean(c);
  if (RECORD) record.replaceChildren("Giuseppe's record:\u00a0", bold(format(RECORD.score)));
  const best = $('intro-best');
  best.hidden = !app.best;
  if (app.best) best.replaceChildren('Your best:\u00a0', bold(format(app.best.score)));

  $('play-label').textContent = c ? 'Accept' : 'Play';
  // in a duel, the challenger's game; otherwise, when there is one, Giuseppe's record game
  $('watch-btn').hidden = !c && !RECORD_LINK;
  $('watch-btn').textContent = c ? (c.own ? 'Watch my game' : 'Watch their game') : 'Watch my record game';
  $('leave-btn').hidden = !c;
  $('race-btn').hidden = Boolean(c) || !RECORD_LINK;
  $('intro-more').hidden = $('watch-btn').hidden && $('leave-btn').hidden && $('race-btn').hidden;
}

// ---------------------------------------------------------------- go

// Sound and music need a user action before they can play: the saved choices are applied
// now and take effect with the first click or key press.
setSound(app.settings.sound);
setMusic(app.settings.music);
setMarks(app.settings.marks);
showIntroTexts();
startCounting();
if (matchMedia('(max-width: 760px)').matches) $('scoring').open = false;

const linked = gameFrom(location.href);
if (linked) openChallenge(linked);
loadBestGame();
boards.showLocal(app.top);
boards.showHall(HALL_OF_FAME.length ? null : []);
if (HALL_OF_FAME.length) checkHall(HALL_OF_FAME, { pause: notPlaying }).then((rows) => boards.showHall(rows));

const resized = new ResizeObserver(() => renderer.resize());
resized.observe($('well'));
resized.observe($('rival-board'));
window.addEventListener('resize', () => renderer.resize());
document.fonts?.ready.then(() => renderer.resize());

// With ?debug in the address, the app is reachable from the browser console for checks.
if (new URLSearchParams(location.search).has('debug')) window.polyfit = app;

requestAnimationFrame(frame);
