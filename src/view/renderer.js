// Draws the game on its canvases: the board, the hold box, the next pieces, the seven
// shapes next to their counts and, in a challenge, the rival's board in miniature.
//
// The renderer only reads the game, it never changes it. It draws a whole new picture
// at every frame (60 times per second), plus short effects such as the flash of a
// cleared line, which fade by themselves.

import { COLS, ROWS, HIDDEN_ROWS, VISIBLE_ROWS, cellsOf, stackTop } from '../engine/board.js';
import { SHAPES, PIECE_TYPES } from '../engine/pieces.js';
import { readTheme } from './theme.js';

const SKY_ROWS = 2; // rows drawn above the field, where new pieces appear
const VIEW_TOP = HIDDEN_ROWS - SKY_ROWS; // the first board row on screen
export const VIEW_ROWS = VISIBLE_ROWS + SKY_ROWS;
const LOCK_FADE = 0.3; // a resting piece fades by 30% while its lock delay runs out

// How long each effect lasts, in milliseconds.
const DURATION = { clear: 320, lock: 180, drop: 160, level: 900 };

export class Renderer {
  constructor({ board, hold, next, rival, dealt }) {
    this.canvases = { board, hold, next, rival, dealt };
    this.contexts = {
      board: board.getContext('2d'),
      hold: hold.getContext('2d'),
      next: next.getContext('2d'),
      rival: rival.getContext('2d'),
      dealt: dealt.getContext('2d'),
    };
    this.sizes = {};
    this.effects = [];
    this.showMarks = true;
    this.theme = readTheme();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize();
  }

  refreshTheme() {
    this.theme = readTheme();
  }

  /** Matches each canvas to its size on screen, in real pixels, so it stays sharp. */
  resize() {
    const dpr = window.devicePixelRatio || 1;
    for (const [name, canvas] of Object.entries(this.canvases)) {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      this.contexts[name].setTransform(dpr, 0, 0, dpr, 0, 0);
      this.sizes[name] = { width, height };
    }
    this.cell = Math.min(this.sizes.board.width / COLS, this.sizes.board.height / VIEW_ROWS);
  }

  // ---------------------------------------------------------------- effects

  addEffect(kind, data, now) {
    if (this.reducedMotion && kind === 'drop') return;
    this.effects.push({ kind, data, start: now });
  }

  // ---------------------------------------------------------------- frame

  /**
   * Draws one frame. `hidden` draws an empty board (pause: no peeking),
   * `faded` dims the stack (game over).
   */
  draw(game, now, { hidden = false, faded = false } = {}) {
    this.effects = this.effects.filter((e) => now - e.start < DURATION[e.kind]);
    this.drawBoard(game, now, hidden, faded);
    this.drawPreview('hold', hidden ? [] : [game.holdType].filter(Boolean), game.holdUsed);
    this.drawPreview('next', hidden ? [] : game.nextPieces, false);
    this.drawDealt();
  }

  /** The canvas y of a board row. */
  rowY(y) {
    return (y - VIEW_TOP) * this.cell;
  }

  drawBoard(game, now, hidden, faded) {
    const ctx = this.contexts.board;
    const { width, height } = this.sizes.board;
    const s = this.cell;
    const t = this.theme;
    ctx.clearRect(0, 0, width, height);

    // The field: a rounded rectangle with a thin grid.
    const top = SKY_ROWS * s;
    const fieldW = COLS * s;
    const fieldH = VISIBLE_ROWS * s;
    const radius = Math.min(14, s * 0.5);
    const danger = !hidden && game.state === 'playing' && stackTop(game.board) < HIDDEN_ROWS + 4;

    ctx.save();
    roundRect(ctx, 0, top, fieldW, fieldH, radius);
    ctx.fillStyle = t.board;
    ctx.fill();
    ctx.clip();
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < COLS; x++) {
      ctx.moveTo(Math.round(x * s) + 0.5, top);
      ctx.lineTo(Math.round(x * s) + 0.5, top + fieldH);
    }
    for (let y = 1; y < VISIBLE_ROWS; y++) {
      ctx.moveTo(0, Math.round(top + y * s) + 0.5);
      ctx.lineTo(fieldW, Math.round(top + y * s) + 0.5);
    }
    ctx.stroke();
    if (danger) {
      // the top of the field glows when the stack gets close to it
      const glow = ctx.createLinearGradient(0, top, 0, top + 4 * s);
      glow.addColorStop(0, withAlpha(t.hl, 0.22 + 0.1 * Math.sin(now / 160)));
      glow.addColorStop(1, withAlpha(t.hl, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(0, top, fieldW, 4 * s);
    }
    ctx.restore();

    if (!hidden) {
      // The stack (rows in the sky included: a piece can lock there).
      ctx.save();
      ctx.globalAlpha = faded ? 0.45 : 1;
      for (let y = VIEW_TOP; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const type = game.board[y][x];
          if (type) this.drawCell(ctx, x * s, this.rowY(y), s, type);
        }
      }
      ctx.restore();

      // The falling piece and its ghost.
      if (game.piece && game.state === 'playing') {
        const ghost = { ...game.piece, y: game.ghostY() };
        if (ghost.y !== game.piece.y) this.drawGhost(ctx, ghost);
        const resting = game.isGrounded();
        const alpha = resting ? 1 - LOCK_FADE * Math.min(1, game.lockTimer / 30) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        for (const [x, y] of cellsOf(game.piece)) {
          if (y >= VIEW_TOP) this.drawCell(ctx, x * s, this.rowY(y), s, game.piece.type);
        }
        ctx.restore();
      }

      this.drawEffects(ctx, now);
    }

    // The frame around the field.
    const level = this.effects.find((e) => e.kind === 'level');
    ctx.save();
    roundRect(ctx, 0.5, top + 0.5, fieldW - 1, fieldH - 1, radius);
    if (level) {
      const k = 1 - (now - level.start) / DURATION.level;
      ctx.strokeStyle = withAlpha(t.accent, 0.35 + 0.65 * k);
      ctx.lineWidth = 1 + 2 * k;
    } else {
      ctx.strokeStyle = danger ? t.hl : t.rule;
      ctx.lineWidth = danger ? 2 : 1;
    }
    ctx.stroke();
    ctx.restore();
  }

  drawEffects(ctx, now) {
    const s = this.cell;
    const t = this.theme;
    for (const e of this.effects) {
      const k = (now - e.start) / DURATION[e.kind]; // 0 → 1 over the effect's life
      ctx.save();
      if (e.kind === 'clear') {
        // a bright band where each cleared row was, fading out
        ctx.fillStyle = withAlpha(t.flash, 0.9 * (1 - k) ** 2);
        const grow = this.reducedMotion ? 0 : s * 0.35 * k;
        for (const y of e.data.rows) ctx.fillRect(0, this.rowY(y) - grow / 2, COLS * s, s + grow);
      } else if (e.kind === 'lock') {
        ctx.fillStyle = withAlpha(t.flash, 0.5 * (1 - k));
        for (const [x, y] of e.data.cells) {
          if (y >= VIEW_TOP) {
            roundRect(ctx, x * s + 1, this.rowY(y) + 1, s - 2, s - 2, s * 0.16);
            ctx.fill();
          }
        }
      } else if (e.kind === 'drop') {
        // a faint trail above each column of a hard-dropped piece
        const color = t.pieces[e.data.piece.type]?.color ?? t.muted;
        const tops = new Map();
        for (const [x, y] of cellsOf(e.data.piece)) tops.set(x, Math.min(tops.get(x) ?? ROWS, y));
        for (const [x, y] of tops) {
          const from = Math.max(this.rowY(y - e.data.rows), this.rowY(VIEW_TOP));
          const to = this.rowY(y);
          if (to <= from) continue;
          const g = ctx.createLinearGradient(0, from, 0, to);
          g.addColorStop(0, withAlpha(color, 0));
          g.addColorStop(1, withAlpha(color, 0.28 * (1 - k)));
          ctx.fillStyle = g;
          ctx.fillRect(x * s + s * 0.12, from, s * 0.76, to - from);
        }
      }
      ctx.restore();
    }
  }

  /** One square of a piece: rounded, with a darker edge and its small mark. */
  drawCell(ctx, px, py, size, type) {
    const look = this.theme.pieces[type] ?? { color: this.theme.muted, edge: null, mark: null };
    const inset = Math.max(0.75, size * 0.05);
    const r = size * 0.16;
    roundRect(ctx, px + inset, py + inset, size - 2 * inset, size - 2 * inset, r);
    ctx.fillStyle = look.color;
    ctx.fill();
    if (look.edge) {
      ctx.strokeStyle = look.edge;
      ctx.lineWidth = 1;
      roundRect(ctx, px + inset + 0.5, py + inset + 0.5, size - 2 * inset - 1, size - 2 * inset - 1, r);
      ctx.stroke();
    }
    if (this.showMarks && look.mark && size >= 12) drawMark(ctx, type, px + size / 2, py + size / 2, size, look.mark);
  }

  /** The ghost: the dashed outline of where the piece will land. */
  drawGhost(ctx, piece) {
    const s = this.cell;
    const color = this.theme.pieces[piece.type]?.color ?? this.theme.muted;
    const cells = cellsOf(piece).filter(([, y]) => y >= VIEW_TOP);
    const has = new Set(cells.map(([x, y]) => `${x},${y}`));
    ctx.save();
    ctx.fillStyle = withAlpha(color, this.theme.dark ? 0.12 : 0.09);
    for (const [x, y] of cells) ctx.fillRect(x * s, this.rowY(y), s, s);
    // Only the outer edges: a side is drawn when the cell next to it is not part of the piece.
    ctx.beginPath();
    const inset = 1.5;
    for (const [x, y] of cells) {
      const left = x * s + inset;
      const right = (x + 1) * s - inset;
      const top = this.rowY(y) + inset;
      const bottom = this.rowY(y + 1) - inset;
      if (!has.has(`${x},${y - 1}`)) { ctx.moveTo(left, top); ctx.lineTo(right, top); }
      if (!has.has(`${x},${y + 1}`)) { ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); }
      if (!has.has(`${x - 1},${y}`)) { ctx.moveTo(left, top); ctx.lineTo(left, bottom); }
      if (!has.has(`${x + 1},${y}`)) { ctx.moveTo(right, top); ctx.lineTo(right, bottom); }
    }
    ctx.setLineDash([Math.max(3, s * 0.2), Math.max(2, s * 0.13)]);
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.lineCap = 'round';
    ctx.strokeStyle = withAlpha(color, 0.85);
    ctx.stroke();
    ctx.restore();
  }

  /** The rival's board in miniature: the visible field, flat squares, no marks. */
  drawRival(game) {
    const ctx = this.contexts.rival;
    const { width, height } = this.sizes.rival;
    ctx.clearRect(0, 0, width, height);
    const s = Math.floor(Math.min(width / COLS, height / VISIBLE_ROWS) * 2) / 2; // half pixels keep it sharp
    if (s < 2) return;
    const t = this.theme;
    const ox = Math.round((width - s * COLS) / 2);
    const oy = Math.round((height - s * VISIBLE_ROWS) / 2);
    ctx.save();
    roundRect(ctx, ox, oy, s * COLS, s * VISIBLE_ROWS, Math.min(8, s * 0.6));
    ctx.fillStyle = t.board;
    ctx.fill();
    ctx.strokeStyle = t.rule;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();
    const gap = s >= 6 ? 1 : 0.5;
    const square = (x, y, type) => {
      if (y < HIDDEN_ROWS) return;
      ctx.fillStyle = t.pieces[type]?.color ?? t.muted;
      ctx.fillRect(ox + x * s + gap, oy + (y - HIDDEN_ROWS) * s + gap, s - 2 * gap, s - 2 * gap);
    };
    ctx.globalAlpha = game.state === 'over' ? 0.45 : 1;
    for (let y = HIDDEN_ROWS; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) if (game.board[y][x]) square(x, y, game.board[y][x]);
    }
    if (game.piece && game.state === 'playing') for (const [x, y] of cellsOf(game.piece)) square(x, y, game.piece.type);
    ctx.restore();
  }

  /** The hold box or the next pieces: each piece centered in its own slot. */
  drawPreview(name, types, dimmed) {
    const ctx = this.contexts[name];
    const { width, height } = this.sizes[name];
    ctx.clearRect(0, 0, width, height);
    const slots = name === 'next' ? 5 : 1;
    const slotH = height / slots;
    const size = Math.min(width / 4.6, slotH / 2.9, this.cell * 0.8);
    ctx.save();
    ctx.globalAlpha = dimmed ? 0.35 : 1;
    types.forEach((type, i) => this.drawShape(ctx, type, 0, i * slotH, width, slotH, size));
    ctx.restore();
  }

  /**
   * The seven shapes, small, one per slot: in a column next to their counts, or in a row
   * above them when the canvas is wider than tall (phones). The counts are text on the page.
   */
  drawDealt() {
    const ctx = this.contexts.dealt;
    const { width, height } = this.sizes.dealt;
    ctx.clearRect(0, 0, width, height);
    const across = width > height;
    const slotW = across ? width / PIECE_TYPES.length : width;
    const slotH = across ? height : height / PIECE_TYPES.length;
    const size = Math.min(slotW / 4.4, slotH / 2.7); // a little air between two rows
    PIECE_TYPES.forEach((type, i) => this.drawShape(ctx, type, across ? i * slotW : 0, across ? 0 : i * slotH, slotW, slotH, size));
  }

  /** A piece in its spawn position, centered in the box (x, y, w, h), with squares of the given size. */
  drawShape(ctx, type, x, y, w, h, size) {
    const cells = SHAPES[type][0];
    const xs = cells.map(([cx]) => cx);
    const ys = cells.map(([, cy]) => cy);
    const shapeW = (Math.max(...xs) - Math.min(...xs) + 1) * size;
    const shapeH = (Math.max(...ys) - Math.min(...ys) + 1) * size;
    const ox = x + (w - shapeW) / 2 - Math.min(...xs) * size;
    const oy = y + (h - shapeH) / 2 - Math.min(...ys) * size;
    for (const [cx, cy] of cells) this.drawCell(ctx, ox + cx * size, oy + cy * size, size, type);
  }
}

// ---------------------------------------------------------------- drawing helpers

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** "#c2410c" + 0.5 → "rgba(194, 65, 12, 0.5)" */
function withAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha)).toFixed(3)})`;
}

/**
 * A small sign inside each square, different for every piece, so the pieces can be
 * told apart without relying on color alone.
 */
function drawMark(ctx, type, cx, cy, size, color) {
  const m = size * 0.15;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.lineCap = 'round';
  ctx.beginPath();
  switch (type) {
    case 'I': // —
      ctx.moveTo(cx - m, cy);
      ctx.lineTo(cx + m, cy);
      break;
    case 'O': // □
      ctx.rect(cx - m * 0.8, cy - m * 0.8, m * 1.6, m * 1.6);
      break;
    case 'T': // •
      ctx.arc(cx, cy, m * 0.55, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'S': // /
      ctx.moveTo(cx - m, cy + m);
      ctx.lineTo(cx + m, cy - m);
      break;
    case 'Z': // \
      ctx.moveTo(cx - m, cy - m);
      ctx.lineTo(cx + m, cy + m);
      break;
    case 'J': // ○
      ctx.arc(cx, cy, m * 0.85, 0, Math.PI * 2);
      break;
    case 'L': // +
      ctx.moveTo(cx - m, cy);
      ctx.lineTo(cx + m, cy);
      ctx.moveTo(cx, cy - m);
      ctx.lineTo(cx, cy + m);
      break;
  }
  if (type !== 'T') ctx.stroke();
  ctx.restore();
}
