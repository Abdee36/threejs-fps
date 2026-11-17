// Keyboard, mouse and pointer lock. Owns nothing about the game: it only reports
// what the player is doing, so the simulation can stay testable without a browser.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const state = {
    keys,
    firing: false,
    locked: false,
    lookX: 0,
    lookY: 0,
  };

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space') event.preventDefault();
  }
  function onKeyUp(event) {
    keys.delete(event.code);
  }
  function onMouseDown(event) {
    if (event.button === 0) state.firing = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) state.firing = false;
  }
  function onMouseMove(event) {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  }
  function onLock() {
    state.locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(state.locked);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLock);

  return {
    state,
    requestLock() {
      canvas.requestPointerLock();
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    // Consume this frame's accumulated look deltas.
    takeLook() {
      const look = { x: state.lookX, y: state.lookY };
      state.lookX = 0;
      state.lookY = 0;
      return look;
    },
    pressed(code) {
      if (!keys.has(code)) return false;
      keys.delete(code);
      return true;
    },
  };
}
