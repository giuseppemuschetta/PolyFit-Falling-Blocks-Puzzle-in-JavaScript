// The two leaderboards under the game: the Hall of Fame (players who beat Giuseppe's
// record and sent him their game) and the top 10 of this device, arcade style.
// Built with textContent only, like the results screen: a name can never turn into code.

const format = (n) => Math.round(n).toLocaleString('en-US');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** "2026-10-24" → "Oct 24", with the year when it is not this year's. */
export function shortDate(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return '–';
  const options = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  if (new Date(ms).getUTCFullYear() !== new Date().getUTCFullYear()) options.year = 'numeric';
  return new Date(ms).toLocaleDateString('en-US', options);
}

export class Boards {
  constructor({ onWatch, onClear, record }, doc = document) {
    this.onWatch = onWatch;
    this.onClear = onClear;
    this.record = record;
    this.el = {
      hallTable: doc.getElementById('hall-table'),
      hallBody: doc.getElementById('hall-body'),
      hallEmpty: doc.getElementById('hall-empty'),
      localTable: doc.getElementById('local-table'),
      localBody: doc.getElementById('local-body'),
      localEmpty: doc.getElementById('local-empty'),
      clear: doc.getElementById('clear-top'),
    };
    this.el.clear.addEventListener('click', () => this.clearClicked());
  }

  /** `rows` null while the games are being replayed. */
  showHall(rows) {
    const { hallTable, hallBody, hallEmpty } = this.el;
    if (!rows || rows.length === 0) {
      hallTable.hidden = true;
      hallEmpty.hidden = false;
      hallEmpty.textContent = !rows
        ? 'Replaying the games…'
        : this.record
          ? `Nobody has beaten my record of ${format(this.record.score)} yet. Beat it, then press “Send it to Giuseppe” in your results: your name goes here.`
          : 'Nobody here yet.';
      return;
    }
    hallBody.replaceChildren(...rows.map((row, i) => this.row(i + 1, row, () => this.onWatch(row.game, row.name))));
    hallTable.hidden = false;
    hallEmpty.hidden = true;
  }

  /** The device's list; `current` is the id of the game just played, highlighted. */
  showLocal(top, current = null) {
    const { localTable, localBody, localEmpty, clear } = this.el;
    localTable.hidden = top.length === 0;
    localEmpty.hidden = top.length > 0;
    clear.hidden = top.length === 0;
    localBody.replaceChildren(
      ...top.map((entry, i) => {
        const row = this.row(i + 1, entry, entry.code ? () => this.onWatch(entry.code, entry.name || 'your game') : null);
        if (entry.id === current) row.classList.add('mine');
        return row;
      }),
    );
  }

  row(place, { name, score, date }, watch) {
    const tr = el('tr');
    tr.append(el('td', 'place', String(place)));
    const who = el('th', name ? 'who' : 'who unnamed', name || 'Unnamed');
    who.scope = 'row';
    tr.append(who, el('td', 'num', format(score)), el('td', 'when', shortDate(date)));
    const cell = el('td', 'go');
    if (watch) {
      const button = el('button', 'link-btn', 'Watch');
      button.type = 'button';
      button.setAttribute('aria-label', `Watch the game of ${name || 'this player'}, ${format(score)} points`);
      button.addEventListener('click', watch);
      cell.append(button);
    }
    tr.append(cell);
    return tr;
  }

  /** Two clicks to clear: the first one asks. */
  clearClicked() {
    const button = this.el.clear;
    if (button.dataset.sure) {
      clearTimeout(this.sureTimer);
      delete button.dataset.sure;
      button.textContent = 'Clear this list';
      this.onClear();
      return;
    }
    button.dataset.sure = '1';
    button.textContent = 'Sure? Click again to clear';
    this.sureTimer = setTimeout(() => {
      delete button.dataset.sure;
      button.textContent = 'Clear this list';
    }, 4000);
  }
}
