// RIDGE RUN — input: keyboard flight controls plus the menu buttons.
// W / Up climbs, S / Down descends, A D / arrows bank, Shift / Ctrl work
// the throttle, F flaps, G gear, R reset, P pause, M mute, C camera.

export function attachInput(game) {
  const keys = new Set();
  const input = { pitch: 0, roll: 0, throttle: 0 };

  function recompute() {
    input.pitch = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) +
      (keys.has('KeyS') || keys.has('ArrowDown') ? -1 : 0);
    input.roll = (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) +
      (keys.has('KeyD') || keys.has('ArrowRight') ? -1 : 0);
    input.throttle = (keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('Equal') ? 1 : 0) +
      (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('Minus') ? -1 : 0);
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    // One-shot keys.
    if (e.code === 'KeyF') { game.toggleFlaps(); return; }
    if (e.code === 'KeyG') { game.toggleGear(); return; }
    if (e.code === 'KeyR') { game.resetRun(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { game.togglePause(); return; }
    if (e.code === 'KeyM') { game.toggleMute(); return; }
    if (e.code === 'KeyC') { game.toggleCamera(); return; }
    if (e.code === 'Enter') { game.confirm(); return; }
    if (e.code === 'Space') { e.preventDefault(); game.confirm(); return; }
    keys.add(e.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    recompute();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    recompute();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recompute();
  });

  return input;
}
