// The pieces so far: how many of each shape came into play, next to the shape itself
// (drawn by the renderer). With the bag of seven, the counts never drift more than one apart.
// Built with textContent only, like the rest of the page.

import { PIECE_TYPES } from '../engine/pieces.js';

const FLASH_MS = 500; // the count of the piece just dealt lights up for a moment

export class DealtView {
  constructor(doc = document) {
    this.total = doc.getElementById('dealt-total');
    this.counts = {};
    this.shown = {}; // what is on screen now, to touch the page only when something changes
    this.lit = null; // { type, until }: the piece just dealt
    const rows = PIECE_TYPES.map((type) => {
      const row = doc.createElement('p');
      const name = doc.createElement('span');
      name.className = 'sr-only';
      name.textContent = `${type} pieces: `;
      const count = doc.createElement('b');
      count.textContent = '0';
      row.append(name, count);
      this.counts[type] = count;
      return row;
    });
    doc.getElementById('dealt-grid').append(...rows);
  }

  /** Called at every frame. */
  update(game, now) {
    const dealt = game.stats.dealt;
    let total = 0;
    for (const type of PIECE_TYPES) {
      const n = dealt[type];
      total += n;
      const before = this.shown[type];
      if (before === n) continue;
      this.counts[type].textContent = String(n);
      // only the latest piece lights up; a new game goes back to zero without it
      this.lit = before !== undefined && n > before ? { type, until: now + FLASH_MS } : null;
      this.shown[type] = n;
    }
    const lit = this.lit && now < this.lit.until ? this.lit.type : null;
    if (this.shown.lit !== lit) {
      if (this.shown.lit) this.counts[this.shown.lit].classList.remove('new');
      if (lit) this.counts[lit].classList.add('new');
      this.shown.lit = lit;
    }
    if (this.shown.total !== total) {
      this.total.textContent = String(total);
      this.shown.total = total;
    }
  }
}
