// Points for every move, from the modern official rules.
//
// scoreLock() is a pure function: it reads its arguments, returns a result and changes
// nothing else. That makes it easy to test: same input, same output, always.

export const LINE_POINTS = { 0: 0, 1: 100, 2: 300, 3: 500, 4: 800 };
export const TSPIN_POINTS = { 0: 400, 1: 800, 2: 1200, 3: 1600 };
export const TSPIN_MINI_POINTS = { 0: 100, 1: 200, 2: 400 };
export const PERFECT_CLEAR_POINTS = { 1: 800, 2: 1200, 3: 1800, 4: 2000 };
export const PERFECT_CLEAR_B2B_POLYFIT = 3200;
export const COMBO_POINTS = 50;
export const BACK_TO_BACK_FACTOR = 1.5;
export const SOFT_DROP_POINTS = 1; // per row, not multiplied by the level
export const HARD_DROP_POINTS = 2; // per row, not multiplied by the level

const LINE_NAMES = { 1: 'Single', 2: 'Double', 3: 'Triple', 4: 'PolyFit!' };

/** The name of a move, as shown on screen: "Double", "T-spin Mini Single", "PolyFit!"… */
export function moveName(lines, tspin) {
  if (tspin === 'none') return LINE_NAMES[lines] ?? '';
  const kind = tspin === 'mini' ? 'T-spin Mini' : 'T-spin';
  return lines === 0 ? kind : `${kind} ${LINE_NAMES[lines]}`;
}

/**
 * Scores one piece that has just locked.
 *
 * @param move   { lines: 0–4, tspin: 'none' | 'mini' | 'full', perfectClear: boolean,
 *                 level: the level BEFORE these lines are counted }
 * @param streak { backToBack: was the last line clear a difficult one?,
 *                 combo: pieces in a row that cleared lines, minus one (−1 = no combo) }
 * @returns      { points, parts, name, difficult, backToBack, combo, perfectClear, streak }
 *               parts splits the points by source; streak is the new streak.
 */
export function scoreLock(move, streak) {
  const { lines, perfectClear, level } = move;
  // A Mini cannot clear three lines; if a strange case ever did, score it as a full T-spin.
  const tspin = move.tspin === 'mini' && lines >= 3 ? 'full' : move.tspin;

  const parts = { lines: 0, polyfit: 0, tspin: 0, backToBack: 0, combo: 0, perfectClear: 0 };

  // 1. The move itself.
  let base;
  if (tspin === 'full') base = TSPIN_POINTS[lines];
  else if (tspin === 'mini') base = TSPIN_MINI_POINTS[lines];
  else base = LINE_POINTS[lines];
  const source = tspin !== 'none' ? 'tspin' : lines === 4 ? 'polyfit' : 'lines';
  parts[source] = base * level;

  // 2. Back-to-back: difficult clears (a PolyFit! or a T-spin that clears lines)
  //    in a row are worth ×1.5 from the second one on.
  const difficult = lines > 0 && (lines === 4 || tspin !== 'none');
  const backToBack = difficult && streak.backToBack;
  if (backToBack) parts.backToBack = Math.floor(base * level * (BACK_TO_BACK_FACTOR - 1));

  // 3. Combo: every piece in a row that clears lines, from the second one,
  //    adds 50 × combo × level. A piece that clears nothing ends the combo.
  const combo = lines > 0 ? streak.combo + 1 : -1;
  if (combo > 0) parts.combo = COMBO_POINTS * combo * level;

  // 4. Perfect clear: the board is completely empty after the clear.
  const isPerfect = perfectClear && lines > 0;
  if (isPerfect) {
    const bonus = lines === 4 && backToBack ? PERFECT_CLEAR_B2B_POLYFIT : PERFECT_CLEAR_POINTS[lines];
    parts.perfectClear = bonus * level;
  }

  // The new streak. Only a normal Single, Double or Triple breaks the back-to-back;
  // pieces that clear no lines, and T-spins without lines, leave it as it was.
  const next = {
    backToBack: lines > 0 ? difficult : streak.backToBack,
    combo,
  };

  const points = Object.values(parts).reduce((sum, p) => sum + p, 0);
  return {
    points,
    parts,
    name: moveName(lines, tspin),
    tspin,
    difficult,
    backToBack,
    combo,
    perfectClear: isPerfect,
    streak: next,
  };
}
