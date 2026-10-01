import {Easing, interpolate, spring} from 'remotion';
import {FPS} from './edit';

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

// Curvas fuertes (filosofía de animación de Emil Kowalski):
// ease-out para entradas/salidas, ease-in-out para movimiento en pantalla.
// EASE_IN solo para aceleraciones de cámara hacia un corte, nunca para entradas.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IN_OUT = Easing.bezier(0.77, 0, 0.175, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Clamped interpolation with an ease-out by default. */
export const ramp = (
  frame: number,
  from: number,
  to: number,
  out: [number, number] = [0, 1],
  easing: (t: number) => number = EASE_OUT,
) => interpolate(frame, [from, to], out, {...CLAMP, easing});

/** Springy 0 -> 1 starting at `start`. */
export const pop = (
  frame: number,
  start: number,
  config: {damping?: number; stiffness?: number; mass?: number} = {},
) =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: {damping: 11, stiffness: 170, mass: 0.7, ...config},
  });

/** Smooth 0 -> 1 spring without overshoot. */
export const glide = (frame: number, start: number, durationInFrames = 18) =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: {damping: 200},
    durationInFrames,
  });

/** Visible window helper: 1 inside [from, to), with eased fades at both ends. */
export const windowIn = (frame: number, from: number, to: number, fade = 6) =>
  Math.min(ramp(frame, from, from + fade), 1 - ramp(frame, to - fade, to, [0, 1], EASE_IN_OUT));

/** Deterministic pseudo random in [0, 1). */
export const rand = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Linear piecewise keyframes with easing between each pair. */
export const keyframes = (
  frame: number,
  frames: number[],
  values: number[],
  easing: (t: number) => number = EASE_IN_OUT,
) => interpolate(frame, frames, values, {...CLAMP, easing});

/**
 * Entrada con resorte que nunca parte de scale(0): escala 0.82 -> 1 (con un leve rebote)
 * y opacidad 0 -> 1. Devuelve propiedades listas para `style`.
 */
export const appear = (frame: number, start: number, from = 0.82) => {
  // Resorte suave tipo Apple: rebote ~0.15, asentamiento largo.
  const s = pop(frame, start, {damping: 15, stiffness: 120, mass: 0.8});
  return {
    opacity: clamp01((frame - start) / 5),
    scale: String(from + (1 - from) * s),
  };
};
