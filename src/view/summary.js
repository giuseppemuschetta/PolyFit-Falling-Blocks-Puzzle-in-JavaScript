// "Your game, analyzed": the results screen at the end of a game.
//
// Everything is built with document.createElement and textContent, never by pasting
// HTML strings, so no text can ever turn into code on the page.

import { TICKS_PER_SECOND } from '../engine/speed.js';

const format = (n) => Math.round(n).toLocaleString('en-US');
const percent = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// The sources of points, in a fixed order with a fixed color each (see --c1… in the CSS):
// a color always means the same thing, whatever the game.
const SOURCES = [
  { key: 'polyfit', label: 'PolyFit!', color: 'var(--c1)' },
  { key: 'tspin', label: 'T-spins', color: 'var(--c2)' },
  { key: 'lines', label: 'Other line clears', color: 'var(--c3)' },
  { key: 'backToBack', label: 'Back-to-back bonus', color: 'var(--c4)' },
  { key: 'combo', label: 'Combos', color: 'var(--c5)' },
  { key: 'perfectClear', label: 'Perfect clears', color: 'var(--c6)' },
  { key: 'drops', label: 'Drops', color: 'var(--c-other)' },
];

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Points scored in each minute, from the score at the end of every second. */
export function pointsPerMinute(timeline) {
  const minutes = [];
  for (let end = 60; end - 60 < timeline.length; end += 60) {
    const last = timeline[Math.min(end, timeline.length) - 1];
    const before = end > 60 ? timeline[end - 61] : 0;
    minutes.push({ points: last - before, seconds: Math.min(60, timeline.length - (end - 60)) });
  }
  return minutes;
}

/** A short, useful remark about the game. */
export function insights(game) {
  const s = game.stats;
  const notes = [];
  const minutes = pointsPerMinute(s.timeline);
  if (minutes.length > 1 && game.score > 0) {
    const best = minutes.reduce((a, b, i) => (b.points > minutes[a].points ? i : a), 0);
    const names = ['first', 'second', 'third'];
    notes.push(
      `Your best minute was the ${names[best] ?? `#${best + 1}`}: ${format(minutes[best].points)} points, ` +
        `${percent(minutes[best].points, game.score)}% of the total.`,
    );
  }
  const pps = s.pieces / Math.max(1, game.ticks / TICKS_PER_SECOND);
  if (s.tspins === 0 && s.polyfits === 0) {
    notes.push('Next time, keep one column free for the I piece: four lines at once score 800 × level.');
  } else if (s.tspins === 0) {
    notes.push('A T-spin Double scores 1,200 × level, half as much again as a PolyFit!: worth learning.');
  } else if (pps < 1) {
    notes.push('Hard drop (Space) saves time and scores 2 points per row.');
  } else {
    notes.push('Chain PolyFit!s and T-spins without plain clears in between: back-to-back pays ×1.5.');
  }
  return notes;
}

export class Summary {
  /**
   * onName(name) as the player types; onShare() and onSend() return a promise of
   * { kind: 'shared' | 'copied' | 'manual' | 'cancelled', link }.
   */
  constructor(root, { onPlayAgain, onLeave, onName, onShare, onSend, projectsUrl, linkedinUrl, record }) {
    this.root = root;
    Object.assign(this, { onPlayAgain, onLeave, onName, onShare, onSend, projectsUrl, linkedinUrl, record });
  }

  hide() {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  /**
   * `place`: the game's place in this device's top 10 (0 = not in it).
   * `challenge`: { name, score, own } when the game answered a challenge.
   * `canSend`: the game beat Giuseppe's record and can go to the Hall of Fame.
   */
  show(game, { best, newBest, place = 0, challenge = null, name = '', canSend = false }) {
    const card = el('div', 'summary-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'summary-title');

    const elapsed = game.ticks / TICKS_PER_SECOND;
    const how = game.overReason === 'time' ? 'Time!' : `Topped out at ${clock(elapsed)}`;
    card.append(el('p', 'eyebrow', `${how} · Your game, analyzed`));

    const title = el('h2', 'final');
    title.id = 'summary-title';
    title.append(el('b', '', format(game.score)), el('span', '', ' points'));
    card.append(title);

    const notes = el('div', 'standing');
    if (challenge) notes.append(this.duel(game, challenge));
    if (newBest) notes.append(el('span', 'badge', 'New personal best!'));
    else if (best) notes.append(el('span', '', `Your best: ${format(best.score)}`));
    if (place > 0) notes.append(el('span', '', `#${place} on this device`));
    if (this.record && !challenge?.own) {
      const gap = this.record.score - game.score;
      notes.append(
        el('span', '', gap < 0
          ? `You beat Giuseppe's record of ${format(this.record.score)}!`
          : gap === 0
            ? `You matched Giuseppe's record of ${format(this.record.score)}!`
            : `Giuseppe's record: ${format(this.record.score)}, ${format(gap)} to go.`),
      );
    }
    if (notes.childElementCount) card.append(notes);
    card.append(this.shareBox(name, canSend));

    card.append(this.statGrid(game, elapsed));
    card.append(this.minuteChart(game));
    card.append(this.sourceChart(game));

    const list = el('ul', 'insights');
    for (const note of insights(game)) list.append(el('li', '', note));
    card.append(list);

    const actions = el('div', 'actions');
    const again = el('button', 'btn primary', challenge ? 'Rematch' : 'Play again');
    again.type = 'button';
    again.append(el('kbd', '', 'Enter'));
    again.addEventListener('click', () => this.onPlayAgain());
    actions.append(again);
    if (challenge) {
      const leave = el('button', 'btn', 'Play with new pieces');
      leave.type = 'button';
      leave.addEventListener('click', () => this.onLeave());
      actions.append(leave);
    }
    const projects = el('a', 'btn', 'See my projects');
    projects.href = this.projectsUrl;
    actions.append(projects);
    card.append(actions);

    this.tooltip = el('div', 'tooltip');
    this.tooltip.hidden = true;
    card.append(this.tooltip);

    this.root.replaceChildren(card);
    this.root.hidden = false;
    again.focus({ preventScroll: true });
  }

  /** "You beat Marco by 2,300 points!" */
  duel(game, { name, score, own }) {
    const gap = game.score - score;
    const them = own ? 'my record game' : name;
    if (gap > 0) return el('span', 'badge', `You beat ${them} by ${format(gap)} points!`);
    if (gap === 0) return el('span', 'badge', `A tie with ${them}!`);
    return el('span', '', `${own ? 'My record game' : name} wins by ${format(-gap)} points.`);
  }

  /** Your name, "Challenge a friend" and, after a record, "Send it to Giuseppe". */
  shareBox(name, canSend) {
    const box = el('div', 'share');
    if (canSend) {
      box.append(el('p', 'share-callout', 'You beat my record! Send me your game: once it replays, your name goes in the Hall of Fame on this page.'));
    }
    const field = el('label', 'name-field');
    const input = el('input');
    Object.assign(input, { type: 'text', value: name, maxLength: 20, autocomplete: 'nickname', spellcheck: false, enterKeyHint: 'done' });
    input.placeholder = 'Shown to your friends';
    input.addEventListener('input', () => this.onName(input.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
    field.append(el('span', '', 'Your name'), input);

    const status = el('div', 'share-status');
    status.setAttribute('aria-live', 'polite');
    const buttons = el('div', 'share-actions');
    const challenge = el('button', 'btn', 'Challenge a friend');
    challenge.type = 'button';
    challenge.addEventListener('click', async () => this.shareStatus(status, await this.onShare(), false));
    buttons.append(challenge);
    if (canSend) {
      const send = el('button', 'btn hl', 'Send it to Giuseppe');
      send.type = 'button';
      send.addEventListener('click', async () => this.shareStatus(status, await this.onSend(), true));
      buttons.prepend(send);
    }
    const row = el('div', 'share-row');
    row.append(field, buttons);
    box.append(row, status, el('p', 'share-note', 'Your name stays in this browser: it travels only inside the links you share.'));
    return box;
  }

  shareStatus(status, { kind, link }, toGiuseppe) {
    status.replaceChildren();
    if (kind === 'cancelled') return;
    const they = 'your friend gets the same pieces, with your game playing next to theirs.';
    if (toGiuseppe) {
      const text = el('p', '', 'Your email app should open with your game inside. ');
      if (kind === 'copied') {
        const linkedin = el('a', '', 'LinkedIn');
        linkedin.href = this.linkedinUrl;
        linkedin.target = '_blank';
        linkedin.rel = 'noopener';
        text.append('The link is copied too, if you prefer ', linkedin, '.');
      }
      status.append(text);
    } else if (kind === 'shared') {
      status.append(el('p', '', `Sent: ${they}`));
    } else if (kind === 'copied') {
      status.append(el('p', '', `Link copied. Paste it in a chat: ${they}`));
    }
    if (kind === 'manual') {
      status.append(el('p', '', 'Copy this link and send it:'));
      const field = el('input', 'link-field');
      Object.assign(field, { type: 'text', value: link, readOnly: true });
      field.setAttribute('aria-label', 'Challenge link');
      field.addEventListener('focus', () => field.select());
      status.append(field);
      field.focus();
    }
  }

  statGrid(game, elapsed) {
    const s = game.stats;
    const pps = s.pieces / Math.max(1, elapsed);
    const tiles = [
      ['Lines', format(game.lines)],
      ['Level', String(game.level)],
      ['PolyFit!', format(s.polyfits)],
      ['T-spins', format(s.tspins)],
      ['Longest combo', s.maxCombo > 0 ? `×${s.maxCombo}` : '–'],
      ['Back-to-back chain', s.maxBackToBack > 0 ? `×${s.maxBackToBack}` : '–'],
      ['Perfect clears', format(s.perfectClears)],
      ['Pieces per second', pps.toFixed(2)],
    ];
    const grid = el('dl', 'stat-grid');
    for (const [label, value] of tiles) {
      const tile = el('div', 'tile');
      tile.append(el('dt', '', label), el('dd', '', value));
      grid.append(tile);
    }
    return grid;
  }

  /** One horizontal bar per minute, value at the tip. */
  minuteChart(game) {
    const minutes = pointsPerMinute(game.stats.timeline);
    const max = Math.max(1, ...minutes.map((m) => m.points));
    const figure = el('figure', 'chart');
    figure.append(el('figcaption', '', 'Points minute by minute'));
    const rows = el('div', 'bars');
    const elapsed = Math.floor(game.ticks / TICKS_PER_SECOND);
    minutes.forEach((m, i) => {
      const seconds = Math.min(60, elapsed - i * 60);
      const label = seconds < 60 ? `Minute ${i + 1} (${seconds} s)` : `Minute ${i + 1}`;
      rows.append(el('span', 'bar-label', label));
      const track = el('div', 'bar-track');
      const bar = el('div', 'bar');
      bar.style.width = `${Math.max(0.5, (m.points / max) * 100)}%`;
      this.hover(bar, `${format(m.points)} points`, `${label} · ${percent(m.points, game.score)}% of the total`);
      track.append(bar, el('span', 'bar-value', format(m.points)));
      rows.append(track);
    });
    figure.append(rows);
    return figure;
  }

  /** One stacked bar: where the points came from, with its legend as a small table. */
  sourceChart(game) {
    const points = game.stats.points;
    const total = Math.max(1, game.score);
    const used = SOURCES.filter((source) => points[source.key] > 0);
    const figure = el('figure', 'chart');
    figure.append(el('figcaption', '', 'Where your points came from'));
    if (used.length === 0) {
      figure.append(el('p', 'empty', 'No points this time: the next game will fill this in.'));
      return figure;
    }

    const stack = el('div', 'stack');
    for (const source of used) {
      const part = el('div', 'segment');
      part.style.flexGrow = String(points[source.key]);
      part.style.background = source.color;
      this.hover(part, `${format(points[source.key])} points`, `${source.label} · ${percent(points[source.key], total)}%`);
      stack.append(part);
    }
    figure.append(stack);

    const table = el('table', 'legend');
    const body = el('tbody');
    for (const source of used) {
      const row = el('tr');
      const name = el('th', '');
      name.scope = 'row';
      const swatch = el('i', 'swatch');
      swatch.style.background = source.color;
      name.append(swatch, document.createTextNode(source.label));
      row.append(name, el('td', '', format(points[source.key])), el('td', 'share', `${percent(points[source.key], total)}%`));
      body.append(row);
    }
    table.append(body);
    figure.append(table);
    return figure;
  }

  /** A tooltip on hover and on keyboard focus; the same values are in the labels and the table. */
  hover(mark, value, label) {
    mark.tabIndex = 0;
    mark.setAttribute('role', 'img');
    mark.setAttribute('aria-label', `${label}: ${value}`);
    const show = () => {
      const tip = this.tooltip;
      tip.replaceChildren(el('b', '', value), el('span', '', label));
      tip.hidden = false;
      const card = this.root.querySelector('.summary-card').getBoundingClientRect();
      const box = mark.getBoundingClientRect();
      const x = Math.min(Math.max(box.left + box.width / 2 - card.left, 90), card.width - 90);
      tip.style.left = `${x}px`;
      tip.style.top = `${box.top - card.top - 8}px`;
      mark.classList.add('active');
    };
    const hide = () => {
      this.tooltip.hidden = true;
      mark.classList.remove('active');
    };
    mark.addEventListener('pointerenter', show);
    mark.addEventListener('pointerleave', hide);
    mark.addEventListener('focus', show);
    mark.addEventListener('blur', hide);
  }
}

function clock(seconds) {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
