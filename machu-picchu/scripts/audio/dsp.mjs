// =============================================================================
// scripts/audio/dsp.mjs - DSP core shared by the music and SFX generators.
// Pure math, zero dependencies, deterministic (seeded PRNG, never Math.random).
// Mono buffers are Float64Array, stereo buffers are { L, R }.
// =============================================================================

import { writeFileSync, readFileSync } from 'node:fs';

export const SR = 48000;
export const TAU = Math.PI * 2;

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------
export const dbToGain = (db) => Math.pow(10, db / 20);
export const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const samples = (sec) => Math.max(1, Math.round(sec * SR));
export const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const expInterp = (a, b, t) => a * Math.pow(b / a, clamp(t, 0, 1));
export const cents = (c) => Math.pow(2, c / 1200);

// ----------------------------------------------------------------------------
// Seeded PRNG (mulberry32). Every generator gets its own stream.
// ----------------------------------------------------------------------------
export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    bi: () => next() * 2 - 1,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    // exponential inter-arrival time for a Poisson process of `rate` events/s
    exp: (rate) => -Math.log(1 - next()) / rate,
  };
}

// ----------------------------------------------------------------------------
// Buffers
// ----------------------------------------------------------------------------
export const stereoN = (n) => ({ L: new Float64Array(n), R: new Float64Array(n) });
export const stereo = (sec) => stereoN(samples(sec));

// Equal-power pan, p in [-1, 1]; unity gain on both sides at centre.
export function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

// Mix a mono source into a stereo bus at time t (seconds).
export function addMono(bus, src, t, gain = 1, pan = 0) {
  const off = Math.round(t * SR);
  const [gl, gr] = panGains(pan);
  const end = Math.min(src.length, bus.L.length - off);
  for (let i = Math.max(0, -off); i < end; i++) {
    const v = src[i] * gain;
    bus.L[off + i] += v * gl;
    bus.R[off + i] += v * gr;
  }
}

// Mix a stereo source into a stereo bus at time t (seconds).
export function addStereo(bus, src, t, gain = 1) {
  const off = Math.round(t * SR);
  const end = Math.min(src.L.length, bus.L.length - off);
  for (let i = Math.max(0, -off); i < end; i++) {
    bus.L[off + i] += src.L[i] * gain;
    bus.R[off + i] += src.R[i] * gain;
  }
}

export function monoToStereo(x, pan = 0) {
  const out = stereoN(x.length);
  addMono(out, x, 0, 1, pan);
  return out;
}

export function peakMono(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]);
    if (a > p) p = a;
  }
  return p;
}

export const peakOf = (buf) => Math.max(peakMono(buf.L), peakMono(buf.R));

export function scaleBuf(buf, g) {
  for (const ch of [buf.L, buf.R]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return buf;
}

export function normalizePeak(buf, db) {
  const p = peakOf(buf);
  if (p > 0) scaleBuf(buf, dbToGain(db) / p);
  return buf;
}

export function normMono(y, peak = 1) {
  const p = peakMono(y);
  if (p > 0) for (let i = 0; i < y.length; i++) y[i] *= peak / p;
  return y;
}

// Linear fade over the last `sec` seconds (declick).
export function tailFade(y, sec) {
  const m = Math.min(y.length, samples(sec));
  for (let k = 0; k < m; k++) y[y.length - 1 - k] *= k / m;
  return y;
}

// Linear fade over the first `sec` seconds.
export function headFade(y, sec) {
  const m = Math.min(y.length, samples(sec));
  for (let k = 0; k < m; k++) y[k] *= k / m;
  return y;
}

// Raised-cosine fade out from `startSec` to `endSec`, hard zero afterwards.
export function fadeOutRange(buf, startSec, endSec) {
  const a = Math.round(startSec * SR);
  const b = Math.round(endSec * SR);
  for (let i = Math.max(0, a); i < buf.L.length; i++) {
    const g = i >= b ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / (b - a));
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
  return buf;
}

// Raised-cosine fade in over the first `sec` seconds.
export function fadeIn(buf, sec) {
  const m = Math.min(buf.L.length, samples(sec));
  for (let i = 0; i < m; i++) {
    const g = 0.5 - 0.5 * Math.cos((Math.PI * i) / m);
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
  return buf;
}

// Digital silence in [fromSec, toSec) with a raised-cosine fade of `fadeSec`
// before it and an optional fade back in after it.
export function gateRange(buf, fromSec, toSec, fadeSec = 0.006, fadeInSec = 0) {
  const a = Math.round(fromSec * SR);
  const b = Math.round(toSec * SR);
  const f = samples(fadeSec);
  for (let i = Math.max(0, a - f); i < a; i++) {
    const g = 0.5 + 0.5 * Math.cos((Math.PI * (i - (a - f))) / f);
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
  for (let i = a; i < Math.min(b, buf.L.length); i++) {
    buf.L[i] = 0;
    buf.R[i] = 0;
  }
  if (fadeInSec > 0) {
    const fi = samples(fadeInSec);
    for (let i = b; i < Math.min(b + fi, buf.L.length); i++) {
      const g = 0.5 - 0.5 * Math.cos((Math.PI * (i - b)) / fi);
      buf.L[i] *= g;
      buf.R[i] *= g;
    }
  }
  return buf;
}

export function fitLength(buf, n) {
  const out = stereoN(n);
  const m = Math.min(n, buf.L.length);
  out.L.set(buf.L.subarray(0, m));
  out.R.set(buf.R.subarray(0, m));
  return out;
}

// RMS (both channels) over one or more [a, b) second ranges.
export function rmsOf(buf, ranges) {
  let s = 0;
  let n = 0;
  for (const [a, b] of ranges) {
    const i0 = Math.max(0, Math.round(a * SR));
    const i1 = Math.min(buf.L.length, Math.round(b * SR));
    for (let i = i0; i < i1; i++) s += buf.L[i] * buf.L[i] + buf.R[i] * buf.R[i];
    n += Math.max(0, i1 - i0);
  }
  return Math.sqrt(s / (2 * Math.max(1, n)));
}

// ----------------------------------------------------------------------------
// WAV I/O (RIFF, PCM 16-bit, stereo)
// ----------------------------------------------------------------------------
function toInt16(x) {
  if (!Number.isFinite(x)) throw new Error('non-finite sample while writing WAV');
  return clamp(Math.round(clamp(x, -1, 1) * 32767), -32768, 32767);
}

export function writeWav(path, buf) {
  const n = buf.L.length;
  const dataBytes = n * 4;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16); // fmt chunk size
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(2, 22); // channels
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28); // byte rate
  b.writeUInt16LE(4, 32); // block align
  b.writeUInt16LE(16, 34); // bits per sample
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i++) {
    b.writeInt16LE(toInt16(buf.L[i]), o);
    b.writeInt16LE(toInt16(buf.R[i]), o + 2);
    o += 4;
  }
  writeFileSync(path, b);
}

export function readWav(path) {
  const b = readFileSync(path);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${path}: not a RIFF/WAVE file`);
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= b.length) {
    const id = b.toString('ascii', off, off + 4);
    const size = b.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = {
        format: b.readUInt16LE(off + 8),
        channels: b.readUInt16LE(off + 10),
        sampleRate: b.readUInt32LE(off + 12),
        bits: b.readUInt16LE(off + 22),
      };
    } else if (id === 'data') {
      data = { off: off + 8, size };
    }
    off += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${path}: missing fmt or data chunk`);
  if (fmt.format !== 1 || fmt.bits !== 16) throw new Error(`${path}: expected 16-bit PCM`);
  const frames = data.size / (fmt.channels * 2);
  const ch = Array.from({ length: fmt.channels }, () => new Float64Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      ch[c][i] = b.readInt16LE(data.off + (i * fmt.channels + c) * 2) / 32768;
    }
  }
  return { ...fmt, frames, duration: frames / fmt.sampleRate, ch };
}

// ----------------------------------------------------------------------------
// Filters
// ----------------------------------------------------------------------------

// Zero-delay-feedback state-variable filter (Simper/TPT). Stable when modulated.
export class SVF {
  constructor(fc = 1000, q = 0.707) {
    this.ic1 = 0;
    this.ic2 = 0;
    this.low = 0;
    this.band = 0;
    this.high = 0;
    this.set(fc, q);
  }
  set(fc, q) {
    const g = Math.tan((Math.PI * clamp(fc, 5, SR * 0.49)) / SR);
    this.k = 1 / Math.max(0.05, q);
    this.a1 = 1 / (1 + g * (g + this.k));
    this.a2 = g * this.a1;
    this.a3 = g * this.a2;
  }
  tick(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1;
    this.ic2 = 2 * v2 - this.ic2;
    this.low = v2;
    this.band = v1;
    this.high = v0 - this.k * v1 - v2;
    return v2;
  }
}

// Filter a mono array. type: 'lp' | 'hp' | 'bp' (unity gain at centre).
// fc and q may be numbers or functions of time in seconds (updated every 16 samples).
export function filt(x, type, fc, q = 0.707) {
  const y = new Float64Array(x.length);
  const fcAt = typeof fc === 'function' ? fc : () => fc;
  const qAt = typeof q === 'function' ? q : () => q;
  const dynamic = typeof fc === 'function' || typeof q === 'function';
  const f = new SVF(fcAt(0), qAt(0));
  for (let i = 0; i < x.length; i++) {
    if (dynamic && (i & 15) === 0) f.set(fcAt(i / SR), qAt(i / SR));
    f.tick(x[i]);
    y[i] = type === 'lp' ? f.low : type === 'hp' ? f.high : f.band * f.k;
  }
  return y;
}

export function filtStereo(buf, type, fc, q = 0.707) {
  buf.L = filt(buf.L, type, fc, q);
  buf.R = filt(buf.R, type, fc, q);
  return buf;
}

export function biquad(x, b0, b1, b2, a1, a2) {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = v;
    y[i] = v;
  }
  return y;
}

// RBJ-cookbook shelves (slope 1) and peaking EQ.
export function highShelf(x, f0, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TAU * f0) / SR;
  const cw = Math.cos(w0);
  const alpha = (Math.sin(w0) / 2) * Math.SQRT2;
  const sa = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cw + sa;
  return biquad(
    x,
    (A * (A + 1 + (A - 1) * cw + sa)) / a0,
    (-2 * A * (A - 1 + (A + 1) * cw)) / a0,
    (A * (A + 1 + (A - 1) * cw - sa)) / a0,
    (2 * (A - 1 - (A + 1) * cw)) / a0,
    (A + 1 - (A - 1) * cw - sa) / a0
  );
}

export function lowShelf(x, f0, gainDb) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TAU * f0) / SR;
  const cw = Math.cos(w0);
  const alpha = (Math.sin(w0) / 2) * Math.SQRT2;
  const sa = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 + (A - 1) * cw + sa;
  return biquad(
    x,
    (A * (A + 1 - (A - 1) * cw + sa)) / a0,
    (2 * A * (A - 1 - (A + 1) * cw)) / a0,
    (A * (A + 1 - (A - 1) * cw - sa)) / a0,
    (-2 * (A - 1 + (A + 1) * cw)) / a0,
    (A + 1 + (A - 1) * cw - sa) / a0
  );
}

export function peakEq(x, f0, gainDb, q = 1) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TAU * f0) / SR;
  const cw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha / A;
  return biquad(x, (1 + alpha * A) / a0, (-2 * cw) / a0, (1 - alpha * A) / a0, (-2 * cw) / a0, (1 - alpha / A) / a0);
}

// Apply a mono->mono function to both channels of a stereo buffer.
export function eachCh(buf, fn) {
  buf.L = fn(buf.L);
  buf.R = fn(buf.R);
  return buf;
}

// ----------------------------------------------------------------------------
// Oscillators and noise
// ----------------------------------------------------------------------------
export function polyBlep(t, dt) {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
}

export class Osc {
  constructor(phase = 0) {
    this.p = phase;
  }
  adv(dt) {
    this.p += dt;
    if (this.p >= 1) this.p -= Math.floor(this.p);
  }
  sine(freq) {
    const v = Math.sin(TAU * this.p);
    this.adv(freq / SR);
    return v;
  }
  saw(freq) {
    const dt = freq / SR;
    const v = 2 * this.p - 1 - polyBlep(this.p, dt);
    this.adv(dt);
    return v;
  }
  pulse(freq, pw = 0.5) {
    const dt = freq / SR;
    let v = this.p < pw ? 1 : -1;
    v += polyBlep(this.p, dt);
    v -= polyBlep((this.p - pw + 1) % 1, dt);
    this.adv(dt);
    return v;
  }
}

export function whiteNoise(n, rng) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = rng.bi();
  return y;
}

// Pink-ish noise (Paul Kellet's economy filter), roughly unit peak.
export function pinkNoise(n, rng) {
  const y = new Float64Array(n);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rng.bi();
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    y[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return y;
}

// Brown(ian) noise: leaky integrated white noise, normalised to unit peak.
export function brownNoise(n, rng) {
  const y = new Float64Array(n);
  let b = 0;
  for (let i = 0; i < n; i++) {
    b = 0.998 * b + 0.06 * rng.bi();
    y[i] = b;
  }
  return normMono(y);
}

// ----------------------------------------------------------------------------
// Effects
// ----------------------------------------------------------------------------

// Gentle saturation normalised so that sat(1) === 1.
export const sat = (x, drive) => Math.tanh(drive * x) / Math.tanh(drive);

// Soft clipper: linear below the knee, tanh-rounded above, never exceeds 1.
export function softClip(x, knee = 0.6) {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const s = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
  return x < 0 ? -s : s;
}

// Freeverb-style stereo reverb (8 damped combs + 4 allpasses per side).
// Returns the 100% wet signal, same length as the input.
const FV_COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const FV_APS = [556, 441, 341, 225];
export function freeverb(inp, { room = 0.84, damp = 0.25, width = 1 } = {}) {
  const n = inp.L.length;
  const scale = SR / 44100;
  const out = stereoN(n);
  const line = (len) => ({ buf: new Float64Array(Math.round(len * scale)), i: 0, store: 0 });
  const sides = [0, 23].map((spread) => ({
    combs: FV_COMBS.map((d) => line(d + spread)),
    aps: FV_APS.map((d) => line(d + spread)),
  }));
  const wet1 = 3 * (0.5 + width / 2);
  const wet2 = 3 * ((1 - width) / 2);
  const o = [0, 0];
  for (let i = 0; i < n; i++) {
    const x = (inp.L[i] + inp.R[i]) * 0.015;
    for (let c = 0; c < 2; c++) {
      let acc = 0;
      for (const cb of sides[c].combs) {
        const y = cb.buf[cb.i];
        cb.store = y * (1 - damp) + cb.store * damp;
        cb.buf[cb.i] = x + cb.store * room;
        if (++cb.i >= cb.buf.length) cb.i = 0;
        acc += y;
      }
      for (const ap of sides[c].aps) {
        const b = ap.buf[ap.i];
        ap.buf[ap.i] = acc + b * 0.5;
        if (++ap.i >= ap.buf.length) ap.i = 0;
        acc = b - acc;
      }
      o[c] = acc;
    }
    out.L[i] = o[0] * wet1 + o[1] * wet2;
    out.R[i] = o[1] * wet1 + o[0] * wet2;
  }
  return out;
}

// Ping-pong delay: first echo on the left, then right, then left...
// Feedback path is band-limited (one-pole LP + HP). Returns the wet signal.
export function pingPong(inp, { time = 0.3, feedback = 0.4, lp = 5000, hp = 250 } = {}) {
  const n = inp.L.length;
  const D = Math.max(1, Math.round(time * SR));
  const bl = new Float64Array(D);
  const br = new Float64Array(D);
  const out = stereoN(n);
  const a = 1 - Math.exp((-TAU * lp) / SR);
  const ah = 1 - Math.exp((-TAU * hp) / SR);
  let idx = 0;
  let lpl = 0;
  let lpr = 0;
  let hpl = 0;
  let hpr = 0;
  for (let i = 0; i < n; i++) {
    const yl = bl[idx];
    const yr = br[idx];
    out.L[i] = yl;
    out.R[i] = yr;
    lpl += a * (yl - lpl);
    lpr += a * (yr - lpr);
    hpl += ah * (lpl - hpl);
    hpr += ah * (lpr - hpr);
    bl[idx] = (inp.L[i] + inp.R[i]) * 0.5 + (lpr - hpr) * feedback;
    br[idx] = (lpl - hpl) * feedback;
    if (++idx >= D) idx = 0;
  }
  return out;
}

// Stereo chorus: two modulated delay taps (LFOs 90 degrees apart), mixed with dry.
export function chorus(inp, { base = 0.011, depth = 0.0022, rate = 0.45, mix = 0.4 } = {}) {
  const n = inp.L.length;
  const size = Math.ceil((base + depth) * SR) + 8;
  const bl = new Float64Array(size);
  const br = new Float64Array(size);
  const out = stereoN(n);
  const tap = (buf, w, d) => {
    let r = w - d;
    if (r < 0) r += size;
    const i0 = Math.floor(r);
    const fr = r - i0;
    return buf[i0] * (1 - fr) + buf[(i0 + 1) % size] * fr;
  };
  for (let i = 0; i < n; i++) {
    const w = i % size;
    bl[w] = inp.L[i];
    br[w] = inp.R[i];
    const ph = (TAU * rate * i) / SR;
    const dl = (base + depth * Math.sin(ph)) * SR;
    const dr = (base + depth * Math.sin(ph + Math.PI / 2)) * SR;
    out.L[i] = inp.L[i] * (1 - mix) + tap(bl, w, dl) * mix;
    out.R[i] = inp.R[i] * (1 - mix) + tap(br, w, dr) * mix;
  }
  return out;
}

// Feed-forward stereo-linked compressor with a soft knee ("glue").
export function compressor(buf, { thresholdDb = -18, ratio = 2, kneeDb = 6, attack = 0.02, release = 0.2, makeupDb = 0 } = {}) {
  const n = buf.L.length;
  const aA = Math.exp(-1 / (attack * SR));
  const aR = Math.exp(-1 / (release * SR));
  const dA = Math.exp(-1 / (0.001 * SR));
  const dR = Math.exp(-1 / (0.08 * SR));
  const mk = dbToGain(makeupDb);
  const slope = 1 / ratio - 1;
  let env = 0;
  let gr = 0;
  let maxGr = 0;
  let sumGr = 0;
  for (let i = 0; i < n; i++) {
    const x = Math.max(Math.abs(buf.L[i]), Math.abs(buf.R[i]));
    env = x > env ? dA * env + (1 - dA) * x : dR * env + (1 - dR) * x;
    const over = gainToDb(env + 1e-9) - thresholdDb;
    let target;
    if (2 * over < -kneeDb) target = 0;
    else if (2 * Math.abs(over) <= kneeDb) target = (slope * (over + kneeDb / 2) ** 2) / (2 * kneeDb);
    else target = slope * over;
    gr = target < gr ? aA * gr + (1 - aA) * target : aR * gr + (1 - aR) * target;
    const g = dbToGain(gr) * mk;
    buf.L[i] *= g;
    buf.R[i] *= g;
    if (gr < maxGr) maxGr = gr;
    sumGr += gr;
  }
  return { buf, maxGrDb: maxGr, meanGrDb: sumGr / n };
}

// Look-ahead peak limiter (stereo-linked). The gain is computed from a
// forward-looking window minimum followed by a box filter of the same length,
// which guarantees the gain has fully ramped down when the peak arrives.
export function limiter(buf, { ceilingDb = -1.2, lookSec = 0.005, releaseSec = 0.12 } = {}) {
  const n = buf.L.length;
  const ceil = dbToGain(ceilingDb);
  const la = Math.max(1, Math.round(lookSec * SR));
  const req = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(buf.L[i]), Math.abs(buf.R[i]));
    req[i] = p > ceil ? ceil / p : 1;
  }
  const m = new Float64Array(n);
  const dq = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let j = 0; j < n + la - 1; j++) {
    if (j < n) {
      while (tail > head && req[dq[tail - 1]] >= req[j]) tail--;
      dq[tail++] = j;
    }
    const i = j - la + 1;
    if (i >= 0) {
      while (dq[head] < i) head++;
      m[i] = req[dq[head]];
    }
  }
  const rel = Math.exp(-1 / (releaseSec * SR));
  let sum = 0;
  let g = 1;
  let minGain = 1;
  for (let i = 0; i < n; i++) {
    sum += m[i];
    if (i >= la) sum -= m[i - la];
    const target = sum / Math.min(i + 1, la);
    g = target < g ? target : target + (g - target) * rel;
    minGain = Math.min(minGain, g);
    buf.L[i] = clamp(buf.L[i] * g, -ceil, ceil);
    buf.R[i] = clamp(buf.R[i] * g, -ceil, ceil);
  }
  return { buf, maxReductionDb: gainToDb(minGain) };
}
