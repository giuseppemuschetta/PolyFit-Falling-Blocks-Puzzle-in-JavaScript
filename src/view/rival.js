// The rival: someone else's game, replayed next to yours on the same pieces (a challenge
// link, or Giuseppe's record game). Their board in miniature, their score, and the name of
// their last big move: you see their PolyFit! while you are still building yours.

const format = (n) => Math.round(n).toLocaleString('en-US');
const MOVE_MS = 1800; // how long a move name stays

export class RivalView {
  constructor(renderer, doc = document) {
    this.renderer = renderer;
    this.el = {
      panel: doc.getElementById('rival'),
      name: doc.getElementById('rival-name'),
      score: doc.getElementById('rival-score'),
      move: doc.getElementById('rival-move'),
    };
    this.shown = {};
    this.moveAt = 0;
  }

  show(name) {
    this.el.name.textContent = name;
    this.el.move.textContent = '';
    this.shown = {};
    this.el.panel.hidden = false;
    this.renderer.resize(); // the canvas had no size while hidden
  }

  hide() {
    this.el.panel.hidden = true;
  }

  /** Called at every frame with the rival's game. */
  update(game, now) {
    for (const e of game.drainEvents()) {
      if (e.type === 'lock' && (e.lines > 0 || e.tspin !== 'none') && (e.difficult || e.lines >= 3 || e.combo >= 2 || e.perfectClear)) {
        this.el.move.textContent = e.perfectClear ? 'Perfect clear!' : e.combo >= 2 && !e.difficult ? `Combo ×${e.combo}` : e.name;
        this.moveAt = now;
      }
    }
    if (this.moveAt && now - this.moveAt > MOVE_MS) {
      this.el.move.textContent = '';
      this.moveAt = 0;
    }
    const score = format(game.score);
    if (this.shown.score !== score) {
      this.el.score.textContent = score;
      this.shown.score = score;
    }
    this.renderer.drawRival(game);
  }
}
