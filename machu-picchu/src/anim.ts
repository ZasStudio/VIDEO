import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Clamped interpolation with an ease-out by default. */
export const ramp = (
  frame: number,
  from: number,
  to: number,
  out: [number, number] = [0, 1],
  easing: (t: number) => number = EASE_OUT,
) => interpolate(frame, [from, to], out, { ...CLAMP, easing });

/** Springy 0 -> 1 starting at `start`. */
export const pop = (
  frame: number,
  start: number,
  config: { damping?: number; stiffness?: number; mass?: number } = {},
) =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: { damping: 11, stiffness: 170, mass: 0.7, ...config },
  });

/** Smooth 0 -> 1 spring without overshoot. */
export const glide = (frame: number, start: number, durationInFrames = 18) =>
  spring({
    frame: frame - start,
    fps: FPS,
    config: { damping: 200 },
    durationInFrames,
  });

/** Visible window helper: 1 inside [from, to), with eased fades at both ends. */
export const windowIn = (frame: number, from: number, to: number, fade = 6) =>
  Math.min(
    ramp(frame, from, from + fade),
    1 - ramp(frame, to - fade, to, [0, 1], EASE_IN_OUT),
  );

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
) => interpolate(frame, frames, values, { ...CLAMP, easing });

/** Camera/screen shake from a list of impacts. Returns offsets in pixels and degrees. */
export const shake = (
  frame: number,
  impacts: { at: number; amp: number; dur?: number }[],
) => {
  let x = 0;
  let y = 0;
  let r = 0;
  for (const im of impacts) {
    const d = frame - im.at;
    const dur = im.dur ?? 12;
    if (d < 0 || d > dur) continue;
    const k = im.amp * Math.pow(1 - d / dur, 2);
    x += Math.sin(d * 2.9 + im.at) * k;
    y += Math.cos(d * 3.7 + im.at * 0.7) * k * 0.8;
    r += Math.sin(d * 2.3 + im.at * 1.3) * k * 0.04;
  }
  return { x, y, r };
};
