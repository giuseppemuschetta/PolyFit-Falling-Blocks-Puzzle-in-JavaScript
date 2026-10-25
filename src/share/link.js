// Challenge links: a whole game inside a web address, so it can travel with no server.
//
// The part after "#" holds the player's name, the day, the seed of the pieces and every
// input with its tick, packed into bytes and compressed. Browsers never send that part to
// any server, not even to this website. Whoever opens the link plays the game again with
// the same rules (engine/game.js) and gets the score by themselves: a link holds no score,
// so no score can be made up, and changing a single input gives a different game.
//
// The bytes, before compression:
//   format · rules · mode · seed (4 bytes) · day (2 bytes) · name length · name (UTF-8)
//   · number of inputs · one number per input: ticks since the previous input × 10 + input code
// Numbers of variable size take 7 bits per byte, so most inputs fit in a single byte.

import { BUTTONS } from '../engine/game.js';

export const LINK_KEY = 'c'; // …/challenge/#c=…
export const RULES = 1; // the version of the rules: a change in the engine must raise it
export const MAX_NAME = 20; // characters
const FORMAT = 1;
const MODE_CHALLENGE = 1; // the 3-minute challenge, the only mode so far
const MAX_EVENTS = 30000; // a frantic player makes about 3,000 in three minutes
const MAX_BYTES = 1 << 20; // a link never unpacks to more than 1 MB
const MAX_TICK = 180 * 60; // three minutes of ticks
const DAY_MS = 86400000;
const DAY_ZERO = Date.UTC(2026, 0, 1);
const COMPRESSED = 'z';
const PLAIN = 'u';

/** Why a link could not be opened: 'damaged', 'old' (other rules) or 'browser' (too old to unpack it). */
export class LinkError extends Error {
  constructor(reason) {
    super(`challenge link: ${reason}`);
    this.reason = reason;
  }
}

// ---------------------------------------------------------------- names

/**
 * Keeps letters, digits, spaces and . - _ ' only, at most MAX_NAME characters.
 * No symbols, so no links or addresses, and no invisible characters that could reverse the text.
 */
export function cleanName(text) {
  const kept = String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\p{N} .'’_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...kept].slice(0, MAX_NAME).join('').trim();
}

// ---------------------------------------------------------------- inputs as numbers

// left, right and down are held: they have a press and a release (codes 0–5).
// The other four act once and are logged as presses only (codes 6–9).
function inputCode(button, down) {
  const k = BUTTONS.indexOf(button);
  if (k < 0) throw new LinkError('damaged');
  return k < 3 ? 2 * k + (down ? 0 : 1) : 3 + k;
}

function inputOf(code) {
  return code < 6 ? [BUTTONS[code >> 1], code % 2 === 0 ? 1 : 0] : [BUTTONS[code - 3], 1];
}

function pushNumber(out, n) {
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
}

/** The inputs as bytes: the part of a link that is the game itself. */
function inputBytes(log) {
  const out = [];
  pushNumber(out, log.length);
  let last = 0;
  for (const [tick, button, down] of log) {
    pushNumber(out, (tick - last) * 10 + inputCode(button, down));
    last = tick;
  }
  return out;
}

class Reader {
  constructor(bytes) {
    this.bytes = bytes;
    this.at = 0;
  }

  byte() {
    if (this.at >= this.bytes.length) throw new LinkError('damaged');
    return this.bytes[this.at++];
  }

  number() {
    let n = 0;
    for (let shift = 0; shift < 28; shift += 7) {
      const b = this.byte();
      n += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return n;
    }
    throw new LinkError('damaged');
  }

  take(count) {
    if (this.at + count > this.bytes.length) throw new LinkError('damaged');
    this.at += count;
    return this.bytes.subarray(this.at - count, this.at);
  }
}

// ---------------------------------------------------------------- the fingerprint

/**
 * Eight hex digits that identify a game: the same pieces and the same inputs give the same
 * fingerprint, whatever name is attached. Two copies of one game are spotted at once.
 */
export function fingerprint(seed, log) {
  const bytes = [RULES, MODE_CHALLENGE, ...seedBytes(seed), ...inputBytes(log)];
  let hash = 0x811c9dc5; // FNV-1a, 32 bits
  for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function seedBytes(seed) {
  return [seed >>> 24, (seed >>> 16) & 255, (seed >>> 8) & 255, seed & 255];
}

// ---------------------------------------------------------------- dates

/** "2026-10-24" → days since 1 January 2026, as stored in a link. */
function dayNumber(date) {
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.min(65535, Math.max(0, Math.round((ms - DAY_ZERO) / DAY_MS))) : 0;
}

function dateOf(day) {
  return new Date(DAY_ZERO + day * DAY_MS).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- packing

/** A game → its bytes, before compression. */
export function packGame({ seed, log, name = '', date }) {
  const nameBytes = new TextEncoder().encode(cleanName(name));
  const day = dayNumber(date);
  return Uint8Array.from([
    FORMAT, RULES, MODE_CHALLENGE, ...seedBytes(seed >>> 0),
    day >> 8, day & 255,
    nameBytes.length, ...nameBytes,
    ...inputBytes(log),
  ]);
}

/** A game → the text after "#c=". Async because compression is. */
export async function encodeGame(game) {
  const bytes = packGame(game);
  try {
    return COMPRESSED + toBase64Url(await squeeze(bytes, new CompressionStream('deflate-raw')));
  } catch {
    return plainText(bytes); // a browser without compression still makes a working, longer link
  }
}

/** Bytes → the text after "#c=", without compression. */
export function plainText(bytes) {
  return PLAIN + toBase64Url(bytes);
}

/** The text after "#c=" → { seed, log, name, date, fingerprint }. Throws a LinkError. */
export async function decodeGame(text) {
  const kind = String(text ?? '').charAt(0);
  if (kind !== COMPRESSED && kind !== PLAIN) throw new LinkError('damaged');
  let bytes = fromBase64Url(text.slice(1));
  if (kind === COMPRESSED) {
    let stream;
    try {
      stream = new DecompressionStream('deflate-raw');
    } catch {
      throw new LinkError('browser');
    }
    try {
      bytes = await squeeze(bytes, stream);
    } catch {
      throw new LinkError('damaged');
    }
  }

  const r = new Reader(bytes);
  if (r.byte() !== FORMAT) throw new LinkError('damaged');
  if (r.byte() !== RULES) throw new LinkError('old');
  if (r.byte() !== MODE_CHALLENGE) throw new LinkError('old');
  const seed = ((r.byte() << 24) | (r.byte() << 16) | (r.byte() << 8) | r.byte()) >>> 0;
  const day = (r.byte() << 8) | r.byte();
  let name;
  try {
    name = cleanName(new TextDecoder('utf-8', { fatal: true }).decode(r.take(r.byte())));
  } catch {
    throw new LinkError('damaged');
  }

  const count = r.number();
  if (count > MAX_EVENTS) throw new LinkError('damaged');
  const log = [];
  let tick = 0;
  for (let i = 0; i < count; i++) {
    const n = r.number();
    tick += Math.floor(n / 10);
    if (tick > MAX_TICK) throw new LinkError('damaged');
    log.push([tick, ...inputOf(n % 10)]);
  }
  if (r.at !== bytes.length) throw new LinkError('damaged');
  return { seed, log, name, date: dateOf(day), fingerprint: fingerprint(seed, log) };
}

// ---------------------------------------------------------------- addresses

/** The full address of a challenge: `base` is the page, without "#". */
export function linkFor(text, base) {
  return `${base}#${LINK_KEY}=${text}`;
}

/** The game part of an address or of a "#c=…" fragment, or null. */
export function gameFrom(address) {
  const hash = String(address ?? '').split('#')[1] ?? '';
  const match = new RegExp(`(?:^|&)${LINK_KEY}=([A-Za-z0-9_-]+)`).exec(hash);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------- helpers

async function squeeze(bytes, transform) {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new LinkError('damaged');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) throw new LinkError('damaged');
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((text.length + 3) % 4));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
