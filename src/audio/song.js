// The music: Korobeiniki, a Russian folk song of 1861, in an 8-bit arrangement for PolyFit.
// The melody plays twice, then comes a second part of its own (bars 17 to 24), then the
// song starts again from the top.
//
// The score is written as text, one note per word: "E5" is the E of the fifth octave,
// "G#4" a G sharp, "/.5" half a beat (no number: one beat), "r" a rest.
// compileSong() turns it into timed events for the player (music.js).

const MELODY = `
  E5 B4/.5 C5/.5 D5 C5/.5 B4/.5
  A4 A4/.5 C5/.5 E5 D5/.5 C5/.5
  B4/1.5 C5/.5 D5 E5
  C5 A4 A4 r
  r/.5 D5 F5/.5 A5 G5/.5 F5/.5
  E5/1.5 C5/.5 E5 D5/.5 C5/.5
  B4 B4/.5 C5/.5 D5 E5
  C5 A4 A4 r`;

const SECOND_PART = `
  A5 G5/.5 F5/.5 C5 F5
  E5/1.5 D5/.5 C5 G4
  B4/.5 C5/.5 D5 G5 F5/.5 E5/.5
  E5 r/.5 A4/.5 C5 E5
  A5 G5/.5 F5/.5 C6 A5
  G5/1.5 E5/.5 C5 E5
  F5/.5 E5/.5 D5 B4/.5 C5/.5 D5
  E5/2 B4 G#4`;

const MELODY_CHORDS = [['E', 4], ['Am', 4], ['E', 4], ['Am', 4], ['Dm', 4], ['Am', 4], ['E', 4], ['Am', 4]];
const SECOND_CHORDS = [['F', 4], ['C', 4], ['G', 4], ['Am', 4], ['F', 4], ['C', 4], ['Dm', 2], ['E', 2], ['E', 4]];

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C#5" → 73, the MIDI number of the note (A4 = 69). */
export function midiOf(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Not a note: ${name}`);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

/** "A4/.5 r D5" → [[69, 0.5], [null, 1], [74, 1]]: each note and its length in beats. */
export function parseScore(text) {
  return text.trim().split(/\s+/).map((word) => {
    const [name, beats] = word.split('/');
    return [name === 'r' ? null : midiOf(name), beats ? Number(beats) : 1];
  });
}

const twice = (list) => [...list, ...list];

export const SONG = {
  bpm: 150,
  beatsPerBar: 4,
  melody: [...twice(parseScore(MELODY)), ...parseScore(SECOND_PART)],
  chords: [...twice(MELODY_CHORDS), ...SECOND_CHORDS],
  // the drums, one letter per half beat: k kick, s snare, h hi-hat, . nothing
  drums: 'k.s.k.s.',
  lightDrums: { from: 16, to: 23, pattern: 'k.h.s.h.' }, // the second part
  fill: 'k.s.ssss',
  fills: [7, 15, 23], // the last bar before each new part
};

// A minor, natural (A B C D E F G) and harmonic (G sharp, for the E chord).
const A_NATURAL = [9, 11, 0, 2, 4, 5, 7];
const A_HARMONIC = [9, 11, 0, 2, 4, 5, 8];

/** The note two steps down the scale (a third below), or null for a note outside it. */
export function thirdBelow(midi, scale) {
  const i = scale.indexOf(midi % 12);
  if (i < 0) return null;
  const target = scale[(i + 5) % 7];
  for (const down of [3, 4]) if ((midi - down) % 12 === target) return midi - down;
  return null;
}

/** "Am" → [9, true]: the pitch class of the root (C = 0) and whether the chord is minor. */
function chord(symbol) {
  const m = /^([A-G])([#b]?)(m?)$/.exec(symbol);
  return [(NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, m[3] === 'm'];
}

/** The root of a chord in the bass, between E2 and D#3. */
const bassRoot = (pitchClass) => (36 + pitchClass < 40 ? 48 + pitchClass : 36 + pitchClass);

/**
 * Every note and drum hit of the song, with its beat from the top, in time order:
 * { beat, voice: 'lead' | 'second' | 'bass', midi, beats } or { beat, voice: 'drum', kind }.
 * `length` is the song's length in beats: the player starts again from the top there.
 */
export function compileSong(song) {
  const events = [];

  // The melody, and the second voice a third below it, on the scale of the chord underneath.
  const chordStarts = [];
  let at = 0;
  for (const [symbol, beats] of song.chords) {
    chordStarts.push([at, symbol]);
    at += beats;
  }
  const chordAt = (beat) => chordStarts.filter(([start]) => start <= beat + 1e-9).pop()[1];
  let beat = 0;
  for (const [midi, beats] of song.melody) {
    if (midi !== null) {
      events.push({ beat, voice: 'lead', midi, beats });
      const second = thirdBelow(midi, chordAt(beat) === 'E' ? A_HARMONIC : A_NATURAL);
      if (second !== null) events.push({ beat, voice: 'second', midi: second, beats });
    }
    beat += beats;
  }
  const length = beat;

  // The bass jumps between the root of each chord and its octave, every half beat.
  beat = 0;
  for (const [symbol, beats] of song.chords) {
    const root = bassRoot(chord(symbol)[0]);
    for (let t = 0; t < beats; t += 0.5) events.push({ beat: beat + t, voice: 'bass', midi: t % 1 ? root + 12 : root, beats: 0.5 });
    beat += beats;
  }

  // The drums, bar by bar.
  const bars = Math.round(length / song.beatsPerBar);
  for (let bar = 0; bar < bars; bar++) {
    const light = bar >= song.lightDrums.from && bar <= song.lightDrums.to;
    const pattern = song.fills.includes(bar) ? song.fill : light ? song.lightDrums.pattern : song.drums;
    [...pattern].forEach((kind, i) => {
      if (kind !== '.') events.push({ beat: bar * song.beatsPerBar + i * 0.5, voice: 'drum', kind });
    });
  }

  events.sort((a, b) => a.beat - b.beat);
  return { events, length };
}
