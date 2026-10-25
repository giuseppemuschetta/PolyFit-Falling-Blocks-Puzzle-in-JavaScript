// Tests of the music's score: the notes are read right, every bar is whole and the song,
// once compiled, runs in time order. The sound itself is for the ears, not for the tests.

import { test, assert } from './harness.js';
import { SONG, compileSong, midiOf, parseScore, thirdBelow } from '../src/audio/song.js';

test('music: notes and lengths are read from the score', () => {
  assert.equal(midiOf('A4'), 69);
  assert.equal(midiOf('C#5'), 73);
  assert.equal(midiOf('Bb4'), 70);
  assert.deepEqual(parseScore('A4/.5 r D5/1.5'), [[69, 0.5], [null, 1], [74, 1.5]]);
});

test('music: no note of the melody crosses a bar line, and the chords last as long', () => {
  const bar = SONG.beatsPerBar;
  let beat = 0;
  for (const [, beats] of SONG.melody) {
    assert.equal(Math.floor(beat / bar), Math.floor((beat + beats - 1e-9) / bar), `the note at beat ${beat}`);
    beat += beats;
  }
  assert.equal(beat, 24 * bar, '24 bars');
  assert.equal(SONG.chords.reduce((sum, [, beats]) => sum + beats, 0), beat, 'chords');
});

test('music: the second voice is a third below, on the scale of the chord', () => {
  const natural = [9, 11, 0, 2, 4, 5, 7];
  const harmonic = [9, 11, 0, 2, 4, 5, 8];
  assert.equal(thirdBelow(midiOf('A4'), natural), midiOf('F4'));
  assert.equal(thirdBelow(midiOf('E5'), natural), midiOf('C5'));
  assert.equal(thirdBelow(midiOf('B4'), harmonic), midiOf('G#4'));
  assert.equal(thirdBelow(midiOf('B4'), natural), midiOf('G4'));
  assert.equal(thirdBelow(midiOf('C#5'), natural), null, 'not on the scale');
});

test('music: the compiled song is in time order and ends where it starts again', () => {
  const { events, length } = compileSong(SONG);
  assert.equal(length, 96);
  for (let i = 1; i < events.length; i++) assert.ok(events[i].beat >= events[i - 1].beat, `event ${i}`);
  assert.ok(events.every((e) => e.beat >= 0 && e.beat < length), 'inside the song');
  for (const voice of ['lead', 'second', 'bass', 'drum']) assert.ok(events.some((e) => e.voice === voice), voice);
});
