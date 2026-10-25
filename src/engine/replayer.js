// Plays a recorded game again, step by step, in time with another one: the rival next to
// the player's board, the "vs your best" count, and the games shown with Watch.
//
// replay() in game.js plays a whole game at once; a Replayer stops wherever it is told to,
// so a recorded game can run at the same pace as the one being played.

import { Game } from './game.js';

export class Replayer {
  constructor(seed, log, seconds) {
    this.game = new Game({ seed, seconds });
    this.log = log;
    this.next = 0; // the first input not yet given to the game
    this.game.start();
    this.applyInputs();
  }

  /** Plays on until the game has run `ticks` ticks, or has ended. */
  advanceTo(ticks) {
    const game = this.game;
    while (game.state === 'playing' && game.ticks < ticks) {
      game.tick();
      this.applyInputs();
    }
  }

  /** The inputs the player gave after the current tick, before the next one: as in replay(). */
  applyInputs() {
    const { game, log } = this;
    while (this.next < log.length && log[this.next][0] === game.ticks) {
      const [, button, down] = log[this.next++];
      if (down) game.press(button);
      else game.release(button);
    }
  }
}
