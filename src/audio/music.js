// The background music, played by four voices like the sound chip of an 8-bit handheld:
// two pulse waves (the melody and a second voice under it), a triangle wave (the bass)
// and noise (the drums). Every note is made on the spot with the Web Audio API from the
// score in song.js: no audio files. Off by default; the music button or N turns it on.
//
// The notes are scheduled a fraction of a second ahead on the audio clock, so they keep
// time even when a frame of the game comes late.

import { audioContext } from './context.js';
import { SONG, compileSong } from './song.js';

const LOOKAHEAD = 0.2; // seconds of music scheduled ahead
const VOLUME = 0.17; // the whole music: well under the sounds of the pieces, so they always come through
const VOICES = {
  lead: { duty: 0.5, volume: 0.1, gate: 0.92, vibrato: true },
  second: { duty: 0.125, volume: 0.05, gate: 0.9 },
  bass: { duty: null, volume: 0.3, gate: 0.94 }, // null: a triangle wave
};

export class Music {
  constructor(song = SONG) {
    this.song = song;
    ({ events: this.events, length: this.length } = compileSong(song));
    this.enabled = false;
    this.ctx = null;
    this.run = null; // while the music plays: where it was started and how fast it goes
    this.position = 0; // where the music stopped, in beats from the top of the song
    this.waves = {};
  }

  /** Browsers allow sound only after a click or a key press: call this from one. */
  setEnabled(on) {
    this.enabled = on;
    if (!on) this.stop();
    else if (!this.ctx) this.setup();
  }

  /** Back to the first bar, for a new game. */
  reset() {
    this.stop();
    this.position = 0;
  }

  /** Called at every frame: the music plays while `playing` is true, `tempo` times as fast. */
  update(playing, tempo = 1) {
    if (!playing || !this.enabled || this.ctx?.state !== 'running') {
      this.stop();
      return;
    }
    if (!this.run) this.start(tempo);
    else if (this.run.tempo !== tempo) this.retime(tempo);
    this.schedule();
  }

  // ---------------------------------------------------------------- playing

  setup() {
    this.ctx = audioContext();
    if (!this.ctx) return;
    const ctx = this.ctx;
    // the pulse waves are bright: a gentle filter takes the edge off, a compressor keeps the level even
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 9000;
    const compressor = ctx.createDynamicsCompressor();
    this.bus = ctx.createGain();
    this.bus.gain.value = VOLUME;
    this.bus.connect(filter).connect(compressor).connect(ctx.destination);
    this.noise = noiseBuffer(ctx);
  }

  start(tempo) {
    const out = this.ctx.createGain();
    out.connect(this.bus);
    const from = this.position;
    // the first event from there on; past the last one, the top of the song comes next
    let next = this.events.findIndex((e) => e.beat >= from - 1e-9);
    let loopStart = 0;
    if (next < 0) {
      next = 0;
      loopStart = this.length;
    }
    this.run = {
      out,
      tempo,
      bpm: this.song.bpm * tempo,
      anchorBeat: from, // the beat at anchorTime, counted from the top of the first time through
      anchorTime: this.ctx.currentTime + 0.05,
      loopStart, // the beat where the time through the song of the next event began
      next,
    };
  }

  /** Stops at once (with a very short fade) and remembers where. */
  stop() {
    const run = this.run;
    if (!run) return;
    const beat = Math.max(run.anchorBeat, this.beatNow());
    this.position = ((beat % this.length) + this.length) % this.length;
    run.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    setTimeout(() => run.out.disconnect(), 300);
    this.run = null;
  }

  /** A new speed from now on: the notes already scheduled keep the old one. */
  retime(tempo) {
    const run = this.run;
    run.anchorBeat = this.beatNow();
    run.anchorTime = this.ctx.currentTime;
    run.tempo = tempo;
    run.bpm = this.song.bpm * tempo;
  }

  beatNow() {
    const run = this.run;
    return run.anchorBeat + ((this.ctx.currentTime - run.anchorTime) * run.bpm) / 60;
  }

  /** Sends to the audio clock every note that starts in the next LOOKAHEAD seconds. */
  schedule() {
    const run = this.run;
    const until = this.beatNow() + (LOOKAHEAD * run.bpm) / 60;
    const secondsPerBeat = 60 / run.bpm;
    for (;;) {
      const e = this.events[run.next];
      const beat = run.loopStart + e.beat;
      if (beat > until) break;
      const time = Math.max(this.ctx.currentTime, run.anchorTime + (beat - run.anchorBeat) * secondsPerBeat);
      if (e.voice === 'drum') this.drum(run.out, e.kind, time);
      else this.note(run.out, e.voice, e.midi, time, e.beats * secondsPerBeat);
      if (++run.next === this.events.length) {
        // the end of the song: from the top again
        run.next = 0;
        run.loopStart += this.length;
      }
    }
  }

  // ---------------------------------------------------------------- the voices

  /** A pulse wave with the given duty cycle: the share of each period spent high. */
  pulse(duty) {
    if (!this.waves[duty]) {
      const n = 48;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let k = 1; k < n; k++) {
        real[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
        imag[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
      }
      this.waves[duty] = this.ctx.createPeriodicWave(real, imag);
    }
    return this.waves[duty];
  }

  note(out, voice, midi, time, seconds) {
    const ctx = this.ctx;
    const v = VOICES[voice];
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const end = time + seconds * v.gate;
    const osc = ctx.createOscillator();
    if (v.duty) osc.setPeriodicWave(this.pulse(v.duty));
    else osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    // a quick attack, then the note settles to two thirds, like the old chips' volume envelope
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, time);
    amp.gain.linearRampToValueAtTime(v.volume, time + 0.004);
    amp.gain.setTargetAtTime(v.volume * 0.65, time + 0.004, 0.15);
    amp.gain.setTargetAtTime(0, end - 0.012, 0.012);
    osc.connect(amp).connect(out);
    if (v.vibrato && end - time > 0.3) {
      // long notes of the melody start to waver after a moment
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.5;
      depth.gain.setValueAtTime(0, time);
      depth.gain.linearRampToValueAtTime(freq * 0.007, time + 0.35);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(time);
      lfo.stop(end + 0.1);
    }
    osc.start(time);
    osc.stop(end + 0.1);
  }

  drum(out, kind, time) {
    const ctx = this.ctx;
    if (kind === 'k') {
      // the kick: a triangle wave falling fast from 170 to 42 Hz
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(170, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.09);
      amp.gain.setValueAtTime(0.42, time);
      amp.gain.exponentialRampToValueAtTime(0.001, time + 0.13);
      osc.connect(amp).connect(out);
      osc.start(time);
      osc.stop(time + 0.15);
      return;
    }
    // the hi-hat and the snare: a short burst of noise, high or in the middle
    const hat = kind === 'h';
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = hat ? 'highpass' : 'bandpass';
    filter.frequency.value = hat ? 7000 : 1900;
    filter.Q.value = hat ? 0.7 : 0.6;
    const amp = ctx.createGain();
    const length = hat ? 0.035 : 0.13;
    amp.gain.setValueAtTime(hat ? 0.07 : 0.16, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + length);
    src.connect(filter).connect(amp).connect(out);
    src.start(time, Math.random() * 0.5);
    src.stop(time + length + 0.02);
  }
}

/**
 * One second of noise made the way the old chips made it: a 15-bit shift register,
 * stepped about 16,000 times per second, its last bit giving +1 or −1.
 */
function noiseBuffer(ctx) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const every = Math.round(ctx.sampleRate / 16000);
  let register = 0x7fff;
  let value = 1;
  for (let i = 0; i < data.length; i++) {
    if (i % every === 0) {
      const bit = (register ^ (register >> 1)) & 1;
      register = (register >> 1) | (bit << 14);
      value = register & 1 ? 1 : -1;
    }
    data[i] = value;
  }
  return buffer;
}
