// The numbers around the board (score, time, level, lines, the gap to a reference game)
// and the move names that pop up over it ("PolyFit!", "T-spin Double", "Combo ×3"…).

const format = (n) => Math.round(n).toLocaleString('en-US');

/** 179.4 s → "2:59"; under 10 seconds → "9.4" */
export function formatClock(seconds) {
  if (seconds < 10) return seconds.toFixed(1);
  const whole = Math.ceil(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export class Hud {
  constructor(doc = document) {
    this.el = {
      score: doc.getElementById('score'),
      time: doc.getElementById('time'),
      level: doc.getElementById('level'),
      lines: doc.getElementById('lines'),
      timePanel: doc.getElementById('time-stat'),
      pace: doc.getElementById('pace'),
      popups: doc.getElementById('popups'),
      live: doc.getElementById('live'),
    };
    this.shown = {}; // what is on screen now, to touch the page only when something changes
    this.displayScore = 0;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  reset() {
    this.displayScore = 0;
    this.el.popups.replaceChildren();
  }

  /** Called at every frame. */
  update(game) {
    // The score counts up quickly instead of jumping.
    const gap = game.score - this.displayScore;
    this.displayScore = this.reducedMotion || Math.abs(gap) < 2 ? game.score : this.displayScore + gap * 0.25;
    this.set('score', format(this.displayScore));
    this.set('level', String(game.level));
    this.set('lines', String(game.lines));
    const left = game.state === 'ready' ? game.durationTicks / 60 : game.secondsLeft;
    this.set('time', formatClock(left));
    const hurry = game.state === 'playing' && left < 10;
    if (this.shown.hurry !== hurry) {
      this.el.timePanel.classList.toggle('hurry', hurry);
      this.shown.hurry = hurry;
    }
  }

  /**
   * The gap to another game at the same moment, like the split times of a race:
   * "+1,240 vs your best". `against` is [long, short] (the short one for phones); `gap` null hides it.
   */
  pace(gap, [long, short] = []) {
    const number = gap === null ? '' : `${gap > 0 ? '+' : gap < 0 ? '−' : '±'}${format(Math.abs(gap))}`;
    const key = `${number} ${long}`;
    if (this.shown.pace === key) return;
    const pace = this.el.pace;
    const words = (className, text) => Object.assign(document.createElement('span'), { className, textContent: ` vs ${text}` });
    pace.replaceChildren(...(gap === null ? [] : [number, words('long', long), words('short', short)]));
    pace.hidden = gap === null;
    pace.classList.toggle('ahead', gap > 0);
    pace.classList.toggle('behind', gap < 0);
    this.shown.pace = key;
  }

  set(name, text) {
    if (this.shown[name] === text) return;
    this.el[name].textContent = text;
    this.shown[name] = text;
  }

  /** The popup for a locked piece, when it did something worth naming. */
  announce(lock) {
    const worthy = lock.lines > 0 || lock.tspin !== 'none';
    if (!worthy) return;
    const tags = [];
    if (lock.backToBack) tags.push('Back-to-back ×1.5');
    if (lock.combo > 0) tags.push(`Combo ×${lock.combo}`);
    if (lock.perfectClear) tags.push('Perfect clear!');
    const big = lock.difficult || lock.perfectClear || lock.lines >= 3;
    this.popup({ title: lock.name, tags, points: lock.points, big, special: lock.lines === 4 });
    this.say([lock.name, ...tags, `+${format(lock.points)}`].join(', '));
  }

  levelUp(level) {
    this.popup({ title: `Level ${level}`, tags: ['Faster now'], points: 0, kind: 'level' });
  }

  /** Big text in the middle of the board: "Time!", "Topped out". */
  banner(text) {
    this.popup({ title: text, tags: [], points: 0, kind: 'banner' });
    this.say(text);
  }

  popup({ title, tags, points, big = false, special = false, kind = 'move' }) {
    const box = document.createElement('div');
    box.className = `popup ${kind}${big ? ' big' : ''}${special ? ' special' : ''}`;
    const name = document.createElement('b');
    name.textContent = title;
    box.append(name);
    for (const tag of tags) {
      const t = document.createElement('span');
      t.textContent = tag;
      box.append(t);
    }
    if (points > 0) {
      const p = document.createElement('i');
      p.textContent = `+${format(points)}`;
      box.append(p);
    }
    // Keep at most two popups on screen; the newest goes on top.
    while (this.el.popups.children.length >= 2) this.el.popups.lastElementChild.remove();
    this.el.popups.prepend(box);
    box.addEventListener('animationend', () => box.remove());
  }

  /** Text for screen readers only. */
  say(text) {
    this.el.live.textContent = text;
  }
}
