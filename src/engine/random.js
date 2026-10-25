// Seeded random numbers and the 7-piece bag.
//
// The game never calls Math.random() while playing: every random choice comes from a
// generator started from a "seed" number. The same seed always deals the same pieces
// in the same order, so a game can be replayed exactly from its seed and its inputs.

import { PIECE_TYPES } from './pieces.js';

/**
 * Mulberry32, a small and fast 32-bit generator: good for games, not for security.
 * Returns a function that gives a new number in [0, 1) at every call.
 */
export function createRandom(seed) {
  let state = seed >>> 0; // ">>> 0" keeps the number an unsigned 32-bit integer

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // 4294967296 = 2^32
  };
}

/**
 * The 7-bag: put the seven pieces in a bag, shuffle it, deal them one by one,
 * then start a new bag. You never wait more than 12 pieces for the one you need.
 * Returns a function that gives the next piece type ('I', 'T', …).
 */
export function createBag(random) {
  let bag = [];

  return function nextPiece() {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      // Fisher–Yates shuffle: swap each position with a random one at or before it.
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
    }
    return bag.pop();
  };
}

/** A fresh seed for a new game, from the browser's secure random source. */
export function randomSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
