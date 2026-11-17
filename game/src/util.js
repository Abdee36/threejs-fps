// Small shared helpers. The scratch vectors are module-level singletons reused by
// every hot loop, so the simulation never allocates a Vector3 per frame.
import * as THREE from 'three';

export function mulberry32(initial) {
  let a = initial | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function formatMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Scratch space: every module that needs a temporary vector uses one of these.
export const _v1 = new THREE.Vector3();
export const _v2 = new THREE.Vector3();
export const _v3 = new THREE.Vector3();
export const _dir = new THREE.Vector3();
export const _ray = new THREE.Raycaster();
