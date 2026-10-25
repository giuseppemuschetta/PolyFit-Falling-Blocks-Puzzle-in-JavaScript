// Short sounds made on the spot with the Web Audio API: no audio files. Off by default;
// the player turns them on with the sound button or M. The music is apart (music.js).

import { audioContext } from './context.js';

// A major pentatonic scale from C5: every combination of these notes sounds pleasant.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.out = null;
  }

  /** Browsers allow sound only after a click or a key press: call this from one. */
  setEnabled(on) {
    this.enabled = on;
    if (!on) return;
    if (!this.ctx) {
      this.ctx = audioContext();
      if (!this.ctx) return;
      // a compressor keeps several sounds at once from getting too loud
      this.out = this.ctx.createDynamicsCompressor();
      this.out.connect(this.ctx.destination);
    }
  }

  /** One note: a frequency that can slide, with a quick fade in and a fade out. */
  tone(freq, { at = 0, dur = 0.08, type = 'triangle', gain = 0.12, slide = 1 } = {}) {
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide !== 1) osc.frequency.exponentialRampToValueAtTime(freq * slide, t0 + dur);
    amp.gain.setValueAtTime(0.0001, t0);
    amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(this.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  play(name, detail = {}) {
    if (!this.enabled || !this.ctx) return;
    switch (name) {
      case 'move':
        this.tone(NOTES[2] * 2, { dur: 0.025, gain: 0.03 });
        break;
      case 'rotate':
        this.tone(NOTES[4], { dur: 0.05, gain: 0.05, slide: 1.12 });
        break;
      case 'hold':
        this.tone(NOTES[1], { dur: 0.06, gain: 0.06 });
        this.tone(NOTES[3], { at: 0.05, dur: 0.07, gain: 0.06 });
        break;
      case 'lock':
        this.tone(150, { dur: 0.09, type: 'sine', gain: 0.18, slide: 0.7 });
        break;
      case 'drop':
        this.tone(110, { dur: 0.12, type: 'sine', gain: 0.25, slide: 0.5 });
        break;
      case 'clear': {
        // one rising note per line; a T-spin gets a brighter sound
        const lines = Math.max(1, detail.lines);
        const type = detail.tspin && detail.tspin !== 'none' ? 'square' : 'triangle';
        for (let i = 0; i < lines; i++) {
          this.tone(NOTES[i * 2], { at: i * 0.06, dur: 0.16, type, gain: type === 'square' ? 0.05 : 0.11 });
        }
        if (lines === 4) {
          // PolyFit!: a little chord on top
          for (const n of [5, 6, 7]) this.tone(NOTES[n], { at: 0.26, dur: 0.35, gain: 0.07 });
        }
        break;
      }
      case 'level':
        [3, 4, 5].forEach((n, i) => this.tone(NOTES[n], { at: i * 0.08, dur: 0.12, gain: 0.07 }));
        break;
      case 'count':
        this.tone(NOTES[0], { dur: 0.1, type: 'sine', gain: 0.12 });
        break;
      case 'go':
        this.tone(NOTES[5], { dur: 0.22, type: 'sine', gain: 0.14 });
        break;
      case 'over':
        [5, 3, 1].forEach((n, i) => this.tone(NOTES[n] / 2, { at: i * 0.14, dur: 0.24, gain: 0.1 }));
        break;
    }
  }
}
