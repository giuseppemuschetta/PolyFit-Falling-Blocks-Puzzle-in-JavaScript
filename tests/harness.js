// A tiny test runner, written from scratch like the rest of the project.
//
// test('name', () => { … }) registers a test; assert.* throws an Error when a check fails;
// run() executes every test and reports which ones passed.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

function show(value) {
  return JSON.stringify(value);
}

export const assert = {
  ok(value, message = 'expected a true value') {
    if (!value) throw new Error(message);
  },
  equal(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} expected ${show(expected)}, got ${show(actual)}`.trim());
    }
  },
  deepEqual(actual, expected, message = '') {
    if (show(actual) !== show(expected)) {
      throw new Error(`${message} expected ${show(expected)}, got ${show(actual)}`.trim());
    }
  },
};

/** Runs every registered test; returns { passed, failed, failures, ms }. */
export async function run() {
  const failures = [];
  const started = performance.now();
  for (const { name, fn } of tests) {
    try {
      await fn();
    } catch (error) {
      failures.push({ name, message: error.message });
    }
  }
  return {
    passed: tests.length - failures.length,
    failed: failures.length,
    failures,
    ms: Math.round(performance.now() - started),
  };
}
