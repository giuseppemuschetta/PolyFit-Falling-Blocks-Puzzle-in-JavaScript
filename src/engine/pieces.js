// The seven pieces, their four rotation states and the rotation "kicks".
//
// Coordinates: x grows to the right and y grows DOWNWARD (row 0 is at the top),
// like pixels on a screen and like the rows of the board array.

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Each piece as it appears when it spawns, inside its bounding box.
// The box is 3×3, or 4×4 for I and O: the piece turns around the center of its box.
const SPAWN_SHAPES = {
  I: { size: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { size: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  T: { size: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { size: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { size: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { size: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { size: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

/** A quarter turn clockwise inside a box of the given size: (x, y) → (size − 1 − y, x). */
function turnClockwise(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

/**
 * SHAPES[type][rotation] is the list of [x, y] cells of a piece.
 * Rotation 0 is the spawn state, 1 is a quarter turn clockwise ("R"),
 * 2 is upside down and 3 is a quarter turn counterclockwise ("L").
 * The O piece looks the same in all four states.
 */
export const SHAPES = {};
for (const type of PIECE_TYPES) {
  const { size, cells } = SPAWN_SHAPES[type];
  const states = [cells];
  for (let r = 1; r < 4; r++) {
    states.push(type === 'O' ? cells : turnClockwise(states[r - 1], size));
  }
  SHAPES[type] = states;
}

// Wall kicks of the Super Rotation System (SRS). When a rotation would overlap a wall
// or a block, the game tries these offsets in order and keeps the first one that fits.
// Key "0>1" means "from rotation 0 to rotation 1". The values are written as in the
// published tables, where y grows UPWARD; kicksFor() flips them for our board.
const KICKS_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

// The I piece is longer, so it has its own table.
const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

/** Flips the y of every offset: the tables count rows upward, our board counts them downward. */
function flipY(table) {
  const flipped = {};
  for (const [key, offsets] of Object.entries(table)) {
    flipped[key] = offsets.map(([dx, dy]) => [dx, -dy]);
  }
  return flipped;
}

const KICKS = { I: flipY(KICKS_I), other: flipY(KICKS_JLSTZ) };

/** The offsets to try, in order, when a piece turns from one rotation to another. */
export function kicksFor(type, from, to) {
  if (type === 'O') return [[0, 0]];
  const table = type === 'I' ? KICKS.I : KICKS.other;
  return table[`${from}>${to}`];
}
