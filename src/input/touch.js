// Touch controls for phones and tablets, on the board itself:
//   drag left or right   → move, one column per column of finger travel
//   tap                  → rotate clockwise
//   drag down slowly     → soft drop, while the finger stays down
//   flick down           → hard drop
//   flick up             → hold
// Pointer events cover fingers and pens; the mouse is left to the keyboard player.

const TAP_DISTANCE = 12; // px: a finger moving less than this is tapping
const TAP_TIME = 300; // ms: and lifting within this time
const FLICK_TIME = 250; // ms: a short gesture…
const FAST = 0.9; // px/ms: …or one this fast at the end is a flick
const SLOW = 0.5; // px/ms: a downward drag slower than this is a soft drop

/**
 * tap(button): press and release at once; press/release: for the soft drop;
 * cellSize(): the board's cell size in CSS pixels; active(): true while playing.
 */
export function attachTouch(surface, { tap, press, release, cellSize, active }) {
  let touch = null;

  surface.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !active() || touch) return;
    e.preventDefault();
    surface.setPointerCapture(e.pointerId);
    touch = {
      id: e.pointerId,
      x0: e.clientX, // where and when the finger came down
      y0: e.clientY,
      t0: e.timeStamp,
      anchorX: e.clientX, // where the last one-column move happened
      lastY: e.clientY,
      lastT: e.timeStamp,
      vy: 0, // vertical speed, in px per millisecond (positive = downward)
      moved: false,
      soft: false,
    };
  });

  surface.addEventListener('pointermove', (e) => {
    if (!touch || e.pointerId !== touch.id || !active()) return;
    const step = cellSize() * 0.9;
    let dx = e.clientX - touch.anchorX;
    while (dx >= step) {
      tap('right');
      touch.anchorX += step;
      dx -= step;
      touch.moved = true;
    }
    while (dx <= -step) {
      tap('left');
      touch.anchorX -= step;
      dx += step;
      touch.moved = true;
    }
    // the speed is smoothed over the last moves, so one jittery sample does not count
    const dt = e.timeStamp - touch.lastT;
    if (dt > 0) touch.vy = 0.5 * touch.vy + 0.5 * ((e.clientY - touch.lastY) / dt);
    touch.lastY = e.clientY;
    touch.lastT = e.timeStamp;

    const dy = e.clientY - touch.y0;
    const downward = dy > cellSize() * 1.2 && dy > Math.abs(e.clientX - touch.x0);
    if (!touch.soft && downward && touch.vy < SLOW && e.timeStamp - touch.t0 > 120) {
      press('down');
      touch.soft = true;
    }
  });

  const end = (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = e.clientX - touch.x0;
    const dy = e.clientY - touch.y0;
    const duration = e.timeStamp - touch.t0;
    const flick = duration < FLICK_TIME || Math.abs(touch.vy) > FAST;
    const far = cellSize() * 1.2;
    if (touch.soft) {
      release('down');
      if (touch.vy > FAST && active()) tap('hardDrop'); // a slow drag that ends in a flick
    } else if (e.type === 'pointercancel' || !active()) {
      // the gesture was interrupted: do nothing
    } else if (!touch.moved && Math.hypot(dx, dy) < TAP_DISTANCE && duration < TAP_TIME) tap('rotateCW');
    else if (flick && dy > far && dy > Math.abs(dx) * 1.5) tap('hardDrop');
    else if (flick && -dy > far && -dy > Math.abs(dx) * 1.5) tap('hold');
    touch = null;
  };
  surface.addEventListener('pointerup', end);
  surface.addEventListener('pointercancel', end);
}

/** On-screen buttons (rotate left, hold, pause) react on touch, without the click delay. */
export function attachButtons(buttons, onButton) {
  for (const el of buttons) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      onButton(el.dataset.button);
    });
    // keyboard and screen-reader users still get a normal click
    el.addEventListener('click', (e) => {
      if (e.detail === 0) onButton(el.dataset.button);
    });
  }
}
