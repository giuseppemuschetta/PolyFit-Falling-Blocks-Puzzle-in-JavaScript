// Tests of the scoring rules, one table row at a time.

import { test, assert } from './harness.js';
import { scoreLock, moveName } from '../src/engine/scoring.js';

const fresh = { backToBack: false, combo: -1 };
const score = (move, streak = fresh) =>
  scoreLock({ tspin: 'none', perfectClear: false, level: 1, ...move }, streak);

test('scoring: Single, Double, Triple and PolyFit! times the level', () => {
  assert.equal(score({ lines: 1 }).points, 100);
  assert.equal(score({ lines: 2, level: 2 }).points, 600);
  assert.equal(score({ lines: 3, level: 3 }).points, 1500);
  assert.equal(score({ lines: 4, level: 4 }).points, 3200);
  assert.equal(score({ lines: 0 }).points, 0);
});

test('scoring: T-spins', () => {
  assert.equal(score({ lines: 0, tspin: 'full' }).points, 400);
  assert.equal(score({ lines: 1, tspin: 'full' }).points, 800);
  assert.equal(score({ lines: 2, tspin: 'full' }).points, 1200);
  assert.equal(score({ lines: 3, tspin: 'full', level: 2 }).points, 3200);
});

test('scoring: T-spin Minis', () => {
  assert.equal(score({ lines: 0, tspin: 'mini' }).points, 100);
  assert.equal(score({ lines: 1, tspin: 'mini' }).points, 200);
  assert.equal(score({ lines: 2, tspin: 'mini' }).points, 400);
});

test('scoring: back-to-back difficult clears are worth ×1.5', () => {
  const b2b = { backToBack: true, combo: -1 };
  const polyfit = score({ lines: 4 }, b2b);
  assert.equal(polyfit.points, 1200);
  assert.ok(polyfit.backToBack);
  assert.equal(polyfit.parts.backToBack, 400);
  assert.equal(score({ lines: 2, tspin: 'full' }, b2b).points, 1800);
  assert.equal(score({ lines: 1, tspin: 'mini' }, b2b).points, 300);
});

test('scoring: the first difficult clear starts the chain, without a bonus', () => {
  const first = score({ lines: 4 });
  assert.equal(first.points, 800);
  assert.ok(first.streak.backToBack);
});

test('scoring: a normal clear breaks back-to-back, an empty lock does not', () => {
  const b2b = { backToBack: true, combo: -1 };
  const double = score({ lines: 2 }, b2b);
  assert.equal(double.points, 300, 'no bonus on a normal Double');
  assert.ok(!double.streak.backToBack);
  assert.ok(score({ lines: 0 }, b2b).streak.backToBack, 'placing a piece keeps it');
  assert.ok(score({ lines: 0, tspin: 'full' }, b2b).streak.backToBack, 'a T-spin without lines keeps it');
});

test('scoring: combo adds 50 × combo × level', () => {
  const second = score({ lines: 1, level: 2 }, { backToBack: false, combo: 0 });
  assert.equal(second.combo, 1);
  assert.equal(second.points, 200 + 100);
  assert.equal(score({ lines: 1 }, { backToBack: false, combo: 2 }).parts.combo, 150);
  assert.equal(score({ lines: 0 }, { backToBack: false, combo: 5 }).streak.combo, -1, 'no lines ends it');
});

test('scoring: perfect clear bonus', () => {
  assert.equal(score({ lines: 1, perfectClear: true }).points, 100 + 800);
  assert.equal(score({ lines: 2, perfectClear: true }).points, 300 + 1200);
  assert.equal(score({ lines: 3, perfectClear: true }).points, 500 + 1800);
  assert.equal(score({ lines: 4, perfectClear: true }).points, 800 + 2000);
  const b2b = score({ lines: 4, perfectClear: true, level: 2 }, { backToBack: true, combo: -1 });
  assert.equal(b2b.points, 1600 + 800 + 6400, 'back-to-back PolyFit! perfect clear');
});

test('scoring: points are split by source', () => {
  const r = score({ lines: 4, perfectClear: true }, { backToBack: true, combo: 1 });
  assert.deepEqual(r.parts, { lines: 0, polyfit: 800, tspin: 0, backToBack: 400, combo: 100, perfectClear: 3200 });
  assert.equal(r.points, 4500);
});

test('scoring: move names', () => {
  assert.equal(moveName(4, 'none'), 'PolyFit!');
  assert.equal(moveName(2, 'full'), 'T-spin Double');
  assert.equal(moveName(1, 'mini'), 'T-spin Mini Single');
  assert.equal(moveName(0, 'full'), 'T-spin');
  assert.equal(moveName(0, 'none'), '');
});
