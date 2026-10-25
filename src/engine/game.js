// One game of PolyFit: the rules, with no drawing and no keyboard.
//
// The screen and the keyboard talk to this class from the outside:
//   - press(button) and release(button) when the player acts;
//   - tick() 60 times per second to let time pass;
//   - read the state (board, piece, score…) to draw it;
//   - drainEvents() to learn what just happened (a line clear, a T-spin…).
// Keeping the rules apart from the screen means they can run anywhere: in the browser,
// in the tests, and in the browser of whoever opens a challenge link, to check its score.

import { createRandom, createBag } from './random.js';
import { kicksFor, PIECE_TYPES } from './pieces.js';
import { createBoard, cellsOf, fits, isFilled, place, clearFullRows, isEmpty, COLS, HIDDEN_ROWS } from './board.js';
import { scoreLock, SOFT_DROP_POINTS, HARD_DROP_POINTS } from './scoring.js';
import { TICKS_PER_SECOND, ONE_ROW, levelForLines, gravityPerTick } from './speed.js';

export const GAME_SECONDS = 180; // the 3-minute challenge
export const NEXT_COUNT = 5; // pieces shown in the preview

const DAS_TICKS = 10; // a held left/right key starts repeating after ≈ 0.17 s…
const ARR_TICKS = 3; // …then moves one column every 0.05 s
const LOCK_DELAY_TICKS = 30; // 0.5 s on the ground before a piece locks
const MAX_LOCK_RESETS = 15; // moves or turns on the ground that restart that half second
const SOFT_DROP_FACTOR = 20; // soft drop falls 20 times faster than normal
const SPAWN_X = Math.floor((COLS - 4) / 2); // column 3: pieces appear in the middle
const SPAWN_Y = HIDDEN_ROWS - 2; // just above the visible field

// Buttons the player can hold down, and buttons that act once when pressed.
const HOLDABLE = ['left', 'right', 'down'];
export const BUTTONS = [...HOLDABLE, 'hardDrop', 'rotateCW', 'rotateCCW', 'hold'];

export class Game {
  constructor({ seed, seconds = GAME_SECONDS } = {}) {
    this.seed = seed >>> 0;
    this.durationTicks = seconds * TICKS_PER_SECOND;
    this.nextFromBag = createBag(createRandom(this.seed));

    this.board = createBoard();
    this.queue = []; // the pieces still to come; the first NEXT_COUNT are shown
    this.fillQueue();
    this.piece = null; // the falling piece: { type, rotation, x, y }
    this.holdType = null; // the piece kept aside, if any
    this.holdUsed = false; // hold works once per piece

    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.streak = { backToBack: false, combo: -1 };
    this.ticks = 0; // time played, in ticks
    this.state = 'ready'; // 'ready' → 'playing' → 'over'
    this.overReason = null; // 'time' or 'topout'

    // Movement and locking
    this.held = { left: false, right: false, down: false };
    this.shiftDir = 0; // −1 left, +1 right, 0 none: the key that drives auto-repeat
    this.dasTimer = 0;
    this.gravity = 0; // fraction of a row fallen so far, in 1/65536 of a row
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = 0; // the lowest row the piece has reached
    this.lastMoveWasRotation = false; // needed to recognize a T-spin
    this.lastKick = 0; // which kick the last rotation used (0 = none)

    this.events = []; // what happened, for the screen and the sounds
    this.log = []; // every input with its tick: [tick, button, 1 = press / 0 = release]
    this.backToBackChain = 0;
    this.stats = {
      pieces: 0,
      holds: 0,
      // how many of each piece came into play, the falling one included
      dealt: Object.fromEntries(PIECE_TYPES.map((type) => [type, 0])),
      singles: 0,
      doubles: 0,
      triples: 0,
      polyfits: 0,
      tspins: 0,
      perfectClears: 0,
      maxCombo: 0,
      maxBackToBack: 0,
      // where the points came from
      points: { lines: 0, polyfit: 0, tspin: 0, backToBack: 0, combo: 0, perfectClear: 0, drops: 0 },
      timeline: [], // the score at the end of every second
    };
  }

  // ---------------------------------------------------------------- the game's life

  /** Starts the clock and brings in the first piece. */
  start() {
    if (this.state !== 'ready') return;
    this.state = 'playing';
    this.spawn(this.takeNext());
  }

  /** One sixtieth of a second passes. */
  tick() {
    if (this.state !== 'playing') return;
    this.ticks++;
    if (this.ticks % TICKS_PER_SECOND === 0) this.stats.timeline.push(this.score);
    if (this.ticks >= this.durationTicks) {
      this.end('time'); // time is up: the falling piece does not count
      return;
    }
    this.autoShift();
    this.fall();
    if (this.state === 'playing') this.updateLock();
  }

  end(reason) {
    this.state = 'over';
    this.overReason = reason;
    this.piece = null;
    if (this.ticks % TICKS_PER_SECOND !== 0) this.stats.timeline.push(this.score);
    this.events.push({ type: 'over', reason });
  }

  get secondsLeft() {
    return Math.max(0, this.durationTicks - this.ticks) / TICKS_PER_SECOND;
  }

  /** Returns the events since the last call, and forgets them. */
  drainEvents() {
    return this.events.splice(0);
  }

  // ---------------------------------------------------------------- input

  press(button) {
    if (this.state !== 'playing' || !BUTTONS.includes(button)) return;
    if (HOLDABLE.includes(button)) {
      if (this.held[button]) return; // already down: ignore the keyboard's own repeat
      this.held[button] = true;
    }
    this.log.push([this.ticks, button, 1]);

    switch (button) {
      case 'left':
      case 'right':
        // The last direction pressed wins, and moves the piece at once.
        this.shiftDir = button === 'left' ? -1 : 1;
        this.dasTimer = 0;
        this.shift(this.shiftDir);
        break;
      case 'hardDrop':
        this.hardDrop();
        break;
      case 'rotateCW':
        this.rotate(1);
        break;
      case 'rotateCCW':
        this.rotate(-1);
        break;
      case 'hold':
        this.hold();
        break;
      // 'down' only needs this.held.down: fall() reads it at every tick.
    }
  }

  release(button) {
    if (this.state !== 'playing' || !HOLDABLE.includes(button) || !this.held[button]) return;
    this.held[button] = false;
    this.log.push([this.ticks, button, 0]);

    const dir = button === 'left' ? -1 : button === 'right' ? 1 : 0;
    if (dir !== 0 && this.shiftDir === dir) {
      // The key that was moving the piece is up: the other one takes over if still held.
      const other = dir === -1 ? 'right' : 'left';
      this.shiftDir = this.held[other] ? -dir : 0;
      this.dasTimer = 0;
    }
  }

  /** Lets go of every held button (used when the game is paused). */
  releaseAll() {
    for (const button of HOLDABLE) this.release(button);
  }

  // ---------------------------------------------------------------- pieces

  fillQueue() {
    while (this.queue.length <= NEXT_COUNT) this.queue.push(this.nextFromBag());
  }

  /** The first piece of the queue comes into play. It is counted here, once: a piece back from hold is not new. */
  takeNext() {
    const type = this.queue.shift();
    this.fillQueue();
    this.stats.dealt[type]++;
    return type;
  }

  get nextPieces() {
    return this.queue.slice(0, NEXT_COUNT);
  }

  /** Brings a new piece in at the top. If there is no room, the game is over. */
  spawn(type) {
    const piece = { type, rotation: 0, x: SPAWN_X, y: SPAWN_Y };
    if (!fits(this.board, piece)) {
      this.end('topout');
      return;
    }
    // As in the official rules, the piece drops one row at once if it can.
    if (fits(this.board, { ...piece, y: piece.y + 1 })) piece.y++;

    this.piece = piece;
    this.gravity = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lowestY = piece.y;
    this.lastMoveWasRotation = false;
    this.lastKick = 0;
    this.events.push({ type: 'spawn', piece: type });
  }

  hold() {
    if (this.holdUsed || !this.piece) return;
    const current = this.piece.type;
    const incoming = this.holdType ?? this.takeNext();
    this.holdType = current;
    this.holdUsed = true;
    this.stats.holds++;
    this.events.push({ type: 'hold', piece: current });
    this.spawn(incoming);
  }

  /** True if the piece is resting on the floor or on a block. */
  isGrounded() {
    return !fits(this.board, { ...this.piece, y: this.piece.y + 1 });
  }

  /** The row where the piece would land if dropped now (drawn as the "ghost"). */
  ghostY() {
    let y = this.piece.y;
    while (fits(this.board, { ...this.piece, y: y + 1 })) y++;
    return y;
  }

  // ---------------------------------------------------------------- moving and turning

  shift(dir) {
    const moved = { ...this.piece, x: this.piece.x + dir };
    if (!fits(this.board, moved)) return false;
    const wasGrounded = this.isGrounded();
    this.piece = moved;
    this.lastMoveWasRotation = false;
    this.afterManeuver(wasGrounded);
    this.events.push({ type: 'move' });
    return true;
  }

  /** dir = +1 clockwise, −1 counterclockwise. Tries the kicks in order. */
  rotate(dir) {
    const p = this.piece;
    if (p.type === 'O') return false; // the O looks the same in every rotation
    const to = (p.rotation + dir + 4) % 4;
    const kicks = kicksFor(p.type, p.rotation, to);
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      const turned = { type: p.type, rotation: to, x: p.x + dx, y: p.y + dy };
      if (fits(this.board, turned)) {
        const wasGrounded = this.isGrounded();
        this.piece = turned;
        this.lastMoveWasRotation = true;
        this.lastKick = i;
        this.afterManeuver(wasGrounded);
        this.events.push({ type: 'rotate', kick: i });
        return true;
      }
    }
    return false;
  }

  /**
   * A move or turn on the ground restarts the half second before locking,
   * at most 15 times; after that the piece locks as soon as it touches.
   */
  afterManeuver(wasGrounded) {
    if (wasGrounded && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    this.checkLowest();
  }

  /** Reaching a new lowest row gives the piece its full lock delay and 15 resets again. */
  checkLowest() {
    if (this.piece.y > this.lowestY) {
      this.lowestY = this.piece.y;
      this.lockTimer = 0;
      this.lockResets = 0;
    }
  }

  /** Held left or right: after DAS_TICKS the piece moves by itself every ARR_TICKS. */
  autoShift() {
    if (this.shiftDir === 0) return;
    this.dasTimer++;
    if (this.dasTimer >= DAS_TICKS && (this.dasTimer - DAS_TICKS) % ARR_TICKS === 0) {
      this.shift(this.shiftDir);
    }
  }

  /** Gravity: add this tick's fraction of a row, and fall one row for every whole row. */
  fall() {
    const soft = this.held.down;
    this.gravity += gravityPerTick(this.level) * (soft ? SOFT_DROP_FACTOR : 1);
    while (this.gravity >= ONE_ROW) {
      this.gravity -= ONE_ROW;
      const lower = { ...this.piece, y: this.piece.y + 1 };
      if (!fits(this.board, lower)) {
        this.gravity = 0;
        break;
      }
      this.piece = lower;
      this.lastMoveWasRotation = false;
      if (soft) this.addPoints('drops', SOFT_DROP_POINTS);
      this.checkLowest();
    }
  }

  updateLock() {
    if (!this.isGrounded()) return;
    if (this.lockResets >= MAX_LOCK_RESETS) {
      this.lock();
      return;
    }
    this.lockTimer++;
    if (this.lockTimer >= LOCK_DELAY_TICKS) this.lock();
  }

  hardDrop() {
    const fromY = this.piece.y;
    const toY = this.ghostY();
    const rows = toY - fromY;
    if (rows > 0) {
      this.piece = { ...this.piece, y: toY };
      this.lastMoveWasRotation = false;
    }
    this.addPoints('drops', HARD_DROP_POINTS * rows);
    this.events.push({ type: 'hardDrop', piece: { ...this.piece }, fromY, rows });
    this.lock();
  }

  // ---------------------------------------------------------------- locking and scoring

  /**
   * T-spin check, with the "3 corners" rule: the last move of a T was a turn, and at
   * least 3 of the 4 cells diagonal to its center are filled (walls and floor count).
   * Full T-spin if both corners on the side the T points to are filled, or if the turn
   * used the last, longest kick; otherwise it is a Mini.
   */
  detectTSpin() {
    const p = this.piece;
    if (p.type !== 'T' || !this.lastMoveWasRotation) return 'none';
    const cx = p.x + 1;
    const cy = p.y + 1; // the center of the T's 3×3 box
    // top-left, top-right, bottom-right, bottom-left
    const corners = [
      isFilled(this.board, cx - 1, cy - 1),
      isFilled(this.board, cx + 1, cy - 1),
      isFilled(this.board, cx + 1, cy + 1),
      isFilled(this.board, cx - 1, cy + 1),
    ];
    if (corners.filter(Boolean).length < 3) return 'none';
    // The two front corners for each rotation: up, right, down, left.
    const FRONT = [[0, 1], [1, 2], [2, 3], [3, 0]];
    const [a, b] = FRONT[p.rotation];
    if ((corners[a] && corners[b]) || this.lastKick === 4) return 'full';
    return 'mini';
  }

  lock() {
    const piece = this.piece;
    const tspin = this.detectTSpin();
    place(this.board, piece);
    this.piece = null;
    this.stats.pieces++;

    const cleared = clearFullRows(this.board);
    const lines = cleared.length;
    const levelBefore = this.level;
    const result = scoreLock(
      { lines, tspin, perfectClear: lines > 0 && isEmpty(this.board), level: levelBefore },
      this.streak,
    );
    this.streak = result.streak;
    for (const [source, points] of Object.entries(result.parts)) this.addPoints(source, points);
    this.lines += lines;
    this.level = levelForLines(this.lines);
    this.countStats(result, lines);

    this.events.push({
      type: 'lock',
      piece,
      cells: cellsOf(piece),
      cleared,
      lines,
      ...result,
      chain: this.backToBackChain,
      levelUp: this.level > levelBefore ? this.level : 0,
    });
    this.holdUsed = false;

    // Lock out: a piece that locks entirely above the visible field ends the game.
    const lockOut = lines === 0 && cellsOf(piece).every(([, y]) => y < HIDDEN_ROWS);
    if (lockOut) this.end('topout');
    else this.spawn(this.takeNext());
  }

  addPoints(source, points) {
    if (points <= 0) return;
    this.score += points;
    this.stats.points[source] += points;
  }

  countStats(result, lines) {
    const s = this.stats;
    if (result.tspin !== 'none') s.tspins++;
    else if (lines === 1) s.singles++;
    else if (lines === 2) s.doubles++;
    else if (lines === 3) s.triples++;
    else if (lines === 4) s.polyfits++;
    if (result.perfectClear) s.perfectClears++;
    s.maxCombo = Math.max(s.maxCombo, result.combo);
    if (lines > 0) this.backToBackChain = result.backToBack ? this.backToBackChain + 1 : 0;
    s.maxBackToBack = Math.max(s.maxBackToBack, this.backToBackChain);
  }
}

/**
 * Plays a game again from its seed and its input log, and returns it.
 * Same seed + same inputs at the same ticks = same game, to the last point.
 */
export function replay(seed, log, seconds = GAME_SECONDS) {
  const game = new Game({ seed, seconds });
  game.start();
  let i = 0;
  while (game.state === 'playing') {
    while (i < log.length && log[i][0] === game.ticks) {
      const [, button, down] = log[i++];
      if (down) game.press(button);
      else game.release(button);
    }
    game.tick();
    game.events.length = 0;
  }
  return game;
}
