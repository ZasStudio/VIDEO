#!/usr/bin/env node
// =============================================================================
// scripts/generate-audio.mjs
//
// Procedural audio for the "claude-ia" Remotion video.
// Every sound is synthesized from math (oscillators, noise, envelopes, filters,
// delays, reverb). No samples, no downloads, no external services, zero npm deps.
// Deterministic: all randomness comes from seeded PRNGs (never Math.random).
//
//   node scripts/generate-audio.mjs
//
// Writes public/audio/*.wav (48 kHz, stereo, 16-bit PCM) and prints a
// verification report computed by re-reading the files from disk.
//
// Music: 100 BPM, 4/4, D major, 24 bars = 57.600 s (1 bar = 2.4 s = 72 frames @ 30 fps)
//   bars  0-1   intro      pad swell + sparse glass bells, riser into bar 2
//   bars  2-4   build      soft quarter kicks, hats, bass from bar 3, filter opens, roll
//   bars  5-6   drop       full groove, warm chord stabs, pluck arp
//   bars  7-11  bright     airy half-time, bells + plucks, no kick on bar 7 beat 1
//   bars 12-19  main       fullest groove, fills end of bars 15 and 19
//   bars 20-21  breakdown  soft hats only + pad + plucks, swell into bar 22
//   bars 22-23  resolve    final soft hit, tonic ring-out, silent last ~0.3 s
// =============================================================================

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'audio');

const SR = 48000;
const TAU = Math.PI * 2;

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------
const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const samples = (sec) => Math.max(1, Math.round(sec * SR));
const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const expInterp = (a, b, t) => a * Math.pow(b / a, clamp(t, 0, 1));

// ----------------------------------------------------------------------------
// Seeded PRNG (mulberry32) - every generator gets its own stream.
// ----------------------------------------------------------------------------
function makeRng(seed) {
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
  };
}

// ----------------------------------------------------------------------------
// Buffers. Mono = Float64Array, stereo = { L, R }. Float64 while mixing.
// ----------------------------------------------------------------------------
const stereoN = (n) => ({ L: new Float64Array(n), R: new Float64Array(n) });

// Equal-power pan, p in [-1, 1]; unity gain on both sides at center.
function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

function addMono(bus, src, t, gain = 1, pan = 0) {
  const off = Math.round(t * SR);
  const [gl, gr] = panGains(pan);
  const end = Math.min(src.length, bus.L.length - off);
  for (let i = Math.max(0, -off); i < end; i++) {
    const v = src[i] * gain;
    bus.L[off + i] += v * gl;
    bus.R[off + i] += v * gr;
  }
}

function addStereo(bus, src, t, gain = 1) {
  const off = Math.round(t * SR);
  const end = Math.min(src.L.length, bus.L.length - off);
  for (let i = Math.max(0, -off); i < end; i++) {
    bus.L[off + i] += src.L[i] * gain;
    bus.R[off + i] += src.R[i] * gain;
  }
}

function monoToStereo(x, pan = 0) {
  const out = stereoN(x.length);
  addMono(out, x, 0, 1, pan);
  return out;
}

function peakOf(buf) {
  let p = 0;
  for (const ch of [buf.L, buf.R]) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > p) p = a;
    }
  }
  return p;
}

function scaleBuf(buf, g) {
  for (const ch of [buf.L, buf.R]) for (let i = 0; i < ch.length; i++) ch[i] *= g;
  return buf;
}

function normalizePeak(buf, db) {
  const p = peakOf(buf);
  if (p > 0) scaleBuf(buf, dbToGain(db) / p);
  return buf;
}

function peakMono(x) {
  let p = 0;
  for (let i = 0; i < x.length; i++) p = Math.max(p, Math.abs(x[i]));
  return p;
}

function normMono(y, peak = 1) {
  const p = peakMono(y);
  if (p > 0) for (let i = 0; i < y.length; i++) y[i] *= peak / p;
  return y;
}

// Linear fade over the last `sec` seconds (declick).
function tailFade(y, sec) {
  const m = Math.min(y.length, samples(sec));
  for (let k = 0; k < m; k++) y[y.length - 1 - k] *= k / m;
  return y;
}

// Raised-cosine fade out from `startSec` to `endSec`, hard zero afterwards.
function fadeOutRange(buf, startSec, endSec) {
  const a = Math.round(startSec * SR);
  const b = Math.round(endSec * SR);
  for (let i = a; i < buf.L.length; i++) {
    const g = i >= b ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * (i - a)) / (b - a));
    buf.L[i] *= g;
    buf.R[i] *= g;
  }
  return buf;
}

// Multiply a stereo buffer by a per-sample gain array.
function applyGain(buf, g) {
  for (let i = 0; i < buf.L.length; i++) {
    buf.L[i] *= g[i];
    buf.R[i] *= g[i];
  }
  return buf;
}

// Sample an automation function (t -> value) and smooth it with a one-pole
// (time constant tau, optionally in the log domain for frequencies).
function automation(n, fn, tau = 0.15, log = false) {
  const y = new Float64Array(n);
  const a = 1 - Math.exp(-1 / (tau * SR));
  let s = log ? Math.log(fn(0)) : fn(0);
  for (let i = 0; i < n; i++) {
    const v = log ? Math.log(fn(i / SR)) : fn(i / SR);
    s += (v - s) * a;
    y[i] = log ? Math.exp(s) : s;
  }
  return y;
}
const fromArray = (arr) => (t) => arr[clamp(Math.round(t * SR), 0, arr.length - 1)];

// ----------------------------------------------------------------------------
// WAV I/O (RIFF, PCM 16-bit, stereo)
// ----------------------------------------------------------------------------
function toInt16(x) {
  if (!Number.isFinite(x)) throw new Error('non-finite sample while writing WAV');
  return clamp(Math.round(clamp(x, -1, 1) * 32767), -32768, 32767);
}

function writeWav(path, buf) {
  const n = buf.L.length;
  const dataBytes = n * 4;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + dataBytes, 4);
  b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); // PCM
  b.writeUInt16LE(2, 22); // channels
  b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
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

function readWav(path) {
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
  let fullScale = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      const v = b.readInt16LE(data.off + (i * fmt.channels + c) * 2);
      if (v >= 32767 || v <= -32767) fullScale++;
      ch[c][i] = v / 32768;
    }
  }
  return { ...fmt, frames, duration: frames / fmt.sampleRate, ch, fullScale };
}

// ----------------------------------------------------------------------------
// DSP building blocks
// ----------------------------------------------------------------------------

// Zero-delay-feedback state-variable filter (Simper/TPT). Stable when modulated.
class SVF {
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
function filt(x, type, fc, q = 0.707) {
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

function filtStereo(buf, type, fc, q = 0.707) {
  buf.L = filt(buf.L, type, fc, q);
  buf.R = filt(buf.R, type, fc, q);
  return buf;
}

// Gentle saturation normalised so that sat(1) === 1.
const sat = (x, drive) => Math.tanh(drive * x) / Math.tanh(drive);

// Soft clipper: linear below the knee, tanh-rounded above, never exceeds 1.
function softClip(x, knee = 0.6) {
  const a = Math.abs(x);
  if (a <= knee) return x;
  const s = knee + (1 - knee) * Math.tanh((a - knee) / (1 - knee));
  return x < 0 ? -s : s;
}

function biquad(x, b0, b1, b2, a1, a2) {
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

// RBJ-cookbook shelves (slope 1).
function highShelf(x, f0, gainDb) {
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
function lowShelf(x, f0, gainDb) {
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

// PolyBLEP band-limited oscillators (phase in [0, 1)).
function polyBlep(t, dt) {
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

class Osc {
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

function whiteNoise(n, rng) {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = rng.bi();
  return y;
}

// Pink-ish noise (Paul Kellet's economy filter), roughly unit peak.
function pinkNoise(n, rng) {
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

// Freeverb-style stereo reverb (8 damped combs + 4 allpasses per side). 100% wet.
const FV_COMBS = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const FV_APS = [556, 441, 341, 225];
function freeverb(inp, { room = 0.84, damp = 0.25, width = 1 } = {}) {
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

// Ping-pong delay (first echo left, then right...). Band-limited feedback. Wet only.
function pingPong(inp, { time = 0.3, feedback = 0.4, lp = 5000, hp = 250 } = {}) {
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
function chorus(inp, { base = 0.012, depth = 0.0025, rate = 0.35, mix = 0.35 } = {}) {
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

// Look-ahead peak limiter (stereo-linked).
function limiter(buf, { ceilingDb = -1.0, lookSec = 0.005, releaseSec = 0.15 } = {}) {
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

// ITU-R BS.1770 K-weighting (48 kHz biquads), used for stem balancing.
function kWeight(buf) {
  const k = (x) =>
    biquad(
      biquad(x, 1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585),
      1,
      -2,
      1,
      -1.99004745483398,
      0.99007225036621
    );
  return { L: k(buf.L), R: k(buf.R) };
}

// RMS (both channels) over one or more [a, b) second ranges.
function rmsOf(buf, ranges) {
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
// Drum voices (mono, peak-normalised to 1)
// ----------------------------------------------------------------------------

// Soft, round kick: sine with a gentle pitch drop, tiny click, light saturation.
function kickSoft({ f0 = 125, f1 = 47, pitchTau = 0.034, decay = 0.2, len = 0.5, click = 0.18, drive = 1.25, seed = 11 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / pitchTau);
    ph += (TAU * f) / SR;
    y[i] = Math.sin(ph) * Math.min(1, t / 0.0015) * (0.25 * Math.exp(-t / 0.05) + 0.75 * Math.exp(-t / decay));
    if (t < 0.005) y[i] += click * (0.4 * rng.bi() * Math.exp(-t / 0.0006) + 0.6 * Math.sin(TAU * 2400 * t) * Math.exp(-t / 0.0012));
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], drive);
  return normMono(tailFade(filt(y, 'lp', 6000), 0.03));
}

// Rimshot: two short pitched modes (wood/shell) + a band-passed noise click.
function rim({ tone = 1, seed = 21 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.12);
  const nz = filt(whiteNoise(n, rng), 'bp', 3200 * tone, 1.3);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const body = 0.8 * Math.sin(TAU * 470 * tone * t) * Math.exp(-t / 0.014) + 0.5 * Math.sin(TAU * 1680 * tone * t + 0.4) * Math.exp(-t / 0.007);
    y[i] = Math.min(1, t / 0.0004) * (body + 0.7 * nz[i] * Math.exp(-t / 0.005));
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], 1.3);
  return normMono(tailFade(filt(y, 'hp', 220), 0.015));
}

// Soft clap: band-passed noise with 4 quick bursts, short diffuse tail, rolled-off top.
function clap({ tail = 0.11, len = 0.45, seed = 31 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const nz = filt(filt(filt(whiteNoise(n, rng), 'bp', 1250, 1.0), 'hp', 600), 'lp', 6500);
  const bursts = [
    [0, 0.75],
    [0.009, 0.7],
    [0.019, 0.65],
    [0.029, 1.0],
  ];
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (const [tb, a] of bursts) if (t >= tb) e = Math.max(e, a * Math.exp(-(t - tb) / 0.005));
    if (t >= 0.029) e = Math.max(e, 0.5 * Math.exp(-(t - 0.029) / tail));
    y[i] = nz[i] * e;
  }
  return normMono(tailFade(y, 0.03));
}

// Closed / open hi-hat: six detuned squares (808 ratios) + noise, band-passed, softened top.
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
function hat({ open = false, tone = 1, decay = null, len = null, seed = 41 } = {}) {
  const rng = makeRng(seed);
  const d = decay ?? (open ? 0.22 : 0.028);
  const n = samples(len ?? (open ? 0.7 : 0.16));
  const oscs = HAT_FREQS.map(() => new Osc(rng.next()));
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let k = 0; k < 6; k++) m += oscs[k].pulse(HAT_FREQS[k] * 1.9 * tone);
    src[i] = (m / 6) * 0.5 + rng.bi() * 0.6;
  }
  const y = filt(filt(filt(src, 'bp', 8500 * tone, 0.7), 'hp', 5500), 'lp', 12500);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.0006) * (0.3 * Math.exp(-t / 0.006) + 0.7 * Math.exp(-t / d));
  }
  return normMono(tailFade(y, 0.01));
}

// Shaker: high band-passed noise with a soft (non-instant) attack.
function shaker({ seed = 45, bright = 1, len = 0.11 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const y = filt(filt(whiteNoise(n, rng), 'bp', 7200 * bright, 0.9), 'hp', 4200);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = t < 0.007 ? (t / 0.007) ** 2 : Math.exp(-(t - 0.007) / 0.032);
    y[i] *= a;
  }
  return normMono(tailFade(y, 0.01));
}

// Soft tom for fills: sine with a pitch drop + a whisper of noise.
function tom(freq, { seed = 61 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.4);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 + 0.5 * Math.exp(-t / 0.02));
    ph += (TAU * f) / SR;
    y[i] = Math.min(1, t / 0.001) * (Math.sin(ph) * Math.exp(-t / 0.16) + 0.15 * rng.bi() * Math.exp(-t / 0.01));
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], 1.3);
  return normMono(tailFade(filt(y, 'lp', 5000), 0.03));
}

// Soft cymbal (stereo, decorrelated noise per side + shared metallic partials).
function crash({ decay = 1.2, len = 3, bright = 1, seed = 51 } = {}) {
  const n = samples(len);
  const out = stereoN(n);
  const rngM = makeRng(seed);
  const oscs = HAT_FREQS.map(() => new Osc(rngM.next()));
  const metal = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let k = 0; k < 6; k++) m += oscs[k].pulse(HAT_FREQS[k] * 3.1);
    metal[i] = m / 6;
  }
  ['L', 'R'].forEach((c, ci) => {
    const nz = whiteNoise(n, makeRng(seed * 7 + ci));
    const src = new Float64Array(n);
    for (let i = 0; i < n; i++) src[i] = nz[i] * 0.8 + metal[i] * 0.3;
    const y = filt(filt(filt(src, 'hp', 3000 * bright, 0.7), 'hp', 2400 * bright, 0.7), 'lp', 10000);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      y[i] *= Math.min(1, t / 0.003) * (0.5 * Math.exp(-t / 0.06) + Math.exp(-t / decay));
    }
    out[c] = tailFade(y, 0.05);
  });
  return normalizePeak(out, 0);
}

// Reverse-cymbal swell of `dur` seconds that peaks at its very end.
function reverseCymbal(dur, seed = 57) {
  const c = crash({ decay: dur * 0.45, len: dur, seed });
  const out = stereoN(c.L.length);
  for (let i = 0; i < c.L.length; i++) {
    out.L[i] = c.L[c.L.length - 1 - i];
    out.R[i] = c.R[c.R.length - 1 - i];
  }
  out.L = tailFade(out.L, 0.003);
  out.R = tailFade(out.R, 0.003);
  return out;
}

// Riser: band-passed noise sweeping up (decorrelated L/R) + a soft rising sine,
// swelling to its peak exactly at the end.
function riser({ dur = 2, fStart = 300, fEnd = 8000, toneFrom = 220, toneTo = 880, toneAmt = 0.25, noiseAmt = 1, curve = 2.2, seed = 71 } = {}) {
  const n = samples(dur);
  const fcAt = (t) => expInterp(fStart, fEnd, Math.pow(t / dur, 1.2));
  const qAt = (t) => 1 + 2.5 * (t / dur);
  const tone = new Float64Array(n);
  const o1 = new Osc(0);
  const o2 = new Osc(0.3);
  for (let i = 0; i < n; i++) {
    const f = expInterp(toneFrom, toneTo, Math.pow(i / n, 1.6));
    tone[i] = 0.7 * o1.sine(f) + 0.3 * o2.sine(2 * f);
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const nz = filt(whiteNoise(n, makeRng(seed * 17 + ci)), 'bp', fcAt, qAt);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const a = 0.015 + 0.985 * (0.7 * Math.pow(p, curve) + 0.3 * Math.pow(p, 10));
      y[i] = (nz[i] * noiseAmt + tone[i] * toneAmt * (ci ? 0.95 : 1)) * a;
    }
    out[c] = tailFade(y, 0.0015);
  });
  return normalizePeak(out, 0);
}

// Soft cinematic low boom + air (stereo, peak 1).
function softBoom({ f0 = 62, f1 = 34, glideTau = 0.28, decay = 0.45, len = 1.4, noiseAmt = 0.35, noiseDecay = 0.08, air = 0.14, drive = 1.15, seed = 81 } = {}) {
  const n = samples(len);
  const body = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / glideTau);
    ph += (TAU * f) / SR;
    body[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.003) * Math.exp(-t / decay);
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const r = makeRng(seed * 13 + ci);
    const nzLo = filt(whiteNoise(n, r), 'lp', (t) => 140 + 1600 * Math.exp(-t / 0.05), 0.7);
    const nzHi = filt(filt(whiteNoise(n, r), 'hp', 2500), 'lp', 9000);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const lo = nzLo[i] * noiseAmt * Math.min(1, t / 0.002) * Math.exp(-t / noiseDecay);
      const hi = nzHi[i] * air * Math.min(1, t / 0.006) * Math.exp(-t / 0.22);
      y[i] = sat(body[i] + lo, drive) + hi;
    }
    out[c] = tailFade(y, 0.05);
  });
  return normalizePeak(out, 0);
}

// ----------------------------------------------------------------------------
// Tonal voices
// ----------------------------------------------------------------------------

// Warm pad voice: 2 detuned PolyBLEP saws per side + soft sine, slow envelope.
// Returns stereo; the bus gets a time-varying low-pass afterwards.
function padVoice(freq, dur, { attack = 0.35, release = 0.9, seed = 301 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + release);
  const out = stereoN(n);
  const det = [
    [-9, 4],
    [-4, 8],
  ];
  const oscs = det.map((pair) => pair.map(() => new Osc(rng.next())));
  const sub = new Osc(rng.next());
  const vibPh = rng.next() * TAU;
  const vibRate = rng.range(0.15, 0.3);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = t < attack ? Math.sin((Math.PI / 2) * (t / attack)) ** 2 : 1;
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    const vib = 1 + 0.0012 * Math.sin(TAU * vibRate * t + vibPh);
    const s = 0.25 * sub.sine(freq * vib);
    let l = 0;
    let r = 0;
    for (let k = 0; k < 2; k++) {
      l += oscs[0][k].saw(freq * vib * Math.pow(2, det[0][k] / 1200));
      r += oscs[1][k].saw(freq * vib * Math.pow(2, det[1][k] / 1200));
    }
    out.L[i] = (0.5 * l + s) * env;
    out.R[i] = (0.5 * r + s) * env;
  }
  return out;
}

// Soft analog-ish pluck: two saws + sine through an enveloped low-pass.
function pluck(freq, vel = 1, { len = 0.55, decay = 0.17, bright = 1, seed = 201 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const src = new Float64Array(n);
  const o1 = new Osc(rng.next());
  const o2 = new Osc(rng.next());
  const o3 = new Osc(rng.next());
  for (let i = 0; i < n; i++) src[i] = 0.45 * o1.saw(freq) + 0.35 * o2.saw(freq * 1.0045) + 0.35 * o3.sine(freq);
  const y = filt(src, 'lp', (t) => 450 + 3800 * bright * (0.5 + 0.5 * vel) * Math.exp(-t / 0.055), 0.9);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.002) * (0.75 * Math.exp(-t / decay) + 0.25 * Math.exp(-t / (decay * 3))) * vel;
  }
  return tailFade(y, 0.04);
}

// Glassy bell: FM (ratio 4, decaying index) + inharmonic 2.756x glass partial.
function bell(freq, vel = 1, { len = 1.6, decay = 0.7, seed = 401 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const y = new Float64Array(n);
  let pc = rng.next() * TAU;
  let pm = rng.next() * TAU;
  let pg = rng.next() * TAU;
  const kt = Math.sqrt(880 / freq);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    pc += (TAU * freq) / SR;
    pm += (TAU * freq * 4) / SR;
    pg += (TAU * freq * 2.756) / SR;
    const idx = 0.15 + 1.1 * vel * Math.exp(-t / 0.12);
    const env = Math.min(1, t / 0.0012) * Math.exp(-t / (decay * kt));
    y[i] = (Math.sin(pc + idx * Math.sin(pm)) * env + 0.22 * Math.sin(pg) * Math.min(1, t / 0.0012) * Math.exp(-t / (0.18 * kt))) * vel;
  }
  return tailFade(y, 0.05);
}

// Warm chord-stab note: detuned saws through a decaying low-pass, short sustain.
function stabNote(freq, dur, vel = 1, { seed = 501 } = {}) {
  const rng = makeRng(seed);
  const rel = 0.14;
  const n = samples(dur + rel + 0.02);
  const src = new Float64Array(n);
  const o1 = new Osc(rng.next());
  const o2 = new Osc(rng.next());
  const o3 = new Osc(rng.next());
  for (let i = 0; i < n; i++) src[i] = 0.4 * o1.saw(freq * 0.9965) + 0.4 * o2.saw(freq * 1.0035) + 0.3 * o3.pulse(freq * 0.5, 0.5) * 0.5;
  const y = filt(src, 'lp', (t) => 600 + 2600 * (0.6 + 0.4 * vel) * Math.exp(-t / 0.09), 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = Math.min(1, t / 0.004) * (0.45 + 0.55 * Math.exp(-t / 0.12));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel) ** 2;
    y[i] *= env * vel;
  }
  return tailFade(y, 0.01);
}

// Sub bass: sine + low harmonics + a touch of low-passed saw for definition.
function bassNote(midi, dur, vel = 1, { release = 0.06, drive = 1.35 } = {}) {
  const n = samples(dur + release);
  const f = mtof(midi);
  const saw = new Float64Array(n);
  const os = new Osc(0.25);
  for (let i = 0; i < n; i++) saw[i] = os.saw(f);
  const sawF = filt(saw, 'lp', 380, 0.7);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * f * (1 + 0.08 * Math.exp(-t / 0.01))) / SR;
    let env = Math.min(1, t / 0.006) * (0.78 + 0.22 * Math.exp(-t / 0.25));
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    y[i] = sat((Math.sin(ph) + 0.16 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph) + 0.22 * sawF[i]) * env * vel, drive);
  }
  return y;
}

// ----------------------------------------------------------------------------
// Song map: 100 BPM, 4/4, D major, 24 bars = 57.600 s
// ----------------------------------------------------------------------------
const BPM = 100;
const BEAT = 60 / BPM; // 0.6 s
const BAR = 4 * BEAT; // 2.4 s = 72 frames @ 30 fps
const STEP = BEAT / 4; // 16th = 0.15 s
const BARS = 24;
const SONG_SEC = BARS * BAR; // 57.6 s
const at = (bar, step) => bar * BAR + step * STEP;
const T = { BUILD: at(2, 0), DROP: at(5, 0), BRIGHT: at(7, 0), MAIN: at(12, 0), BREAK: at(20, 0), END: at(22, 0) };
const FADE = [55.0, 57.3]; // raised-cosine fade, digital silence from 57.3 s
const GAP = 0.03; // swells stop just before their downbeat (a breath)

const SECTIONS = [
  ['intro', 0, 2],
  ['build', 2, 5],
  ['drop', 5, 7],
  ['bright', 7, 12],
  ['main', 12, 20],
  ['breakdown', 20, 22],
  ['resolve', 22, 24],
];
const sectionOf = (bar) => SECTIONS.find(([, a, b]) => bar >= a && bar < b)[0];

// Voicings. pad: warm 5-note voicing; stab: upper 4 notes; arp: pluck tones; bells = arp + 12.
const CHORDS = {
  D: { name: 'Dmaj9', root: 38, pad: [50, 57, 61, 64, 66], stab: [62, 66, 69, 73], arp: [69, 74, 76, 78, 81] },
  Bm: { name: 'Bm9', root: 35, pad: [47, 54, 57, 61, 62], stab: [59, 62, 66, 69], arp: [66, 71, 73, 74, 78] },
  G: { name: 'Gmaj9', root: 31, pad: [43, 54, 57, 59, 62], stab: [59, 62, 66, 67], arp: [67, 71, 74, 78, 79] },
  A: { name: 'A(add9)', root: 33, pad: [45, 52, 57, 59, 61], stab: [61, 64, 69, 71], arp: [69, 71, 73, 76, 81] },
};
// One chord per bar (I - vi - IV - V family).
const SEQ = ['D', 'G', 'D', 'Bm', 'A', 'D', 'Bm', 'G', 'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A', 'G', 'A', 'D', 'D'];

// Bass events: [step, semitones above root, length in steps, velocity]
const BASS = {
  build3: [
    [0, 0, 7, 0.9],
    [8, 0, 5, 0.85],
    [14, 7, 2, 0.7],
  ],
  build4: [
    [0, 0, 5.5, 0.9],
    [6, 0, 2, 0.75],
  ],
  groove: [
    [0, 0, 5, 1],
    [6, 0, 1.8, 0.8],
    [8, 0, 2.8, 0.9],
    [11, 12, 0.9, 0.65],
    [12, 0, 1.8, 0.85],
    [14, 7, 1.9, 0.75],
  ],
  half: [
    [0, 0, 9, 0.85],
    [10, 0, 3.8, 0.75],
    [14, 7, 1.9, 0.65],
  ],
};
const KICK_GROOVE = [
  [0, 8, 11],
  [0, 6, 8, 14],
];
// Chord stabs: [step, length in steps, velocity]
const STABS = [
  [
    [0, 3, 0.9],
    [6, 2, 0.65],
    [10, 3, 0.8],
  ],
  [
    [0, 3, 0.9],
    [7, 2, 0.6],
    [10, 2, 0.75],
    [14, 1.5, 0.55],
  ],
];
const ARP_SEQ = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1];
const ARP_ACCENTS = new Set([0, 3, 6, 10, 12]);
const BRIGHT_BELLS = [
  [0, 2, 3, 4, 2, 3, 4, 1],
  [1, 3, 4, 2, 3, 4, 2, 0],
];
// Main-groove bell counter-motif: [step, tone index, velocity]
const BELL_MOTIF = [
  [0, 4, 0.7],
  [3, 3, 0.5],
  [6, 2, 0.55],
  [8, 3, 0.6],
  [12, 1, 0.45],
];
// Intro glass bells: [bar, step, midi, velocity]
const INTRO_BELLS = [
  [0, 0, 86, 0.7],
  [0, 6, 81, 0.45],
  [0, 10, 88, 0.55],
  [0, 14, 90, 0.42],
  [1, 0, 83, 0.6],
  [1, 4, 86, 0.45],
  [1, 8, 90, 0.55],
  [1, 11, 91, 0.4],
  [1, 14, 93, 0.5],
];

// ----------------------------------------------------------------------------
// Music render: returns the dry stems + a drum reverb send
// ----------------------------------------------------------------------------
function renderMusic() {
  const N = samples(SONG_SEC);
  const bus = {
    drums: stereoN(N),
    bass: stereoN(N),
    pad: stereoN(N),
    stabs: stereoN(N),
    pluck: stereoN(N),
    bells: stereoN(N),
    fx: stereoN(N),
    drumVerb: stereoN(N),
  };
  const rng = makeRng(2026);
  const kickTimes = [];

  const K = kickSoft({ seed: 11 });
  const RIM = [rim({ seed: 21 }), rim({ seed: 22, tone: 1.03 })];
  const CLAP = clap({ seed: 31 });
  const HATS = [0, 1, 2, 3, 4, 5].map((k) => hat({ seed: 41 + k, tone: 0.97 + 0.012 * k, decay: 0.022 + 0.004 * (k % 3) }));
  const HAT_OPEN = hat({ open: true, seed: 48 });
  const SHAKE = [0, 1, 2, 3].map((k) => shaker({ seed: 70 + k, bright: 0.95 + 0.04 * k }));
  const TOMS = [tom(196, { seed: 61 }), tom(165, { seed: 62 }), tom(131, { seed: 63 })];

  const jitter = () => rng.range(-0.003, 0.003);
  const addKick = (t, v = 1) => {
    addMono(bus.drums, K, t, 0.95 * v);
    kickTimes.push([t, v]);
  };
  const addBack = (t, v = 1) => {
    addMono(bus.drums, CLAP, t + 0.003, 0.55 * v, 0.05);
    addMono(bus.drums, RIM[rng.int(0, 1)], t, 0.42 * v, -0.05);
    addMono(bus.drumVerb, CLAP, t, 0.5 * v);
    addMono(bus.drumVerb, RIM[0], t, 0.25 * v);
  };
  const addRim = (t, v = 1, pan = -0.15) => {
    addMono(bus.drums, RIM[rng.int(0, 1)], t, 0.4 * v, pan);
    addMono(bus.drumVerb, RIM[0], t, 0.2 * v);
  };
  const addHat = (t, v, pan = 0.25) => addMono(bus.drums, HATS[rng.int(0, 5)], t + jitter(), 0.22 * v, pan);
  const addShaker = (t, v, pan = -0.35) => addMono(bus.drums, SHAKE[rng.int(0, 3)], t + jitter() + 0.004, 0.16 * v, pan);
  const addOpenHat = (t, chokeAfter, v = 1) => {
    const x = Float64Array.from(HAT_OPEN);
    const c = samples(chokeAfter);
    const fl = samples(0.015);
    for (let i = c; i < x.length; i++) x[i] *= Math.max(0, 1 - (i - c) / fl);
    addMono(bus.drums, x, t, 0.13 * v, 0.3);
  };
  const addTom = (t, k, v = 1) => {
    addMono(bus.drums, TOMS[k], t, 0.55 * v, [0.3, 0, -0.3][k]);
    addMono(bus.drumVerb, TOMS[k], t, 0.25 * v);
  };

  const playBass = (bar, line, gain = 0.55) => {
    const ch = CHORDS[SEQ[bar]];
    for (const [s, semi, len, v] of line) addMono(bus.bass, bassNote(ch.root + semi, len * STEP - 0.02, v), at(bar, s), gain);
  };
  const playStab = (bar, s, len, v, chord = CHORDS[SEQ[bar]]) => {
    chord.stab.forEach((m, k) => {
      const x = stabNote(mtof(m), len * STEP, v * (1 + rng.range(-0.05, 0.05)), { seed: rng.int(1, 1e9) });
      addMono(bus.stabs, x, at(bar, s) + k * 0.004, 0.25, (k / 3 - 0.5) * 0.6);
    });
  };
  const playPluck = (bar, s, m, v, opts = {}) =>
    addMono(bus.pluck, pluck(mtof(m), v, { seed: rng.int(1, 1e9), ...opts }), at(bar, s), 0.3, s % 2 ? 0.25 : -0.25);
  const playBell = (bar, s, m, v, pan = null, opts = {}) =>
    addMono(bus.bells, bell(mtof(m), v, { seed: rng.int(1, 1e9), ...opts }), at(bar, s), 0.22, pan ?? rng.range(-0.5, 0.5));

  // ---------------------------------------------------------------- pad (whole song)
  for (let b = 0; b < 21; b++) {
    const ch = CHORDS[SEQ[b]];
    const last = b === 20;
    const dur = last ? 2 * BAR : BAR;
    ch.pad.forEach((m, k) => {
      const x = padVoice(mtof(m), dur, { attack: b === 0 ? 1.6 : 0.3, release: last ? 1.5 : 0.8, seed: 3000 + b * 10 + k });
      addStereo(bus.pad, x, at(b, 0), k === 0 ? 0.13 : 0.1);
    });
  }

  // ---------------------------------------------------------------- per-bar arrangement
  for (let bar = 0; bar < BARS; bar++) {
    const sec = sectionOf(bar);
    const ch = CHORDS[SEQ[bar]];
    const bellTones = ch.arp.map((m) => m + 12);

    if (sec === 'intro') {
      for (const [b, s, m, v] of INTRO_BELLS) if (b === bar) playBell(bar, s, m, v, null, { decay: 0.9, len: 2.2 });
      if (bar === 1) [2, 6, 10, 13].forEach((s, k) => playPluck(bar, s, ch.arp[[1, 2, 3, 4][k]], 0.45, { bright: 0.6 }));
    }

    if (sec === 'build') {
      const kv = [0.5, 0.6, 0.72][bar - 2];
      const kSteps = bar === 4 ? [0, 4, 8] : [0, 4, 8, 12];
      kSteps.forEach((s) => addKick(at(bar, s), kv));
      if (bar === 2) [2, 6, 10, 14].forEach((s) => addHat(at(bar, s), 0.55));
      if (bar === 3) for (let s = 0; s < 16; s += 2) addHat(at(bar, s), s % 4 ? 0.7 : 0.45);
      if (bar === 4) for (let s = 0; s < 8; s++) addHat(at(bar, s), s % 4 === 2 ? 0.75 : s % 2 ? 0.4 : 0.55);
      if (bar >= 3) for (let s = 0; s < (bar === 4 ? 8 : 16); s++) addShaker(at(bar, s), s % 2 ? 0.45 : 0.75);
      if (bar === 3) [4, 12].forEach((s) => addRim(at(bar, s), 0.6));
      if (bar === 4) addRim(at(bar, 4), 0.7);
      if (bar === 3) playBass(bar, BASS.build3);
      if (bar === 4) playBass(bar, BASS.build4);
      // plucks: 8ths in bars 2-3, 16ths in bar 4
      const stepSize = bar === 4 ? 1 : 2;
      for (let s = 0; s < 16; s += stepSize) playPluck(bar, s, ch.arp[ARP_SEQ[s]], ARP_ACCENTS.has(s) ? 0.8 : 0.55);
      if (bar === 2) playBell(bar, 0, bellTones[1], 0.5);
    }

    if (sec === 'drop' || sec === 'main') {
      const gi = bar % 2;
      const fill = bar === 15 || bar === 19;
      const fillFrom = 12;
      KICK_GROOVE[gi].forEach((s) => {
        if (!(fill && s >= fillFrom)) addKick(at(bar, s), s === 0 ? 1 : 0.85);
      });
      [4, 12].forEach((s) => addBack(at(bar, s), sec === 'main' ? 1 : 0.9));
      if (bar % 4 === 1) addRim(at(bar, 11), 0.35, 0.2);
      for (let s = 0; s < 16; s++) {
        if (fill && s >= fillFrom) break;
        if (s === 14 && gi === 1 && sec === 'main') {
          addOpenHat(at(bar, 14), 2 * STEP);
          continue;
        }
        addHat(at(bar, s), (s % 4 === 2 ? 0.85 : s % 2 === 0 ? 0.6 : 0.38) + rng.range(-0.06, 0.06));
        if (sec === 'main' || s % 2 === 0) addShaker(at(bar, s), s % 2 ? 0.5 : 0.8); // drop: 8th shaker only
      }
      if (fill) {
        // small tom + rim fill over the last beat (bar 19: a little bigger)
        const seq =
          bar === 15
            ? [
                [12, 'tom', 0, 0.8],
                [13, 'tom', 0, 0.6],
                [14, 'tom', 1, 0.8],
                [15, 'tom', 2, 0.9],
              ]
            : [
                [12, 'tom', 0, 0.85],
                [13, 'rim', 0, 0.5],
                [13.5, 'rim', 0, 0.55],
                [14, 'tom', 1, 0.9],
                [14.5, 'rim', 0, 0.6],
                [15, 'tom', 2, 1.0],
                [15.5, 'rim', 0, 0.7],
              ];
        for (const [s, kind, k, v] of seq) {
          if (kind === 'tom') addTom(at(bar, s), k, v);
          else addRim(at(bar, s), v, 0.2);
        }
        addKick(at(bar, 12), 0.8);
      }
      playBass(bar, BASS.groove, sec === 'main' ? 0.58 : 0.55);
      STABS[gi].forEach(([s, len, v]) => playStab(bar, s, len, v));
      for (let s = 0; s < 16; s++) playPluck(bar, s, ch.arp[ARP_SEQ[s]], ARP_ACCENTS.has(s) ? 0.9 : 0.55);
      if (sec === 'drop') playBell(bar, 0, bellTones[4], 0.55);
      if (sec === 'main' && bar % 2 === 0) for (const [s, k, v] of BELL_MOTIF) playBell(bar, s, bellTones[k], v);
    }

    if (sec === 'bright') {
      // half-time & light: kick on 1 (not on bar 7) and the "and" of 3, backbeat on beat 3
      if (bar !== 7) addKick(at(bar, 0), 0.8);
      addKick(at(bar, 10), 0.65);
      addBack(at(bar, 8), 0.7);
      for (let s = 0; s < 16; s++) {
        if (s % 2 === 0) addHat(at(bar, s), s % 4 === 2 ? 0.6 : 0.4);
        addShaker(at(bar, s), s % 2 ? 0.5 : 0.75);
      }
      if (bar === 11) {
        addRim(at(bar, 14), 0.45, 0.2);
        addRim(at(bar, 15), 0.6, 0.2);
      }
      playBass(bar, BASS.half, 0.5);
      BRIGHT_BELLS[bar % 2].forEach((k, j) => playBell(bar, j * 2, bellTones[k], j === 0 ? 0.75 : 0.5 + 0.15 * ((j + bar) % 2)));
      [0, 6, 12].forEach((s, j) => playPluck(bar, s, ch.arp[[0, 3, 2][j]], 0.6));
      [3, 9].forEach((s) => playPluck(bar, s, ch.arp[4], 0.35));
    }

    if (sec === 'breakdown') {
      for (let s = 0; s < 16; s += 2) addHat(at(bar, s), s % 4 === 2 ? 0.45 : 0.3);
      for (let s = 0; s < 16; s += 2) playPluck(bar, s, ch.arp[ARP_SEQ[s]], ARP_ACCENTS.has(s) ? 0.7 : 0.45);
      playBell(bar, 0, bellTones[2], 0.5);
      if (bar === 21) playBell(bar, 8, bellTones[4], 0.4);
    }

    if (sec === 'resolve' && bar === 22) {
      // final soft hit on the downbeat, then the tonic rings out
      addKick(at(22, 0), 0.9);
      addMono(bus.bass, bassNote(ch.root, 2.6, 1, { release: 0.8 }), at(22, 0), 0.55);
      playStab(22, 0, 6, 0.85);
      [
        [0, 74, 0.8],
        [2, 78, 0.6],
        [4, 81, 0.6],
        [6, 85, 0.55],
        [8, 86, 0.5],
        [11, 88, 0.4],
        [14, 81, 0.35],
      ].forEach(([s, m, v]) => playPluck(22, s, m, v, { decay: 0.3, len: 1.0 }));
      [
        [0, 86, 0.7],
        [3, 90, 0.5],
        [6, 93, 0.5],
        [10, 97, 0.4],
      ].forEach(([s, m, v]) => playBell(22, s, m, v, null, { decay: 1.0, len: 2.5 }));
      playBell(23, 0, 98, 0.32, 0.3, { decay: 1.0, len: 2.5 });
      playBell(23, 6, 93, 0.22, -0.3, { decay: 0.9, len: 2.2 });
    }
  }

  // ---------------------------------------------------------------- FX: risers, swells, cymbals
  // intro -> build: gentle airy riser
  addStereo(bus.fx, riser({ dur: 2.2, fStart: 400, fEnd: 6000, toneFrom: 440, toneTo: 1320, toneAmt: 0.15, seed: 71 }), T.BUILD - GAP - 2.2, 0.1);
  // bar 4: swell over the last 2 beats + a rim/clap roll (snare-roll-ish)
  addStereo(bus.fx, riser({ dur: 1.2 - GAP, fStart: 600, fEnd: 9000, toneFrom: 330, toneTo: 1320, toneAmt: 0.2, seed: 72 }), at(4, 8), 0.26);
  addStereo(bus.fx, reverseCymbal(1.2 - GAP, 58), at(4, 8), 0.22);
  {
    let t = at(4, 8);
    let k = 0;
    while (t < T.DROP - GAP - 0.02) {
      const p = (t - at(4, 8)) / (T.DROP - at(4, 8));
      const v = 0.25 + 0.75 * p * p;
      addMono(bus.drums, RIM[k % 2], t, 0.45 * v, k % 2 ? 0.2 : -0.2);
      if (k % 2 === 0) addMono(bus.drums, CLAP, t, 0.32 * v);
      addMono(bus.drumVerb, CLAP, t, 0.25 * v);
      t += t < at(4, 12) ? STEP : STEP / 2;
      k++;
    }
  }
  // drop (bar 5): soft crash + soft boom
  addStereo(bus.fx, crash({ seed: 51, decay: 1.3 }), T.DROP, 0.17);
  addStereo(bus.fx, softBoom({ seed: 81 }), T.DROP, 0.35);
  // into the bright section (bar 7): short airy reverse cymbal
  addStereo(bus.fx, reverseCymbal(1.0, 59), T.BRIGHT - GAP - 1.0, 0.14);
  addStereo(bus.fx, crash({ seed: 52, decay: 1.6, bright: 1.15 }), T.BRIGHT, 0.08);
  // into the main groove (bar 12)
  addStereo(bus.fx, reverseCymbal(1.6, 60), T.MAIN - GAP - 1.6, 0.2);
  addStereo(bus.fx, riser({ dur: 1.6, fStart: 500, fEnd: 8000, toneAmt: 0.12, seed: 73 }), T.MAIN - GAP - 1.6, 0.1);
  addStereo(bus.fx, crash({ seed: 53, decay: 1.4 }), T.MAIN, 0.18);
  addStereo(bus.fx, softBoom({ seed: 82, decay: 0.5 }), T.MAIN, 0.38);
  // into the breakdown (bar 20): soft cymbal wash only
  addStereo(bus.fx, crash({ seed: 54, decay: 1.8, bright: 0.9 }), T.BREAK, 0.12);
  // breakdown -> resolve: swell over bar 21
  addStereo(bus.fx, riser({ dur: BAR - GAP, fStart: 300, fEnd: 7000, toneFrom: 293.7, toneTo: 1174.7, toneAmt: 0.18, seed: 74 }), at(21, 0), 0.14);
  addStereo(bus.fx, reverseCymbal(2.0, 61), T.END - GAP - 2.0, 0.22);
  // resolve: final soft hit
  addStereo(bus.fx, crash({ seed: 55, decay: 1.6, len: 4 }), T.END, 0.16);
  addStereo(bus.fx, softBoom({ seed: 83, decay: 0.6, len: 2 }), T.END, 0.32);

  // ---------------------------------------------------------------- bus processing
  // Soft sidechain-style ducking from every kick
  const duck = new Float64Array(N);
  for (const [tk, v] of kickTimes) {
    const s0 = Math.round(tk * SR);
    const m = Math.min(N - s0, samples(0.4));
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      duck[s0 + i] = Math.max(duck[s0 + i], v * Math.min(1, t / 0.004) * Math.exp(-t / 0.11));
    }
  }
  const duckBy = (buf, amt) => {
    for (let i = 0; i < N; i++) {
      const g = 1 - amt * Math.min(1, duck[i]);
      buf.L[i] *= g;
      buf.R[i] *= g;
    }
  };
  duckBy(bus.bass, 0.4);
  duckBy(bus.pad, 0.28);
  duckBy(bus.stabs, 0.15);
  duckBy(bus.pluck, 0.12);

  filtStereo(bus.bass, 'hp', 28, 0.7);
  filtStereo(bus.bass, 'lp', 900, 0.7);

  // Pad: level + low-pass automation (intro swell, build opens, bright = brightest)
  const padLevelFn = (t) => {
    if (t < T.BUILD) return 0.15 + 0.85 * smoothstep(t / 3.4);
    if (t < T.DROP) return 0.9;
    if (t < T.BRIGHT) return 0.65;
    if (t < T.MAIN) return 0.9;
    if (t < T.BREAK) return 0.6;
    return 1;
  };
  const padFcFn = (t) => {
    if (t < T.BUILD) return expInterp(380, 1000, t / T.BUILD);
    if (t < T.DROP) return expInterp(1000, 2600, (t - T.BUILD) / (T.DROP - T.BUILD));
    if (t < T.BRIGHT) return 2800;
    if (t < T.MAIN) return 4200;
    if (t < T.BREAK) return 3000;
    if (t < T.END) return expInterp(1800, 3400, (t - T.BREAK) / (T.END - T.BREAK));
    return expInterp(3400, 1100, (t - T.END) / 4.5);
  };
  let pad = chorus(bus.pad, { mix: 0.35 });
  pad = filtStereo(pad, 'lp', fromArray(automation(N, padFcFn, 0.12, true)), 0.8);
  filtStereo(pad, 'hp', 110, 0.7);
  applyGain(pad, automation(N, padLevelFn, 0.2));

  // Stabs: light chorus
  const stabs = chorus(bus.stabs, { mix: 0.3, rate: 0.5 });
  filtStereo(stabs, 'hp', 160, 0.7);

  // Plucks: low-pass automation, dotted-8th ping-pong
  const pluckFcFn = (t) => {
    if (t < T.BUILD) return 1500;
    if (t < T.DROP) return expInterp(1500, 8000, (t - T.BUILD) / (T.DROP - T.BUILD));
    if (t < T.BREAK) return 9000;
    if (t < T.END) return 3200;
    return 5500;
  };
  filtStereo(bus.pluck, 'lp', fromArray(automation(N, pluckFcFn, 0.1, true)), 0.7);
  filtStereo(bus.pluck, 'hp', 150, 0.7);
  const pluckEcho = pingPong(bus.pluck, { time: 3 * STEP, feedback: 0.35, lp: 4500, hp: 400 });
  const plucks = stereoN(N);
  addStereo(plucks, bus.pluck, 0, 1);
  addStereo(plucks, pluckEcho, 0, 0.4);

  // Bells: 8th ping-pong, airy
  filtStereo(bus.bells, 'hp', 300, 0.7);
  const bellEcho = pingPong(bus.bells, { time: 2 * STEP, feedback: 0.3, lp: 7000, hp: 600 });
  const bells = stereoN(N);
  addStereo(bells, bus.bells, 0, 1);
  addStereo(bells, bellEcho, 0, 0.35);

  return { drums: bus.drums, bass: bus.bass, pad, stabs, pluck: plucks, bells, fx: bus.fx, drumVerb: bus.drumVerb };
}

// ----------------------------------------------------------------------------
// Mix + master
// ----------------------------------------------------------------------------
// Stem balance: each stem is scaled so its K-weighted RMS over the main groove
// (bars 12-17) hits these targets (dB). fx follows the drums' gain.
const STEM_TARGETS = { drums: -15, bass: -18, pad: -21.5, stabs: -22.5, pluck: -21, bells: -24.5, verb: -23 };
const MAIN_RANGE = [[T.MAIN, T.BREAK]];
const TARGET_RMS_DB = -15.5; // main-groove RMS (dBFS) after the master chain (not EDM-loud)
const CEILING_DB = -1.0;

function mixAndMaster(stems) {
  const N = stems.drums.L.length;
  const gains = {};
  for (const k of ['drums', 'bass', 'pad', 'stabs', 'pluck', 'bells']) {
    const r = gainToDb(rmsOf(kWeight(stems[k]), MAIN_RANGE));
    gains[k] = dbToGain(STEM_TARGETS[k] - r);
    scaleBuf(stems[k], gains[k]);
  }
  scaleBuf(stems.fx, gains.drums);
  scaleBuf(stems.drumVerb, gains.drums);

  // Reverb glue: one shared room fed by every melodic stem, the claps/rims and fx.
  const send = stereoN(N);
  addStereo(send, stems.pad, 0, 0.2);
  addStereo(send, stems.stabs, 0, 0.25);
  addStereo(send, stems.pluck, 0, 0.3);
  addStereo(send, stems.bells, 0, 0.5);
  addStereo(send, stems.drumVerb, 0, 0.35);
  addStereo(send, stems.fx, 0, 0.15);
  let verb = freeverb(send, { room: 0.86, damp: 0.35 });
  filtStereo(verb, 'hp', 300, 0.7);
  filtStereo(verb, 'lp', 7500, 0.7);
  const rv = gainToDb(rmsOf(kWeight(verb), MAIN_RANGE));
  scaleBuf(verb, dbToGain(STEM_TARGETS.verb - rv));
  stems.verb = verb;

  const order = ['drums', 'bass', 'pad', 'stabs', 'pluck', 'bells', 'fx', 'verb'];
  const mix = stereoN(N);
  for (const k of order) addStereo(mix, stems[k], 0, 1);

  // Warm master: 25 Hz HP, gentle low-mid warmth, a touch of air, then
  // soft clip -> transparent limiter -> end fade -> peak normalise.
  filtStereo(mix, 'hp', 25, 0.7);
  mix.L = lowShelf(mix.L, 180, 1.0);
  mix.R = lowShelf(mix.R, 180, 1.0);
  mix.L = highShelf(mix.L, 9000, 1.0);
  mix.R = highShelf(mix.R, 9000, 1.0);

  let pre = 1;
  let result = null;
  for (let iter = 0; iter < 8; iter++) {
    const out = stereoN(N);
    for (let i = 0; i < N; i++) {
      out.L[i] = softClip(mix.L[i] * pre, 0.65);
      out.R[i] = softClip(mix.R[i] * pre, 0.65);
    }
    const { maxReductionDb } = limiter(out, { ceilingDb: CEILING_DB - 0.05 });
    fadeOutRange(out, FADE[0], FADE[1]);
    const rmsDb = gainToDb(rmsOf(out, MAIN_RANGE));
    result = { out, preDb: gainToDb(pre), maxReductionDb, rmsDb };
    if (Math.abs(rmsDb - TARGET_RMS_DB) < 0.05) break;
    pre *= dbToGain(TARGET_RMS_DB - rmsDb);
  }
  normalizePeak(result.out, CEILING_DB - 0.02); // ~ -1 dBFS true sample peak
  result.rmsDb = gainToDb(rmsOf(result.out, MAIN_RANGE));

  const mixK = rmsOf(kWeight(mix), MAIN_RANGE);
  result.stemReport = order.map((k) => `${k} ${(gainToDb(rmsOf(kWeight(stems[k]), MAIN_RANGE) / mixK)).toFixed(1)}`).join(', ');
  return result;
}

// ----------------------------------------------------------------------------
// One-shot SFX (each returns a stereo buffer; sound starts at sample 0)
// ----------------------------------------------------------------------------

// Airy band-passed noise swoosh with an equal-power pan sweep and a little room.
function sfxWhoosh({ dur = 0.7, fLo = 450, fPeak = 3200, fEnd = 900, peakAt = 0.4, q = 1.2, panFrom = -0.85, panTo = 0.85, floor = 0.12, verb = 0.18, seed = 601 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur);
  const pink = pinkNoise(n, rng);
  const white = whiteNoise(n, rng);
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) src[i] = pink[i] * 0.7 + white[i] * 0.3;
  const tp = peakAt * dur;
  const fcAt = (t) => (t < tp ? expInterp(fLo, fPeak, smoothstep(t / tp)) : expInterp(fPeak, fEnd, smoothstep((t - tp) / (dur - tp))));
  const body = filt(src, 'bp', fcAt, q);
  const air = filt(src, 'bp', (t) => Math.min(15000, fcAt(t) * 2.2), q * 1.4);
  const dry = stereoN(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const rise = floor + (1 - floor) * Math.sin((Math.PI / 2) * clamp(t / tp, 0, 1)) ** 1.5;
    const env = Math.min(1, t / 0.004) * (t < tp ? rise : Math.cos((Math.PI / 2) * ((t - tp) / (dur - tp))) ** 1.6);
    const [gl, gr] = panGains(lerp(panFrom, panTo, smoothstep(t / dur)));
    const v = (body[i] + 0.4 * air[i]) * env;
    dry.L[i] = v * gl;
    dry.R[i] = v * gr;
  }
  const wet = freeverb(dry, { room: 0.7, damp: 0.4 });
  const out = stereoN(n);
  addStereo(out, dry, 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 500), 0, verb);
  return fadeOutRange(out, dur - 0.08, dur);
}

// Soft bubbly UI pop: quick upward sine chirp, a second smaller bubble, small room.
function sfxPop({ seed = 603 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.25);
  const y = new Float64Array(n);
  const bubble = (t0, fA, fB, tau, amp) => {
    let ph = 0;
    const s0 = Math.round(t0 * SR);
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SR;
      const f = fA + (fB - fA) * (1 - Math.exp(-t / 0.014));
      ph += (TAU * f) / SR;
      y[i] += amp * (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.0012) * Math.exp(-t / tau);
    }
  };
  bubble(0, 280, 980, 0.04, 1);
  bubble(0.028, 520, 1500, 0.025, 0.32);
  for (let i = 0; i < samples(0.002); i++) y[i] += 0.12 * rng.bi() * Math.exp(-i / SR / 0.0004);
  const dry = monoToStereo(filt(y, 'lp', 6000));
  const wet = freeverb(dry, { room: 0.55, damp: 0.5 });
  const out = stereoN(n);
  addStereo(out, dry, 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 400), 0, 0.12);
  return fadeOutRange(out, 0.2, 0.25);
}

// Soft keyboard / typewriter tick: small click + plastic ping + tiny thock.
function sfxTick({ seed = 604 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.06);
  const click = filt(whiteNoise(n, rng), 'bp', 2800, 1.0);
  const thud = filt(whiteNoise(n, rng), 'lp', 1200);
  const y = new Float64Array(n);
  const tb = 0.006;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = Math.min(1, t / 0.0002) * (click[i] * 1.2 * Math.exp(-t / 0.0018) + 0.25 * Math.sin(TAU * 1900 * t) * Math.exp(-t / 0.0035));
    if (t >= tb) {
      const u = t - tb;
      v += 0.45 * Math.sin(TAU * 290 * u) * Math.exp(-u / 0.008) + 0.3 * thud[i] * Math.exp(-u / 0.002);
    }
    y[i] = v;
  }
  return monoToStereo(tailFade(filt(filt(y, 'hp', 150), 'lp', 7500), 0.008));
}

// Clean UI click: one crisp transient with a short body, a faint release tick.
function sfxClick({ seed = 605 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.08);
  const y = new Float64Array(n);
  const transient = (t0, amp, fRes, tauRes) => {
    const s0 = Math.round(t0 * SR);
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SR;
      y[i] +=
        amp *
        (0.55 * rng.bi() * Math.exp(-t / 0.0003) +
          0.7 * Math.sin(TAU * fRes * t) * Math.exp(-t / tauRes) +
          0.35 * Math.sin(TAU * 950 * t) * Math.exp(-t / 0.004));
    }
  };
  transient(0, 1, 3600, 0.0011);
  transient(0.032, 0.3, 4400, 0.0008);
  return monoToStereo(tailFade(filt(filt(y, 'hp', 350), 'lp', 11000), 0.008));
}

// Glass shimmer: rising D-major pentatonic bell partials, glints, airy hiss, reverb.
function sfxSparkle({ seed = 606 } = {}) {
  const rng = makeRng(seed);
  const dur = 1.2;
  const n = samples(dur);
  const dry = stereoN(n);
  const notes = [86, 88, 90, 93, 95, 98, 100, 102, 105]; // D6 .. A7
  notes.forEach((m, k) => {
    const f = mtof(m);
    const len = samples(0.7);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      const a = Math.min(1, t / 0.0015);
      y[i] = a * (Math.sin(TAU * f * t) * Math.exp(-t / 0.28) + 0.3 * Math.sin(TAU * 2.756 * f * t + 1) * Math.exp(-t / 0.06) + 0.15 * Math.sin(TAU * 2 * f * t) * Math.exp(-t / 0.12));
    }
    addMono(dry, tailFade(y, 0.05), k * 0.045, 0.85 - k * 0.045, k % 2 ? 0.6 : -0.6);
  });
  for (let g = 0; g < 12; g++) {
    const t0 = rng.range(0.05, 0.7);
    const f = rng.range(6000, 11000);
    const len = samples(0.05);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) y[i] = Math.sin((TAU * f * i) / SR) * Math.min(1, i / 30) * Math.exp(-i / SR / 0.01);
    addMono(dry, y, t0, 0.12, rng.bi() * 0.9);
  }
  const hissL = filt(whiteNoise(n, rng), 'hp', 7000);
  const hissR = filt(whiteNoise(n, rng), 'hp', 7000);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = 0.045 * Math.sin(Math.PI * clamp(t / 0.9, 0, 1));
    dry.L[i] += hissL[i] * e;
    dry.R[i] += hissR[i] * e;
  }
  const wet = freeverb(dry, { room: 0.82, damp: 0.2 });
  const out = stereoN(n);
  addStereo(out, dry, 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 800), 0, 0.5);
  return fadeOutRange(out, 0.95, dur);
}

// Reverse-cymbal + soft riser, peaking exactly at its end (place the end on a cut).
function sfxSwell() {
  const dur = 1.5;
  const rc = reverseCymbal(dur, 607);
  const rs = riser({ dur, fStart: 350, fEnd: 9000, toneFrom: 293.7, toneTo: 1174.7, toneAmt: 0.18, curve: 2.4, seed: 608 });
  const out = stereoN(samples(dur));
  addStereo(out, rc, 0, 0.6);
  addStereo(out, rs, 0, 0.55);
  return out;
}

// Warm two-note notification chime (A5 -> D6), soft bell partials, room.
function sfxChime({ seed = 610 } = {}) {
  const rng = makeRng(seed);
  const dur = 1.5;
  const n = samples(dur);
  const dry = stereoN(n);
  const note = (t0, f, amp, decay, pan) => {
    ['L', 'R'].forEach((c, ci) => {
      const s0 = Math.round(t0 * SR);
      const df = ci ? 0.9 : -0.9;
      const ph = rng.next() * TAU;
      const [gl, gr] = panGains(pan);
      const g = ci ? gr : gl;
      for (let i = s0; i < n; i++) {
        const t = (i - s0) / SR;
        const a = Math.min(1, t / 0.002);
        const idx = 0.6 * Math.exp(-t / 0.05);
        const v =
          Math.sin(TAU * (f + df) * t + idx * Math.sin(TAU * f * t)) * Math.exp(-t / decay) +
          0.3 * Math.sin(TAU * 2 * f * t + ph) * Math.exp(-t / (decay * 0.35)) +
          0.08 * Math.sin(TAU * 3 * f * t) * Math.exp(-t / (decay * 0.15)) +
          0.25 * Math.sin(TAU * 0.5 * f * t) * Math.exp(-t / (decay * 0.8));
        dry[c][i] += amp * a * v * g;
      }
    });
  };
  note(0, mtof(81), 0.8, 0.45, -0.2); // A5
  note(0.16, mtof(86), 1.0, 0.7, 0.2); // D6
  const wet = freeverb(dry, { room: 0.8, damp: 0.3 });
  const out = stereoN(n);
  addStereo(out, filtStereo(dry, 'lp', 9000), 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 400), 0, 0.35);
  return fadeOutRange(out, 1.25, dur);
}

// Light digital scramble: short high blips, bit-crushed chirps, S&H noise,
// stutter repeats and random panning ("text decode").
function sfxGlitch({ seed = 611 } = {}) {
  const rng = makeRng(seed);
  const dur = 0.3;
  const n = samples(dur);
  const out = stereoN(n);
  const makeSeg = (len, type) => {
    const y = new Float64Array(len);
    if (type === 'blip') {
      const f = rng.range(1200, 4200);
      for (let i = 0; i < len; i++) y[i] = (((f * i) / SR) % 1 < 0.5 ? 1 : -1) * 0.5;
    } else if (type === 'crush') {
      const f0 = rng.range(600, 2500);
      const f1 = f0 * rng.range(0.5, 2);
      const hold = rng.int(4, 12);
      let v = 0;
      let ph = 0;
      for (let i = 0; i < len; i++) {
        ph += (TAU * lerp(f0, f1, i / len)) / SR;
        if (i % hold === 0) v = Math.round(Math.sin(ph) * 4) / 4;
        y[i] = v * 0.7;
      }
    } else {
      const hold = rng.int(3, 30);
      let v = 0;
      for (let i = 0; i < len; i++) {
        if (i % hold === 0) v = rng.bi();
        y[i] = v * 0.45;
      }
    }
    const r = Math.min(24, len >> 2); // 0.5 ms edges
    for (let i = 0; i < r; i++) {
      y[i] *= i / r;
      y[len - 1 - i] *= i / r;
    }
    return y;
  };
  let t = 0;
  let prev = null;
  const types = ['blip', 'crush', 'sh', 'blip'];
  while (t < dur - 0.03) {
    let seg;
    let reps = 1;
    if (prev && rng.chance(0.3)) {
      seg = prev;
      reps = rng.int(2, 3);
    } else {
      seg = makeSeg(samples(rng.range(0.008, 0.028)), t === 0 ? 'blip' : types[rng.int(0, 3)]);
    }
    const pan = rng.range(-0.7, 0.7);
    const g = (t === 0 ? 1 : rng.range(0.45, 0.9)) * (1 - 0.45 * (t / dur));
    for (let r = 0; r < reps && t < dur - 0.02; r++) {
      addMono(out, seg, t, g * (r ? 0.8 : 1), pan);
      t += seg.length / SR;
    }
    prev = seg;
    if (rng.chance(0.35)) t += rng.range(0.004, 0.018);
  }
  filtStereo(out, 'hp', 300);
  filtStereo(out, 'lp', 9500);
  return fadeOutRange(out, dur - 0.02, dur);
}

// [file, length (s), generator, peak dBFS, end-declick?]
const SFX = [
  ['whoosh.wav', 0.7, () => sfxWhoosh(), -3, true],
  ['whoosh-soft.wav', 0.5, () => sfxWhoosh({ dur: 0.5, fLo: 1200, fPeak: 6000, fEnd: 2400, peakAt: 0.4, q: 1.1, panFrom: 0.6, panTo: -0.6, floor: 0.15, verb: 0.15, seed: 602 }), -6, true],
  ['pop.wav', 0.25, () => sfxPop(), -3, true],
  ['tick.wav', 0.06, () => sfxTick(), -3, true],
  ['sparkle.wav', 1.2, () => sfxSparkle(), -3, true],
  ['swell.wav', 1.5, () => sfxSwell(), -3, false],
  ['impact.wav', 1.2, () => sfxImpactWithRoom(), -3, true],
  ['click.wav', 0.08, () => sfxClick(), -3, true],
  ['chime.wav', 1.5, () => sfxChime(), -3, true],
  ['glitch.wav', 0.3, () => sfxGlitch(), -3, true],
];

// Soft cinematic boom + air with a short room tail.
function sfxImpactWithRoom() {
  const dry = softBoom({ f0: 62, f1: 33, glideTau: 0.3, decay: 0.42, len: 1.2, noiseAmt: 0.3, air: 0.16, seed: 609 });
  const wet = freeverb(dry, { room: 0.8, damp: 0.4 });
  const out = stereoN(dry.L.length);
  addStereo(out, dry, 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 200), 0, 0.22);
  return fadeOutRange(out, 1.0, 1.2);
}

function fitLength(buf, n) {
  const out = stereoN(n);
  const m = Math.min(n, buf.L.length);
  out.L.set(buf.L.subarray(0, m));
  out.R.set(buf.R.subarray(0, m));
  return out;
}

// ----------------------------------------------------------------------------
// Verification helpers (operate on files re-read from disk)
// ----------------------------------------------------------------------------
const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(1) : '-inf');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

function fileStats(path) {
  const w = readWav(path);
  const [L, R] = w.ch;
  let peak = 0;
  let sq = 0;
  let sumL = 0;
  let sumR = 0;
  let bad = 0;
  for (let i = 0; i < w.frames; i++) {
    const l = L[i];
    const r = R[i];
    if (!Number.isFinite(l) || !Number.isFinite(r)) {
      bad++;
      continue;
    }
    peak = Math.max(peak, Math.abs(l), Math.abs(r));
    sq += l * l + r * r;
    sumL += l;
    sumR += r;
  }
  // onset: first sample above -40 dB relative to the file peak
  const thr = peak * dbToGain(-40);
  let onset = 0;
  while (onset < w.frames && Math.abs(L[onset]) < thr && Math.abs(R[onset]) < thr) onset++;
  return {
    w,
    peakDb: gainToDb(peak),
    rmsDb: gainToDb(Math.sqrt(sq / (2 * w.frames))),
    dcPct: (Math.max(Math.abs(sumL), Math.abs(sumR)) / w.frames) * 100,
    bad,
    onsetMs: (onset / SR) * 1000,
    firstNonZero: (() => {
      let i = 0;
      while (i < w.frames && L[i] === 0 && R[i] === 0) i++;
      return i;
    })(),
  };
}

function verifyMusic(path) {
  const { w } = fileStats(path);
  const [L, R] = w.ch;
  const buf = { L, R };
  const n = w.frames;
  console.log('\nmusic.wav per-bar RMS / peak (dBFS):');
  console.log('  bar   time (s)      section     RMS    peak   chord');
  for (let b = 0; b < BARS; b++) {
    const a = b * BAR;
    let pk = 0;
    for (let i = Math.round(a * SR); i < Math.min(n, Math.round((a + BAR) * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    console.log(
      `  ${padL(b, 3)}  ${padL(a.toFixed(1), 5)}-${pad((a + BAR).toFixed(1), 5)}  ${pad(sectionOf(b), 10)} ${padL(fmtDb(gainToDb(rmsOf(buf, [[a, a + BAR]]))), 6)} ${padL(fmtDb(gainToDb(pk)), 6)}   ${CHORDS[SEQ[b]].name}`
    );
  }
  console.log('\nmusic.wav per-section RMS (dBFS):');
  for (const [name, a, b] of SECTIONS) {
    console.log(`  ${pad(name, 10)} bars ${padL(a, 2)}-${pad(b - 1, 2)} ${padL(fmtDb(gainToDb(rmsOf(buf, [[a * BAR, b * BAR]]))), 6)}`);
  }
  const quarter = [];
  for (let t = 52.8; t < 57.6 - 1e-9; t += 0.3) quarter.push(fmtDb(gainToDb(rmsOf(buf, [[t, t + 0.3]]))));
  console.log(`  ring-out RMS every 0.3 s from 52.8 s: ${quarter.join(' ')}`);
  let tailPk = 0;
  for (let i = Math.round(57.3 * SR); i < n; i++) tailPk = Math.max(tailPk, Math.abs(L[i]), Math.abs(R[i]));
  console.log(`  last 0.3 s (57.3-57.6 s): ${tailPk === 0 ? 'digital silence (all samples 0)' : 'peak ' + fmtDb(gainToDb(tailPk)) + ' dBFS'}`);
  let m2 = 0;
  let s2 = 0;
  for (let i = Math.round(T.MAIN * SR); i < Math.round(T.BREAK * SR); i++) {
    m2 += ((L[i] + R[i]) / 2) ** 2;
    s2 += ((L[i] - R[i]) / 2) ** 2;
  }
  console.log(`  stereo width (main groove): side/mid = ${fmtDb(10 * Math.log10(s2 / m2))} dB`);
  return tailPk;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
function main() {
  const t0 = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  const stems = renderMusic();
  const m = mixAndMaster(stems);
  writeWav(join(OUT_DIR, 'music.wav'), m.out);
  console.log(`music.wav: master pre-gain ${m.preDb.toFixed(2)} dB, limiter max reduction ${m.maxReductionDb.toFixed(2)} dB, main-groove RMS ${m.rmsDb.toFixed(2)} dBFS`);
  console.log(`stem loudness in main groove (K-weighted, dB rel. full mix): ${m.stemReport}`);

  for (const [name, len, gen, peakDb, declick] of SFX) {
    const buf = fitLength(gen(), samples(len));
    filtStereo(buf, 'hp', 20, 0.7); // DC / infrasonic guard
    if (declick) fadeOutRange(buf, len - 0.003, len);
    normalizePeak(buf, peakDb);
    writeWav(join(OUT_DIR, name), buf);
  }

  console.log('\nVerification (every file re-read from disk):');
  console.log(pad('file', 17) + padL('dur (s)', 9) + padL('rate', 7) + padL('ch', 3) + padL('bits', 5) + padL('peak', 7) + padL('RMS', 7) + padL('onset ms', 9) + padL('DC %', 7) + padL('clip', 5) + padL('bad', 4));
  const problems = [];
  for (const name of ['music.wav', ...SFX.map((s) => s[0])]) {
    const s = fileStats(join(OUT_DIR, name));
    const { w } = s;
    console.log(
      pad(name, 17) +
        padL(w.duration.toFixed(4), 9) +
        padL(w.sampleRate, 7) +
        padL(w.channels, 3) +
        padL(w.bits, 5) +
        padL(fmtDb(s.peakDb), 7) +
        padL(fmtDb(s.rmsDb), 7) +
        padL(s.onsetMs.toFixed(1), 9) +
        padL(s.dcPct.toFixed(3), 7) +
        padL(w.fullScale, 5) +
        padL(s.bad, 4)
    );
    if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16) problems.push(`${name}: wrong format`);
    if (s.bad) problems.push(`${name}: non-finite samples`);
    if (w.fullScale) problems.push(`${name}: ${w.fullScale} full-scale (clipped) samples`);
    if (s.dcPct > 0.5) problems.push(`${name}: DC offset ${s.dcPct.toFixed(3)}%`);
    // SFX must start immediately: first sample above -40 dB (rel. peak) within 10 ms
    // (attack ramps start at 0 for declicking, so a couple of zero samples are expected).
    if (name !== 'music.wav' && s.onsetMs > 10) problems.push(`${name}: onset at ${s.onsetMs.toFixed(1)} ms`);
    const want = name === 'music.wav' ? SONG_SEC : SFX.find((x) => x[0] === name)[1];
    if (Math.abs(w.duration - want) > 0.001) problems.push(`${name}: duration ${w.duration} != ${want}`);
    if (name === 'music.wav' && s.peakDb > -0.95) problems.push('music.wav: peak above -1 dBFS');
  }
  const tailPk = verifyMusic(join(OUT_DIR, 'music.wav'));
  if (tailPk !== 0) problems.push('music.wav: last 0.3 s not silent');
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / clipping / DC checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT_DIR}`);
  if (problems.length) process.exitCode = 1;
}

main();
