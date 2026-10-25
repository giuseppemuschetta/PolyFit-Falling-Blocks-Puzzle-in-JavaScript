// Colors for the canvas, read from the page's CSS custom properties.
//
// The colors live in one place, styles/polyfit.css, for both the light and the dark
// theme. The canvas cannot use CSS directly, so it reads them here, and reads them
// again whenever the theme changes.

import { PIECE_TYPES } from '../engine/pieces.js';

/** "#1f4a8a" → [31, 74, 138] */
function rgb(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Mixes a color with another: amount 0 = the first color, 1 = the second. */
export function mix(hex, otherHex, amount) {
  const a = rgb(hex);
  const b = rgb(otherHex);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Relative luminance, 0 (black) to 1 (white), as defined by WCAG. */
function luminance(hex) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const dark = v('--scheme') === 'dark';

  const pieces = {};
  for (const type of PIECE_TYPES) {
    const color = v(`--piece-${type.toLowerCase()}`);
    pieces[type] = {
      color,
      // a darker edge keeps the light colors visible on the cream board
      edge: dark ? null : mix(color, '#000000', 0.22),
      // the small inner mark: dark on light colors, light on dark ones
      mark: luminance(color) > 0.4 ? 'rgba(31, 27, 22, 0.42)' : 'rgba(255, 255, 255, 0.5)',
    };
  }

  return {
    dark,
    board: v('--board'),
    grid: v('--grid'),
    rule: v('--rule'),
    muted: v('--muted'),
    accent: v('--accent'),
    hl: v('--hl'),
    flash: v('--flash'),
    pieces,
  };
}
