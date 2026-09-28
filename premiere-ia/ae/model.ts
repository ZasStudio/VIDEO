// Data model shared by the After Effects generator (mirrors ae/runtime.jsx).

export const FPS = 30;
export type Vec = number[];
export type PathVal = {v: Vec[]; i: Vec[]; o: Vec[]; c: 0 | 1};
export type Anim<T> = {k: [number, T][]; h?: 1; e?: number};
export type V<T> = T | Anim<T>;

export type Tr = {a?: V<Vec>; p?: V<Vec>; s?: V<Vec>; r?: V<number>; o?: V<number>};

export type Item =
  | {t: 'g'; n?: string; it: Item[]; tr?: Tr}
  | {t: 'path'; d: V<PathVal>}
  | {t: 'rect'; sz: V<Vec>; p: V<Vec>; r?: V<number>}
  | {t: 'ell'; sz: V<Vec>; p: V<Vec>}
  | {t: 'fill'; c: V<Vec>; o?: V<number>}
  | {t: 'stroke'; c: V<Vec>; w: V<number>; o?: V<number>; lc?: 1 | 2 | 3; lj?: 1 | 2 | 3}
  | {t: 'merge'; m: number}
  | {t: 'trim'; s?: V<number>; e?: V<number>};

export type TextStyle = {
  s: string;
  font: string;
  size: number;
  fill?: Vec;
  stroke?: Vec;
  sw?: number;
  just?: 'l' | 'c' | 'r';
  track?: number;
  lead?: number;
  keys?: [number, string][];
};

export type TextAnimator = {name?: string; o?: number; s?: number; p?: Vec; start?: V<number>; end?: V<number>};

export type Layer = {
  t: 'null' | 'shape' | 'text' | 'solid' | 'adjust' | 'comp' | 'footage';
  name: string;
  parent?: string;
  start?: number;
  in?: number;
  out?: number;
  dur?: number;
  tr?: Tr;
  items?: Item[];
  txt?: TextStyle;
  anim?: TextAnimator[];
  color?: Vec;
  w?: number;
  h?: number;
  src?: string;
  blend?: 'screen' | 'add' | 'multiply' | 'overlay';
  matte?: 1;
  fx?: {m: string; p: Record<number, V<number | Vec>>}[];
  audio?: V<Vec>;
  expr?: Partial<Record<'a' | 'p' | 's' | 'r' | 'o', string>>;
  guide?: 1;
  shy?: 1;
};

export type Comp = {name: string; folder: string; w: number; h: number; dur: number; fps: number; bg?: Vec; layers: Layer[]};

// ---------- helpers ----------

export const hex = (h: string, alpha?: number): Vec => {
  const m = h.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const out = [r, g, b].map((x) => Math.round(x * 1000) / 1000);
  return alpha === undefined ? out : [...out, alpha];
};

export const rgba = (h: string) => hex(h, 1);

export const round = (x: number, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round(x * f) / f;
};

const roundV = (v: number | Vec, d: number): number | Vec => (Array.isArray(v) ? v.map((x) => round(x, d)) : round(v, d));

const dist = (a: number | Vec, b: number | Vec) => {
  if (Array.isArray(a) && Array.isArray(b)) return Math.max(...a.map((x, i) => Math.abs(x - b[i])));
  return Math.abs((a as number) - (b as number));
};

const lerpV = (a: number | Vec, b: number | Vec, t: number): number | Vec =>
  Array.isArray(a) && Array.isArray(b) ? a.map((x, i) => x + (b[i] - x) * t) : (a as number) + ((b as number) - (a as number)) * t;

/**
 * Sample fn(frame) on [f0, f1] every `step` frames and drop keys that linear
 * interpolation already reproduces within `tol`. Times are in seconds, relative to `t0Frame`.
 */
export function sample<T extends number | Vec>(
  fn: (frame: number) => T,
  f0: number,
  f1: number,
  opts: {step?: number; tol?: number; d?: number; t0?: number} = {},
): V<T> {
  const step = opts.step ?? 1;
  const tol = opts.tol ?? 0.05;
  const d = opts.d ?? 2;
  const t0 = opts.t0 ?? 0;
  const frames: number[] = [];
  for (let f = f0; f < f1; f += step) frames.push(f);
  frames.push(f1);
  const vals = frames.map((f) => roundV(fn(f), d) as T);
  // constant?
  if (vals.every((v) => dist(v, vals[0]) <= tol)) return vals[0];
  const keep: number[] = [0];
  let anchor = 0;
  for (let i = 1; i < frames.length - 1; i++) {
    // can we skip i? check all points between anchor and i+1
    let ok = true;
    for (let j = anchor + 1; j <= i; j++) {
      const t = (frames[j] - frames[anchor]) / (frames[i + 1] - frames[anchor]);
      if (dist(lerpV(vals[anchor], vals[i + 1], t), vals[j]) > tol) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      keep.push(i);
      anchor = i;
    }
  }
  keep.push(frames.length - 1);
  return {k: keep.map((i) => [round((frames[i] - t0) / FPS, 4), vals[i]] as [number, T])};
}

/** Hold keyframes for a stepped value (only emitted where it changes). */
export function holds<T>(fn: (frame: number) => T, f0: number, f1: number, t0 = 0): V<T> {
  const k: [number, T][] = [];
  let last: string | null = null;
  for (let f = f0; f <= f1; f++) {
    const v = fn(f);
    const s = JSON.stringify(v);
    if (s !== last) {
      k.push([round((f - t0) / FPS, 4), v]);
      last = s;
    }
  }
  if (k.length === 1) return k[0][1];
  return {k, h: 1};
}

/** Explicit keyframes in frames -> seconds. */
export const keys = <T>(list: [number, T][], ease?: number): Anim<T> => ({
  k: list.map(([f, v]) => [round(f / FPS, 4), v] as [number, T]),
  ...(ease ? {e: ease} : {}),
});
