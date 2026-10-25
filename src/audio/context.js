// One AudioContext for the sounds and the music.
// Browsers let a page play audio only after a click or a key press on it: until then the
// context waits, suspended, and the first click or key press wakes it up.

let ctx = null;

/** The shared AudioContext, created on first use; null in a browser without Web Audio. */
export function audioContext() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  }
  wake();
  return ctx;
}

function wake() {
  if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
}

for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, wake, { capture: true });
