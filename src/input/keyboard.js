// Keyboard controls.
//
// e.code names the physical key ("KeyZ"), whatever the keyboard layout prints on it,
// so the controls sit in the same place on every keyboard.

const BUTTON_KEYS = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'down',
  Space: 'hardDrop',
  ArrowUp: 'rotateCW',
  KeyX: 'rotateCW',
  KeyZ: 'rotateCCW',
  KeyC: 'hold',
  ShiftLeft: 'hold',
  ShiftRight: 'hold',
};

const COMMAND_KEYS = {
  Escape: 'pause',
  KeyP: 'pause',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  KeyR: 'restart',
  KeyM: 'sound',
  KeyN: 'music',
};

/**
 * onPress(button) / onRelease(button): game buttons ('left', 'hardDrop'…).
 * onCommand(name): 'pause', 'confirm', 'restart', 'sound', 'music'.
 * capturing(): true while the game owns the keys (arrows and space must not scroll the page).
 */
export function attachKeyboard({ onPress, onRelease, onCommand, capturing }) {
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts alone
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return; // typing a name: R is a letter
    const button = BUTTON_KEYS[e.code];
    if (button && capturing()) {
      e.preventDefault();
      if (!e.repeat) onPress(button); // the game does its own key repeat
      return;
    }
    const command = COMMAND_KEYS[e.code];
    if (!command || e.repeat) return;
    // Enter on a focused button or link already clicks it: do not act twice.
    if (command === 'confirm' && e.target instanceof Element && e.target.closest('button, a')) return;
    e.preventDefault();
    onCommand(command);
  });

  window.addEventListener('keyup', (e) => {
    const button = BUTTON_KEYS[e.code];
    if (!button) return;
    if (capturing()) e.preventDefault();
    onRelease(button); // always, so that no key stays stuck down
  });
}
