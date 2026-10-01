#!/usr/bin/env node
// =============================================================================
// scripts/generate-music.mjs
//
// Procedural music bed for the "apple-barcelona" vlog (Spanish voiceover).
// Every sound is synthesized from math (additive felt piano, PolyBLEP string /
// pad ensembles, sine sub bass, noise drums, freeverb, ping-pong delay).
// No samples, no downloads, zero npm deps. Deterministic: all randomness comes
// from seeded PRNGs (never Math.random), so two runs are byte-identical.
//
//   node scripts/generate-music.mjs
//
// Writes public/music.wav (48 kHz, stereo, 16-bit PCM, exactly 72.44 s) and
// prints a verification report computed by re-reading the file from disk.
//
// Musical design (bed UNDER a voiceover: warm, sparse in 1-4 kHz, no lead line)
//   Key C major, 4/4, 85.89 BPM (beat = 47.5/68 s, so 8.4 s and 55.9 s fall
//   exactly on bar lines; grid origin 0.0176 s).
//   bars  0-2   0.0- 8.4  intro     Fmaj7 Am7 Gsus4-G : felt-piano arpeggio, airy pad,
//                                   soft heartbeat kick + shaker, riser into 8.4
//   bars  3-11  8.4-33.2  groove    C G/B Am Fmaj7 x2, Gsus4-G : soft kick, snaps/claps,
//                                   shaker, tresillo piano chords + bass; strings from bar 7;
//                                   "push" stop on the and-of-4 (33.2 s) anticipating Am
//   bars 12-19 33.2-55.9  intimate  Am7 Fmaj7 C G Am7 Fmaj7 Dm7 Gsus4-G : piano arp +
//                                   strings, heartbeat pulse, 6 s build (16ths, riser, toms)
//   bars 20-24 55.9-69.9  climax    C G/B Am7 Fmaj7 | Cadd9 (anticipated at 66.4 s, the
//                                   biggest hit) Gsus4-G : full drums, 8th piano, strings swell
//   bar  25+   69.9-72.44 ending    C final soft hit, warm piano + strings ring-out,
//                                   raised-cosine fade, digital silence in the last 0.2 s
// =============================================================================

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(HERE, '..', 'public', 'music.wav');

const SR = 48000;
const TAU = Math.PI * 2;
const DURATION = 72.44;
const N_TOTAL = Math.round(DURATION * SR);
const SILENT_TAIL = 0.2;
const FADE = [70.7, DURATION - SILENT_TAIL - 0.01]; // raised-cosine fade, zero from 72.23 s

// Section map of the final edit (seconds)
const SECTIONS = [
  ['intro', 0.0, 8.4],
  ['groove', 8.4, 33.2],
  ['intimate', 33.2, 55.9],
  ['climax', 55.9, 69.9],
  ['ending', 69.9, DURATION],
];
const sectionAtSec = (t) => (SECTIONS.find(([, a, b]) => t >= a && t < b) ?? SECTIONS[SECTIONS.length - 1])[0];

// ----------------------------------------------------------------------------
// Math helpers
// ----------------------------------------------------------------------------
const dbToGain = (db) => Math.pow(10, db / 20);
const gainToDb = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
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

function normMono(y, peak = 1) {
  let p = 0;
  for (let i = 0; i < y.length; i++) p = Math.max(p, Math.abs(y[i]));
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
  return b;
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
  return { ...fmt, frames, duration: frames / fmt.sampleRate, ch, fullScale, bytes: b };
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

// RBJ-cookbook shelves (slope 1) and peaking EQ.
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
function peakEq(x, f0, gainDb, q = 0.7) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (TAU * f0) / SR;
  const cw = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha / A;
  return biquad(x, (1 + alpha * A) / a0, (-2 * cw) / a0, (1 - alpha * A) / a0, (-2 * cw) / a0, (1 - alpha / A) / a0);
}
function eqStereo(buf, fn, ...args) {
  buf.L = fn(buf.L, ...args);
  buf.R = fn(buf.R, ...args);
  return buf;
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
function kickSoft({ f0 = 118, f1 = 46, pitchTau = 0.034, decay = 0.2, len = 0.5, click = 0.14, drive = 1.25, lp = 5000, seed = 11 } = {}) {
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
  return normMono(tailFade(filt(y, 'lp', lp), 0.03));
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
  const nz = filt(filt(filt(whiteNoise(n, rng), 'bp', 1250, 1.0), 'hp', 600), 'lp', 6000);
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

// Finger snap: tight band-passed noise crack + a short skin "pop" tone.
function snap({ seed = 91, tone = 1 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.15);
  const nz = filt(filt(whiteNoise(n, rng), 'bp', 2300 * tone, 1.6), 'hp', 900);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const a = Math.min(1, t / 0.0004);
    y[i] = a * (nz[i] * (0.75 * Math.exp(-t / 0.009) + 0.25 * Math.exp(-t / 0.035)) + 0.35 * Math.sin(TAU * 1350 * tone * t) * Math.exp(-t / 0.005));
  }
  return normMono(tailFade(filt(y, 'lp', 7000), 0.02));
}

// Closed hi-hat: six detuned squares (808 ratios) + noise, band-passed, softened top.
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
  const y = filt(filt(filt(src, 'bp', 8500 * tone, 0.7), 'hp', 5500), 'lp', 11500);
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
  const n = samples(0.45);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = freq * (1 + 0.5 * Math.exp(-t / 0.02));
    ph += (TAU * f) / SR;
    y[i] = Math.min(1, t / 0.001) * (Math.sin(ph) * Math.exp(-t / 0.18) + 0.15 * rng.bi() * Math.exp(-t / 0.01));
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], 1.3);
  return normMono(tailFade(filt(y, 'lp', 4500), 0.03));
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
    const y = filt(filt(filt(src, 'hp', 3000 * bright, 0.7), 'hp', 2400 * bright, 0.7), 'lp', 9500);
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
    const nz = filt(pinkNoise(n, makeRng(seed * 17 + ci)), 'bp', fcAt, qAt);
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
function softBoom({ f0 = 62, f1 = 34, glideTau = 0.28, decay = 0.45, len = 1.4, noiseAmt = 0.35, noiseDecay = 0.08, air = 0.12, drive = 1.15, seed = 81 } = {}) {
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

// Felt piano: additive, two slightly detuned strings per partial, stretched
// (inharmonic) partials, hammer-position comb, two-stage decay with faster
// high partials, velocity-dependent brightness and a soft felt "thump".
// Partials use recursive rotation oscillators (cheap) and stop when inaudible.
// Rendered once per (midi, velocity level) and cached; peak-normalised to 1.
const PIANO_LEN = 4.8;
const pianoCache = new Map();
function pianoNote(midi, level) {
  const key = midi * 8 + level;
  const hit = pianoCache.get(key);
  if (hit) return hit;
  const rng = makeRng(70000 + key * 31);
  const f0 = mtof(midi);
  const vel = level / 4;
  const n = samples(PIANO_LEN);
  const y = new Float64Array(n);
  const tau0 = clamp(3.0 * Math.pow(261.63 / f0, 0.6), 0.9, 9);
  const B = 0.00015 + 0.00035 * clamp((midi - 40) / 50, 0, 1);
  const fc = 450 + 2300 * Math.pow(vel, 1.4) + 0.8 * f0; // felt: dark unless hit hard
  const nMax = Math.max(3, Math.min(16, Math.floor(7000 / f0)));
  for (let k = 1; k <= nMax; k++) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    if (fk > 9000) break;
    const comb = 0.25 + 0.75 * Math.abs(Math.sin((Math.PI * k) / 8.3));
    const amp = comb * Math.pow(k, -0.9) * Math.exp(-(fk - f0) / fc);
    if (amp < 1e-4) continue;
    const tauSlow = tau0 / (1 + 0.22 * (k - 1) + fk / 2500);
    const tauFast = tauSlow * 0.22;
    for (let s = 0; s < 2; s++) {
      const cents = (s ? 1 : -1) * rng.range(0.3, 1.1);
      const w = (TAU * fk * Math.pow(2, cents / 1200)) / SR;
      const cr = Math.cos(w);
      const sr = Math.sin(w);
      const ph = rng.next() * TAU;
      let c = Math.cos(ph);
      let si = Math.sin(ph);
      const dF = Math.exp(-1 / (tauFast * SR));
      const dS = Math.exp(-1 / (tauSlow * (s ? 1.08 : 0.94) * SR));
      let eF = 0.5 * amp * 0.55;
      let eS = 0.5 * amp * 0.45;
      for (let i = 0; i < n; i++) {
        y[i] += si * (eF + eS);
        const nc = c * cr - si * sr;
        si = si * cr + c * sr;
        c = nc;
        eF *= dF;
        eS *= dS;
        if (eF + eS < 1e-6) break;
      }
    }
  }
  // felt hammer thump
  const nz = filt(whiteNoise(samples(0.05), rng), 'lp', 250 + 1400 * vel, 0.7);
  for (let i = 0; i < nz.length; i++) y[i] += 0.06 * vel * nz[i] * Math.exp(-i / SR / 0.006);
  // soft attack (slower for gentle touches)
  const att = samples(0.0025 + 0.004 * (1 - vel));
  for (let i = 0; i < att; i++) y[i] *= i / att;
  normMono(tailFade(y, 0.05));
  pianoCache.set(key, y);
  return y;
}

// Mix a piano note into a bus: held for `dur` seconds (key / pedal), then a
// damper release (exp, tau = rel) with a short linear taper to zero.
function addPiano(bus, midi, t, dur, vel, { rel = 0.16, pan = null } = {}) {
  const x = pianoNote(midi, clamp(Math.round(vel * 4), 1, 4));
  const off = Math.round(Math.max(0, t) * SR);
  const dS = Math.round(dur * SR);
  const total = Math.min(x.length, dS + samples(rel * 5));
  const m = Math.min(total, bus.L.length - off);
  const [gl, gr] = panGains(pan ?? clamp((midi - 62) / 40, -0.5, 0.5));
  const g = Math.pow(vel, 1.3);
  const relA = Math.exp(-1 / (rel * SR));
  const fadeN = samples(0.03);
  let e = 1;
  for (let i = 0; i < m; i++) {
    if (i > dS) e *= relA;
    let v = x[i] * g * e;
    const left = total - i;
    if (left < fadeN) v *= left / fadeN;
    bus.L[off + i] += v * gl;
    bus.R[off + i] += v * gr;
  }
}

// String-ensemble voice: 3 detuned PolyBLEP saws per side, bowed (slow) attack,
// delayed vibrato, slow drift. Stereo; the bus gets a 24 dB/oct low-pass later.
function stringVoice(freq, dur, { attack = 0.6, release = 1.0, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + release);
  const out = stereoN(n);
  const det = [
    [-11, -2, 7],
    [-6, 3, 12],
  ];
  const ratios = det.map((side) => side.map((c) => Math.pow(2, c / 1200)));
  const oscs = det.map((side) => side.map(() => new Osc(rng.next())));
  const vibRate = rng.range(4.6, 5.6);
  const vibPh = rng.next() * TAU;
  const driftRate = rng.range(0.08, 0.2);
  const driftPh = rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = t < attack ? Math.sin((Math.PI / 2) * (t / attack)) ** 2 : 1;
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    const vib = 1 + 0.0022 * smoothstep((t - 0.35) / 0.9) * Math.sin(TAU * vibRate * t + vibPh) + 0.0008 * Math.sin(TAU * driftRate * t + driftPh);
    const f = freq * vib;
    let l = 0;
    let r = 0;
    for (let k = 0; k < 3; k++) {
      l += oscs[0][k].saw(f * ratios[0][k]);
      r += oscs[1][k].saw(f * ratios[1][k]);
    }
    out.L[i] = (l / 3) * env;
    out.R[i] = (r / 3) * env;
  }
  return out;
}

// Warm airy pad voice: 2 detuned PolyBLEP saws per side + soft sine, slow envelope.
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
    const s = 0.35 * sub.sine(freq * vib);
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

// Sub bass: sine + low harmonics + a touch of low-passed saw for definition.
function bassNote(midi, dur, vel = 1, { release = 0.08, drive = 1.3 } = {}) {
  const n = samples(dur + release);
  const f = mtof(midi);
  const saw = new Float64Array(n);
  const os = new Osc(0.25);
  for (let i = 0; i < n; i++) saw[i] = os.saw(f);
  const sawF = filt(saw, 'lp', 360, 0.7);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * f * (1 + 0.06 * Math.exp(-t / 0.01))) / SR;
    let env = Math.min(1, t / 0.008) * (0.8 + 0.2 * Math.exp(-t / 0.25));
    if (t > dur) env *= 0.5 + 0.5 * Math.cos(Math.PI * clamp((t - dur) / release, 0, 1));
    y[i] = sat((Math.sin(ph) + 0.16 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph) + 0.2 * sawF[i]) * env * vel, drive);
  }
  return y;
}

// ----------------------------------------------------------------------------
// Song map: C major, 4/4. The beat length is chosen so that the edit points
// 8.4 s (bar 3) and 55.9 s (bar 20) land exactly on downbeats: 68 beats apart.
// ----------------------------------------------------------------------------
const BEAT = 47.5 / 68; // 0.698529 s
const BPM = 60 / BEAT; // 85.89
const BAR = 4 * BEAT;
const ORIGIN = 8.4 - 12 * BEAT; // 0.0176 s: beat 0
const tb = (beat) => ORIGIN + beat * BEAT; // beat -> seconds
const GAP = 0.03; // swells stop just before their downbeat (a breath)

// Voicings (MIDI). bass: bass note; alt: passing chord tone for the bass;
// lh: piano left hand [oct2, oct3]; rh: piano right-hand chord (E4..C5 zone);
// arp: 6 arpeggio tones low->high; str: strings; pad: airy pad.
const CHORDS = {
  C: { name: 'C', bass: 36, alt: 43, lh: [36, 48], rh: [64, 67, 72], arp: [48, 55, 60, 62, 64, 67], str: [48, 55, 64, 67, 72], pad: [48, 55, 62, 64, 67] },
  Cadd9: { name: 'Cadd9', bass: 36, alt: 43, lh: [36, 48], rh: [64, 67, 74], arp: [48, 55, 60, 62, 64, 67], str: [48, 55, 64, 67, 76], pad: [48, 55, 62, 64, 67] },
  'G/B': { name: 'G/B', bass: 35, alt: 38, lh: [35, 47], rh: [62, 67, 71], arp: [47, 55, 59, 62, 67, 69], str: [47, 55, 62, 67, 71], pad: [47, 55, 62, 67, 69] },
  G: { name: 'G', bass: 31, alt: 38, lh: [31, 43], rh: [62, 67, 71], arp: [43, 50, 55, 59, 62, 67], str: [43, 50, 59, 62, 71], pad: [43, 50, 57, 59, 62] },
  Gsus4: { name: 'Gsus4', bass: 31, alt: 38, lh: [31, 43], rh: [62, 67, 72], arp: [43, 50, 55, 60, 62, 67], str: [43, 50, 60, 62, 72], pad: [43, 50, 55, 60, 62] },
  Am: { name: 'Am7', bass: 33, alt: 40, lh: [33, 45], rh: [60, 64, 69], arp: [45, 52, 57, 60, 64, 67], str: [45, 52, 60, 64, 69], pad: [45, 52, 55, 60, 64] },
  F: { name: 'Fmaj7', bass: 29, alt: 36, lh: [29, 41], rh: [60, 64, 69], arp: [41, 48, 53, 57, 60, 64], str: [41, 48, 57, 60, 65], pad: [41, 48, 55, 57, 64] },
  Dm7: { name: 'Dm7', bass: 38, alt: 45, lh: [38, 50], rh: [60, 65, 69], arp: [50, 57, 60, 62, 65, 69], str: [50, 57, 60, 65, 69], pad: [50, 53, 57, 60, 64] },
};

// Chord timeline: [start beat, chord]. 47.5 (= 33.2 s) and 95 (= 66.38 s) are
// pop "pushes" (the next bar's chord anticipated by an 8th / a beat).
const CHORD_TL = [
  [0, 'F'], [4, 'Am'], [8, 'Gsus4'], [10, 'G'],
  [12, 'C'], [16, 'G/B'], [20, 'Am'], [24, 'F'], [28, 'C'], [32, 'G/B'], [36, 'Am'], [40, 'F'], [44, 'Gsus4'], [46, 'G'],
  [47.5, 'Am'], [52, 'F'], [56, 'C'], [60, 'G'], [64, 'Am'], [68, 'F'], [72, 'Dm7'], [76, 'Gsus4'], [78, 'G'],
  [80, 'C'], [84, 'G/B'], [88, 'Am'], [92, 'F'], [95, 'Cadd9'], [98, 'Gsus4'], [99, 'G'],
  [100, 'C'],
];
const END_BEAT = (DURATION - ORIGIN) / BEAT;
const chordAt = (beat) => {
  let c = CHORD_TL[0];
  for (const e of CHORD_TL) if (e[0] <= beat + 1e-9) c = e;
  return CHORDS[c[1]];
};
const nextChange = (beat) => {
  for (const [b] of CHORD_TL) if (b > beat + 1e-9) return b;
  return END_BEAT + 1;
};

// Musical sections in beats
const B = { GROOVE: 12, STRINGS_IN: 28, PUSH: 47.5, INTIMATE: 48, HEART: 64, BUILD: 72, CLIMAX: 80, PEAK: 95, BREATH: 99.5, END: 100 };

const ARP8 = [0, 1, 2, 4, 3, 5, 4, 2];
const ARP16 = [0, 1, 2, 3, 4, 5, 4, 3, 2, 3, 4, 5, 4, 3, 2, 1];

// ----------------------------------------------------------------------------
// Music render: returns the dry stems + a drum reverb send
// ----------------------------------------------------------------------------
function renderMusic() {
  const N = N_TOTAL;
  const bus = {
    drums: stereoN(N),
    drumVerb: stereoN(N),
    bass: stereoN(N),
    pianoA: stereoN(N), // arpeggios (gets ping-pong)
    pianoC: stereoN(N), // chords + left hand
    strings: stereoN(N),
    pad: stereoN(N),
    fx: stereoN(N),
  };
  const rng = makeRng(2026);
  const hum = () => rng.range(-0.004, 0.004);
  const kickTimes = [];

  // ---- kit
  const K = kickSoft({ seed: 11 });
  const KS = kickSoft({ f0: 92, f1: 44, click: 0.04, decay: 0.24, lp: 1800, seed: 12 }); // heartbeat
  const RIM = [rim({ seed: 21 }), rim({ seed: 22, tone: 1.03 })];
  const CLAP = clap({ seed: 31 });
  const SNAPS = [snap({ seed: 91 }), snap({ seed: 92, tone: 1.05 })];
  const HATS = [0, 1, 2, 3].map((k) => hat({ seed: 41 + k, tone: 0.95 + 0.012 * k, decay: 0.022 + 0.004 * (k % 3) }));
  const HAT_OPEN = hat({ open: true, seed: 48, decay: 0.18 });
  const SHAKE = [0, 1, 2, 3].map((k) => shaker({ seed: 70 + k, bright: 0.92 + 0.04 * k }));
  const TOMS = [tom(185, { seed: 61 }), tom(155, { seed: 62 }), tom(123, { seed: 63 })];

  const addKick = (beat, v = 1, soft = false) => {
    const t = tb(beat);
    addMono(bus.drums, soft ? KS : K, t, 0.95 * v);
    kickTimes.push([t, soft ? 0.6 * v : v]);
  };
  const addSnap = (beat, v = 1) => {
    addMono(bus.drums, SNAPS[rng.int(0, 1)], tb(beat) + hum(), 0.42 * v, 0.12);
    addMono(bus.drumVerb, SNAPS[0], tb(beat), 0.5 * v);
  };
  const addClap = (beat, v = 1) => {
    addMono(bus.drums, CLAP, tb(beat) + 0.003, 0.5 * v, -0.06);
    addMono(bus.drumVerb, CLAP, tb(beat), 0.5 * v);
  };
  const addRim = (beat, v = 1, pan = -0.15) => {
    addMono(bus.drums, RIM[rng.int(0, 1)], tb(beat) + hum(), 0.36 * v, pan);
    addMono(bus.drumVerb, RIM[0], tb(beat), 0.2 * v);
  };
  const addShaker = (beat, v) => addMono(bus.drums, SHAKE[rng.int(0, 3)], tb(beat) + hum() + 0.004, 0.17 * v, -0.35);
  const addHat = (beat, v) => addMono(bus.drums, HATS[rng.int(0, 3)], tb(beat) + hum(), 0.14 * v, 0.3);
  const addOpenHat = (beat, chokeBeats, v = 1) => {
    const x = Float64Array.from(HAT_OPEN);
    const c = samples(chokeBeats * BEAT);
    const fl = samples(0.015);
    for (let i = c; i < x.length; i++) x[i] *= Math.max(0, 1 - (i - c) / fl);
    addMono(bus.drums, x, tb(beat), 0.1 * v, 0.3);
  };
  const addTom = (beat, k, v = 1) => {
    addMono(bus.drums, TOMS[k], tb(beat), 0.5 * v, [0.3, 0, -0.3][k]);
    addMono(bus.drumVerb, TOMS[k], tb(beat), 0.25 * v);
  };

  // ---- tonal helpers
  const piano = (busName, midi, beat, durBeats, vel, extraSec = 0) =>
    addPiano(bus[busName], midi, tb(beat) + rng.range(-0.005, 0.005), durBeats * BEAT + extraSec, clamp(vel + rng.range(-0.035, 0.035), 0.1, 1));
  const playBass = (midi, beat, durBeats, vel, opts = {}) => addMono(bus.bass, bassNote(midi, Math.max(0.05, durBeats * BEAT - 0.02), vel, opts), tb(beat), 0.55);

  // =====================================================================
  // PIANO
  // =====================================================================
  // Intro: gentle arpeggio an octave up (light, hopeful), LH octave-3 roots
  for (let e = 0; e < 24; e++) {
    const beat = e * 0.5;
    const ch = chordAt(beat);
    const v = 0.34 + 0.1 * (e / 23) + (e % 8 === 0 ? 0.08 : 0) - (e % 2 ? 0.03 : 0);
    piano('pianoA', ch.arp[ARP8[e % 8]] + 12, beat, nextChange(beat) - beat + 0.1, v);
  }
  for (const b of [0, 4, 8, 10]) piano('pianoC', chordAt(b).lh[1], b, nextChange(b) - b + 0.1, 0.42);

  // Groove: tresillo (3+3+2) piano chords, LH roots; soft high arp from bar 7
  for (let bar = 3; bar <= 11; bar++) {
    const base = bar * 4;
    const hits = [0, 1.5, 3, 4].map((x) => base + x);
    const vels = [0.62, 0.47, 0.53];
    for (let h = 0; h < 3; h++) {
      const beat = hits[h];
      const ch = chordAt(beat);
      const dur = Math.min(hits[h + 1], B.PUSH) - beat - 0.08;
      for (const m of ch.rh) piano('pianoC', m, beat, dur, vels[h] + (bar >= 7 ? 0.04 : 0));
    }
    for (const [b] of CHORD_TL) if (b >= base && b < base + 4 && b < B.PUSH) piano('pianoC', chordAt(b).lh[1], b, Math.min(nextChange(b), B.PUSH) - b, 0.5);
    if (bar >= 7 && bar <= 10) {
      for (let e = 0; e < 8; e++) {
        const beat = base + e * 0.5;
        piano('pianoA', chordAt(beat).arp[ARP8[e]] + 12, beat, 1.0, 0.3 + (e === 0 ? 0.05 : 0));
      }
    }
  }
  // The push at 33.2 s: Am anticipated, held into the intimate section
  {
    const ch = chordAt(B.PUSH);
    for (const m of ch.rh) piano('pianoC', m, B.PUSH, 4.4, 0.72);
    for (const m of ch.lh) piano('pianoC', m, B.PUSH, 4.4, 0.7);
  }

  // Intimate: warm-register 8th arpeggio, LH low roots; bar 19 = 16ths crescendo
  for (let bar = 12; bar <= 19; bar++) {
    const base = bar * 4;
    if (bar < 19) {
      for (let e = 0; e < 8; e++) {
        const beat = base + e * 0.5;
        const v = 0.44 + (e === 0 ? 0.08 : 0) - 0.012 * e + (bar >= 16 ? 0.03 : 0) + (bar >= 18 ? 0.05 : 0);
        piano('pianoA', chordAt(beat).arp[ARP8[e]], beat, Math.min(nextChange(beat) - beat, 2) + 0.1, v);
      }
    } else {
      for (let e = 0; e < 16; e++) {
        const beat = base + e * 0.25;
        piano('pianoA', chordAt(beat).arp[ARP16[e]] + (e >= 8 ? 12 : 0), beat, 0.5, 0.42 + 0.33 * (e / 15));
      }
    }
  }
  for (const [b] of CHORD_TL) {
    if (b < B.INTIMATE || b >= B.CLIMAX) continue;
    piano('pianoC', chordAt(b).lh[0], b, nextChange(b) - b + 0.1, b >= B.BUILD ? 0.6 : 0.5);
  }

  // Climax: driving 8th-note chords, LH octaves on 1 and 3 (and on the push)
  const ACC8 = [0.82, 0.5, 0.62, 0.5, 0.74, 0.5, 0.62, 0.55];
  for (let e = 0; e < 40; e++) {
    const beat = B.CLIMAX + e * 0.5;
    if (beat >= B.BREATH) break;
    const ch = chordAt(beat);
    const v = ACC8[e % 8] - (beat < 92 ? 0.05 : 0) + (beat >= B.PEAK ? 0.08 : 0) + (beat === B.PEAK ? 0.2 : 0) + (beat === B.CLIMAX ? 0.12 : 0);
    for (const m of ch.rh) piano('pianoC', m, beat, 0.46, v);
  }
  for (const b of [80, 82, 84, 86, 88, 90, 92, 94, 95, 96, 98]) {
    const ch = chordAt(b);
    const dur = Math.min(2, nextChange(b) - b, B.BREATH - b);
    for (const m of ch.lh) piano('pianoC', m, b, dur, b === 80 || b === 95 ? 0.85 : 0.68);
  }
  // Final soft hit: open C chord, rings into the fade
  for (const m of [60, 64, 67, 72]) piano('pianoC', m, B.END, 4, 0.8);
  for (const m of [36, 48]) piano('pianoC', m, B.END, 4, 0.85);
  // warm ring-out: a few soft, rising C-major tones (echoed by the ping-pong)
  [
    [100.5, 64, 0.36],
    [101, 67, 0.33],
    [101.5, 72, 0.3],
    [102.25, 76, 0.26],
  ].forEach(([b, m, v]) => piano('pianoA', m, b, END_BEAT - b, v));

  // =====================================================================
  // STRINGS (from bar 7) and PAD (whole song)
  // =====================================================================
  CHORD_TL.forEach(([s, name], idx) => {
    const ch = CHORDS[name];
    const e = idx + 1 < CHORD_TL.length ? CHORD_TL[idx + 1][0] : END_BEAT;
    const last = s === B.END;
    const dur = last ? DURATION - tb(s) : (e - s) * BEAT + 0.05;
    // pad
    ch.pad.forEach((m, k) => {
      const x = padVoice(mtof(m), dur, { attack: s === 0 ? 2.2 : 0.45, release: last ? 0.8 : 0.9, seed: 3000 + idx * 10 + k });
      addStereo(bus.pad, x, tb(s), 0.1);
    });
    // strings
    if (s < B.STRINGS_IN) return;
    const attack = s < B.PUSH ? 0.6 : s < B.CLIMAX ? 0.9 : 0.3;
    const notes = s >= B.CLIMAX ? [ch.str[0] - 12, ...ch.str] : ch.str;
    notes.forEach((m, k) => {
      const x = stringVoice(mtof(m), dur, { attack, release: last ? 0.8 : 1.1, seed: 5000 + idx * 10 + k });
      addStereo(bus.strings, x, tb(s), k === 0 ? 0.1 : 0.085);
    });
  });

  // =====================================================================
  // BASS
  // =====================================================================
  for (let bar = 3; bar <= 11; bar++) {
    const base = bar * 4;
    const ev = [
      [0, 1.35, 'r', 0.95],
      [1.5, 1.35, 'r', 0.8],
      [3, 0.85, bar % 2 ? 'alt' : 'oct', 0.75],
    ];
    for (const [s, len, kind, v] of ev) {
      const beat = base + s;
      const ch = chordAt(beat);
      const m = kind === 'r' ? ch.bass : kind === 'alt' ? ch.alt : ch.bass + 12;
      playBass(m, beat, Math.min(len, B.PUSH - beat - 0.05), 0.88 * v);
    }
  }
  playBass(chordAt(B.PUSH).bass, B.PUSH, 3.8, 0.6, { release: 0.4 });
  for (const [b] of CHORD_TL) {
    if (b < 56 || b >= 76) continue;
    playBass(chordAt(b).bass, b, nextChange(b) - b - 0.05, b >= B.BUILD ? 0.58 : 0.42, { release: 0.25 });
  }
  for (let e = 0; e < 8; e++) {
    const beat = 76 + e * 0.5;
    playBass(chordAt(beat).bass, beat, 0.42, 0.55 + 0.3 * (e / 7));
  }
  const BASS_ACC = [1, 0.7, 0.85, 0.7, 0.95, 0.7, 0.85, 0.75];
  for (let e = 0; e < 40; e++) {
    const beat = B.CLIMAX + e * 0.5;
    if (beat >= B.BREATH) break;
    const ch = chordAt(beat);
    playBass(ch.bass + (e % 8 === 7 ? 12 : 0), beat, 0.44, BASS_ACC[e % 8]);
  }
  addMono(bus.bass, bassNote(36, 2.0, 1, { release: 0.6 }), tb(B.END), 0.55);

  // =====================================================================
  // DRUMS
  // =====================================================================
  // Intro: soft heartbeat kick + shaker swell in bar 2
  addKick(4, 0.35, true);
  addKick(8, 0.42, true);
  addKick(10, 0.36, true);
  for (let e = 0; e < 8; e++) addShaker(8 + e * 0.5, 0.2 + 0.4 * (e / 7) * (e % 2 ? 0.75 : 1));

  // Groove (bars 3-11)
  for (let bar = 3; bar <= 11; bar++) {
    const base = bar * 4;
    [
      [0, 0.72],
      [1.5, 0.54],
      [2, 0.63],
    ].forEach(([s, v]) => addKick(base + s, v));
    if (bar % 2 === 0 && bar !== 10) addKick(base + 3.5, 0.4);
    for (const s of [1, 3]) {
      addSnap(base + s, 0.85);
      if (bar >= 5) addClap(base + s, bar >= 7 ? 0.55 : 0.45);
    }
    const sixteenths = bar >= 5;
    for (let k = 0; k < 16; k++) {
      const beat = base + k * 0.25;
      if (beat >= B.PUSH) break;
      if (!sixteenths && k % 2) continue;
      addShaker(beat, k % 4 === 2 ? 0.8 : k % 2 ? 0.45 : 0.62);
    }
    if (bar >= 7) for (let k = 0; k < 4; k++) if (base + k + 0.5 < B.PUSH) addHat(base + k + 0.5, 0.55 + rng.range(-0.06, 0.06));
    if (bar === 6 || bar === 10) {
      addRim(base + 3.5, 0.4, 0.2);
      addRim(base + 3.75, 0.55, 0.2);
    }
  }
  // the push: soft kick under the anticipated Am, then the drums are out
  addKick(B.PUSH, 0.7);

  // Intimate: heartbeat pulse (bars 16-17), then the build (bars 18-19)
  for (let bar = 16; bar <= 17; bar++) {
    addKick(bar * 4, 0.42, true);
    addKick(bar * 4 + 0.4, 0.3, true);
  }
  for (let k = 0; k < 4; k++) addKick(72 + k, 0.36 + 0.03 * k, true);
  for (let e = 0; e < 8; e++) addShaker(72 + e * 0.5, 0.25 + 0.25 * (e / 7));
  for (let k = 0; k < 4; k++) addKick(76 + k, 0.5 + 0.07 * k);
  for (let e = 0; e < 16; e++) addShaker(76 + e * 0.25, (0.4 + 0.4 * (e / 15)) * (e % 2 ? 0.7 : 1));
  for (let e = 0; e < 4; e++) addRim(78 + e * 0.25, 0.25 + 0.12 * e, e % 2 ? 0.2 : -0.2);
  [
    [79, 0, 0.5],
    [79.25, 0, 0.6],
    [79.5, 1, 0.75],
    [79.75, 2, 0.9],
  ].forEach(([b, k, v]) => addTom(b, k, v));

  // Climax (bars 20-24)
  for (let bar = 20; bar <= 24; bar++) {
    const base = bar * 4;
    const cl = bar <= 22 ? 0.86 : bar === 23 ? 0.93 : 1; // intensity grows toward the peak
    for (let q = 0; q < 4; q++) {
      const beat = base + q;
      if (bar === 23 && beat === 94) {
        addKick(94, 0.75 * cl);
        continue;
      }
      addKick(beat, (q % 2 ? 0.8 : 0.95) * cl);
    }
    if (bar !== 23 && bar !== 24) addKick(base + 1.5, 0.55 * cl);
    if (bar === 23) addKick(B.PEAK, 1.0);
    for (const s of [1, 3]) {
      const beat = base + s;
      const v = beat >= B.PEAK ? 1.1 : cl;
      addClap(beat, v);
      addRim(beat, 0.6 * v, -0.1);
      addSnap(beat, 0.6 * v);
    }
    for (let k = 0; k < 16; k++) {
      const beat = base + k * 0.25;
      if (beat >= B.BREATH) break;
      if (bar === 23 && beat >= 94 && beat < 95) continue; // tom fill
      addShaker(beat, (k % 4 === 2 ? 0.85 : k % 2 ? 0.5 : 0.65) * cl);
      if (k % 2 === 0) addHat(beat, (k % 4 === 2 ? 0.75 : 0.45) * cl);
    }
    if (bar === 20 || bar === 21 || bar === 22) addOpenHat(base + 3.5, 0.5, 0.9 * cl);
  }
  [
    [94, 0, 0.6],
    [94.25, 1, 0.7],
    [94.5, 1, 0.8],
    [94.75, 2, 0.95],
  ].forEach(([b, k, v]) => addTom(b, k, v));
  // Final soft hit
  addKick(B.END, 0.85);

  // =====================================================================
  // FX: risers, reverse cymbals, crashes, booms
  // =====================================================================
  // into the groove (8.4 s)
  addStereo(bus.fx, riser({ dur: 2.4, fStart: 400, fEnd: 6000, toneFrom: 392, toneTo: 1046.5, toneAmt: 0.12, seed: 71 }), tb(B.GROOVE) - GAP - 2.4, 0.08);
  addStereo(bus.fx, reverseCymbal(1.6, 58), tb(B.GROOVE) - GAP - 1.6, 0.11);
  addStereo(bus.fx, crash({ seed: 51, decay: 1.2 }), tb(B.GROOVE), 0.06);
  // strings enter (bar 7)
  addStereo(bus.fx, reverseCymbal(1.0, 59), tb(B.STRINGS_IN) - GAP - 1.0, 0.06);
  // the push into the intimate section (33.2 s): soft wash + gentle low boom
  addStereo(bus.fx, reverseCymbal(1.4, 60), tb(B.PUSH) - GAP - 1.4, 0.12);
  addStereo(bus.fx, crash({ seed: 52, decay: 2.0, len: 4, bright: 0.9 }), tb(B.PUSH), 0.11);
  addStereo(bus.fx, softBoom({ seed: 82, decay: 0.55, len: 1.8, air: 0.08 }), tb(B.PUSH), 0.16);
  // the build into the climax (55.9 s)
  const buildDur = tb(B.CLIMAX) - tb(B.BUILD) - GAP;
  addStereo(bus.fx, riser({ dur: buildDur, fStart: 300, fEnd: 7000, toneFrom: 196, toneTo: 784, toneAmt: 0.15, curve: 2.4, seed: 73 }), tb(B.BUILD), 0.15);
  addStereo(bus.fx, reverseCymbal(2.0, 61), tb(B.CLIMAX) - GAP - 2.0, 0.2);
  addStereo(bus.fx, crash({ seed: 53, decay: 1.5 }), tb(B.CLIMAX), 0.17);
  addStereo(bus.fx, softBoom({ seed: 83 }), tb(B.CLIMAX), 0.33);
  // the biggest moment (66.4 s, "Porque si yo pude...")
  addStereo(bus.fx, reverseCymbal(1.4, 62), tb(B.PEAK) - GAP - 1.4, 0.22);
  addStereo(bus.fx, riser({ dur: 1.4, fStart: 600, fEnd: 9000, toneAmt: 0.1, seed: 74 }), tb(B.PEAK) - GAP - 1.4, 0.09);
  addStereo(bus.fx, crash({ seed: 54, decay: 1.8, len: 4.5 }), tb(B.PEAK), 0.22);
  addStereo(bus.fx, softBoom({ seed: 84, f0: 60, decay: 0.55, len: 1.8 }), tb(B.PEAK), 0.45);
  // final soft hit (69.87 s)
  addStereo(bus.fx, crash({ seed: 55, decay: 1.4, len: 3, bright: 0.95 }), tb(B.END), 0.13);
  addStereo(bus.fx, softBoom({ seed: 85, decay: 0.6, len: 2 }), tb(B.END), 0.3);

  // =====================================================================
  // Bus processing
  // =====================================================================
  const secToBeat = (t) => (t - ORIGIN) / BEAT;

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
  duckBy(bus.bass, 0.35);
  duckBy(bus.pad, 0.25);
  duckBy(bus.strings, 0.12);
  duckBy(bus.pianoC, 0.06);

  filtStereo(bus.bass, 'hp', 28, 0.7);
  filtStereo(bus.bass, 'lp', 700, 0.7);

  // Pad: airy, low-passed, swells in at the start
  const padLevelFn = (t) => {
    const b = secToBeat(t);
    if (b < B.GROOVE) return 0.12 + 0.88 * smoothstep(t / 3.5);
    if (b < B.PUSH) return 0.7;
    if (b < B.BUILD) return 0.6;
    if (b < B.CLIMAX) return 0.6 + 0.15 * smoothstep((b - B.BUILD) / 8);
    if (b < B.END) return 0.75;
    return 0.9;
  };
  const padFcFn = (t) => {
    const b = secToBeat(t);
    if (b < B.GROOVE) return expInterp(650, 1500, t / tb(B.GROOVE));
    if (b < B.PUSH) return 1700;
    if (b < B.BUILD) return 1500;
    if (b < B.CLIMAX) return expInterp(1500, 2500, (b - B.BUILD) / (B.CLIMAX - B.BUILD));
    if (b < B.END) return 2500;
    return expInterp(2500, 1000, (t - tb(B.END)) / 2.5);
  };
  let pad = chorus(bus.pad, { mix: 0.35 });
  pad = filtStereo(pad, 'lp', fromArray(automation(N, padFcFn, 0.1, true)), 0.75);
  filtStereo(pad, 'hp', 120, 0.7);
  applyGain(pad, automation(N, padLevelFn, 0.12));

  // Air: very quiet pink-noise shimmer above the voice band
  const air = stereoN(N);
  ['L', 'R'].forEach((c, ci) => {
    air[c] = filt(filt(pinkNoise(N, makeRng(880 + ci)), 'bp', 7500, 0.6), 'hp', 5000, 0.7);
  });
  const airLevelFn = (t) => {
    const b = secToBeat(t);
    if (b < B.GROOVE) return 0.2 + 0.8 * smoothstep(t / 4);
    if (b < B.PUSH) return 0.5;
    if (b < B.BUILD) return 0.6;
    if (b < B.CLIMAX) return 0.6 + 0.4 * smoothstep((b - B.BUILD) / 8);
    return 1;
  };
  applyGain(air, automation(N, airLevelFn, 0.3));

  // Strings: 24 dB/oct low-pass automation (opens through the build and peak)
  const strLevelFn = (t) => {
    const b = secToBeat(t);
    if (b < B.STRINGS_IN) return 0;
    if (b < B.PUSH) return 0.3 + 0.2 * smoothstep((b - B.STRINGS_IN) / 16);
    if (b < B.BUILD) return 0.55;
    if (b < B.CLIMAX) return 0.55 + 0.35 * smoothstep((b - B.BUILD) / 8);
    if (b < B.PEAK - 1) return 0.9;
    if (b < B.END) return 0.9 + 0.3 * smoothstep((b - B.PEAK + 1) / 1.5);
    return 1.1;
  };
  const strFcFn = (t) => {
    const b = secToBeat(t);
    if (b < B.PUSH) return 1300;
    if (b < B.BUILD) return 1900;
    if (b < B.CLIMAX) return expInterp(1900, 3300, (b - B.BUILD) / (B.CLIMAX - B.BUILD));
    if (b < B.PEAK - 1) return 3300;
    if (b < B.END) return 4000;
    return expInterp(4000, 1500, (t - tb(B.END)) / 2.5);
  };
  const strFc = fromArray(automation(N, strFcFn, 0.1, true));
  filtStereo(bus.strings, 'lp', strFc, 0.6);
  filtStereo(bus.strings, 'lp', strFc, 0.6);
  filtStereo(bus.strings, 'hp', 70, 0.7);
  const strings = chorus(bus.strings, { mix: 0.25, rate: 0.27, depth: 0.003 });
  applyGain(strings, automation(N, strLevelFn, 0.1));

  // Piano: warm felt tone, voice-pocket dip; arps get a dotted-8th ping-pong
  for (const k of ['pianoA', 'pianoC']) {
    filtStereo(bus[k], 'hp', 60, 0.7);
    filtStereo(bus[k], 'lp', 4200, 0.7);
    eqStereo(bus[k], peakEq, 2600, -3, 0.9);
  }
  const pianoEcho = pingPong(bus.pianoA, { time: 0.75 * BEAT, feedback: 0.3, lp: 3500, hp: 400 });
  const pianoA = stereoN(N);
  addStereo(pianoA, bus.pianoA, 0, 1);
  addStereo(pianoA, pianoEcho, 0, 0.22);

  return { drums: bus.drums, bass: bus.bass, pianoA, pianoC: bus.pianoC, strings, pad, air, fx: bus.fx, drumVerb: bus.drumVerb };
}

// ----------------------------------------------------------------------------
// Mix + master
// ----------------------------------------------------------------------------
const CLIMAX_RANGE = [[55.9, 69.9]];
const INTIMATE_RANGE = [[33.2, 55.9]];
// Stem balance: each stem is scaled so its K-weighted RMS over a reference
// range hits the target (dB). The arpeggio piano is referenced to the intimate
// section (it is silent in the climax). fx / drumVerb follow the drums' gain.
const STEM_TARGETS = {
  drums: [CLIMAX_RANGE, -16.5],
  bass: [CLIMAX_RANGE, -18.5],
  pianoC: [CLIMAX_RANGE, -18.5],
  pianoA: [INTIMATE_RANGE, -22],
  strings: [CLIMAX_RANGE, -19],
  pad: [CLIMAX_RANGE, -24],
  air: [CLIMAX_RANGE, -38],
  verb: [CLIMAX_RANGE, -22],
};
const TARGET_RMS_DB = -14.5; // climax RMS (dBFS) after the master chain
const CEILING_DB = -1.0;

function mixAndMaster(stems) {
  const N = stems.drums.L.length;
  const gains = {};
  for (const k of ['drums', 'bass', 'pianoC', 'pianoA', 'strings', 'pad', 'air']) {
    const [range, target] = STEM_TARGETS[k];
    const r = gainToDb(rmsOf(kWeight(stems[k]), range));
    gains[k] = dbToGain(target - r);
    scaleBuf(stems[k], gains[k]);
  }
  scaleBuf(stems.fx, gains.drums);
  scaleBuf(stems.drumVerb, gains.drums);

  // Reverb glue: one shared hall fed by the melodic stems, claps/snaps and fx.
  const send = stereoN(N);
  addStereo(send, stems.pad, 0, 0.2);
  addStereo(send, stems.strings, 0, 0.25);
  addStereo(send, stems.pianoA, 0, 0.35);
  addStereo(send, stems.pianoC, 0, 0.25);
  addStereo(send, stems.drumVerb, 0, 0.35);
  addStereo(send, stems.fx, 0, 0.15);
  const verb = freeverb(send, { room: 0.86, damp: 0.35 });
  filtStereo(verb, 'hp', 300, 0.7);
  filtStereo(verb, 'lp', 7000, 0.7);
  const rv = gainToDb(rmsOf(kWeight(verb), STEM_TARGETS.verb[0]));
  scaleBuf(verb, dbToGain(STEM_TARGETS.verb[1] - rv));
  stems.verb = verb;

  const order = ['drums', 'bass', 'pianoC', 'pianoA', 'strings', 'pad', 'air', 'fx', 'verb'];
  const mix = stereoN(N);
  for (const k of order) addStereo(mix, stems[k], 0, 1);

  // Warm master: 25 Hz HP, low-mid warmth, a wide dip in the voice presence
  // band, a touch of air, then soft clip -> limiter -> end fade -> peak normalise.
  filtStereo(mix, 'hp', 25, 0.7);
  eqStereo(mix, lowShelf, 180, 1.0);
  eqStereo(mix, peakEq, 2500, -2.5, 0.7);
  eqStereo(mix, highShelf, 10000, 0.5);

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
    const rmsDb = gainToDb(rmsOf(out, CLIMAX_RANGE));
    result = { out, preDb: gainToDb(pre), maxReductionDb, rmsDb };
    if (Math.abs(rmsDb - TARGET_RMS_DB) < 0.05) break;
    pre *= dbToGain(TARGET_RMS_DB - rmsDb);
  }
  normalizePeak(result.out, CEILING_DB - 0.02); // ~ -1 dBFS sample peak
  result.rmsDb = gainToDb(rmsOf(result.out, CLIMAX_RANGE));

  let nonFinite = 0;
  for (const ch of [result.out.L, result.out.R]) for (let i = 0; i < N; i++) if (!Number.isFinite(ch[i])) nonFinite++;
  result.nonFinite = nonFinite;

  const mixK = rmsOf(kWeight(mix), CLIMAX_RANGE);
  result.stemReport = order.map((k) => `${k} ${gainToDb(rmsOf(kWeight(stems[k]), CLIMAX_RANGE) / mixK).toFixed(1)}`).join(', ');
  const story = [[33.2, 50.0]];
  result.storyReport = order.map((k) => `${k} ${gainToDb(rmsOf(kWeight(stems[k]), story) / mixK).toFixed(1)}`).join(', ');
  return result;
}

// ----------------------------------------------------------------------------
// Verification (operates on the file re-read from disk)
// ----------------------------------------------------------------------------
const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(1) : '-inf');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

function verify(path) {
  const w = readWav(path);
  const [L, R] = w.ch;
  const buf = { L, R };
  const n = w.frames;
  const problems = [];

  let peak = 0;
  let sumL = 0;
  let sumR = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    sumL += L[i];
    sumR += R[i];
  }
  const tail0 = n - Math.round(SILENT_TAIL * SR);
  let tailPk = 0;
  for (let i = tail0; i < n; i++) tailPk = Math.max(tailPk, Math.abs(L[i]), Math.abs(R[i]));
  let lastNonZero = n - 1;
  while (lastNonZero >= 0 && L[lastNonZero] === 0 && R[lastNonZero] === 0) lastNonZero--;
  const sha = createHash('sha256').update(w.bytes).digest('hex');

  console.log('\nFile (re-read from disk):');
  console.log(`  path            ${path}`);
  console.log(`  format          PCM ${w.bits}-bit, ${w.channels} ch, ${w.sampleRate} Hz`);
  console.log(`  frames          ${n}  (expected ${N_TOTAL})`);
  console.log(`  duration        ${w.duration.toFixed(6)} s  (target ${DURATION} s, error ${((w.duration - DURATION) * 1000).toFixed(3)} ms)`);
  console.log(`  size            ${w.bytes.length} bytes`);
  console.log(`  peak            ${fmtDb(gainToDb(peak))} dBFS`);
  console.log(`  RMS (whole)     ${fmtDb(gainToDb(rmsOf(buf, [[0, DURATION]])))} dBFS`);
  console.log(`  full-scale smp  ${w.fullScale}`);
  console.log(`  DC offset       L ${((sumL / n) * 100).toFixed(4)} %  R ${((sumR / n) * 100).toFixed(4)} %`);
  console.log(`  last ${SILENT_TAIL} s     ${tailPk === 0 ? 'digital silence (all samples 0)' : 'peak ' + fmtDb(gainToDb(tailPk)) + ' dBFS'}; last non-zero sample at ${(lastNonZero / SR).toFixed(4)} s`);
  console.log(`  sha256          ${sha}`);

  if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16) problems.push('wrong format');
  if (Math.abs(w.duration - DURATION) > 0.001) problems.push(`duration ${w.duration} != ${DURATION}`);
  if (w.fullScale) problems.push(`${w.fullScale} full-scale (clipped) samples`);
  if (gainToDb(peak) > -0.95) problems.push('peak above -1 dBFS');
  if (tailPk !== 0) problems.push(`last ${SILENT_TAIL} s not silent`);

  const bar = (db) => '#'.repeat(Math.max(0, Math.round((db + 40) / 1)));
  console.log('\nRMS per 2 s window (dBFS):');
  console.log('  window (s)      section     RMS    peak');
  for (let a = 0; a < DURATION - 1e-9; a += 2) {
    const b = Math.min(DURATION, a + 2);
    let pk = 0;
    for (let i = Math.round(a * SR); i < Math.min(n, Math.round(b * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    const r = gainToDb(rmsOf(buf, [[a, b]]));
    console.log(`  ${padL(a.toFixed(1), 5)} - ${pad(b.toFixed(2), 6)}  ${pad(sectionAtSec((a + b) / 2), 10)} ${padL(fmtDb(r), 6)} ${padL(fmtDb(gainToDb(pk)), 6)}  ${bar(r)}`);
  }

  console.log('\nRMS per section (dBFS):');
  const rows = [
    ...SECTIONS,
    ['  intimate: story', 33.2, 50.0],
    ['  intimate: build', 50.0, 55.9],
    ['  climax: 55.9-66.5', 55.9, 66.5],
    ['  climax: peak 66.5-69.9', 66.5, 69.9],
    ['  ring-out 69.9-72.24', 69.9, DURATION - SILENT_TAIL],
  ];
  for (const [name, a, b] of rows) {
    let pk = 0;
    for (let i = Math.round(a * SR); i < Math.min(n, Math.round(b * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    console.log(`  ${pad(name, 26)} ${padL(a.toFixed(2), 6)}-${pad(b.toFixed(2), 6)} RMS ${padL(fmtDb(gainToDb(rmsOf(buf, [[a, b]]))), 6)}  peak ${padL(fmtDb(gainToDb(pk)), 6)}`);
  }
  return { problems, sha };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
function main() {
  const t0 = Date.now();
  mkdirSync(dirname(OUT_PATH), { recursive: true });

  console.log(`Grid: ${BPM.toFixed(3)} BPM (beat ${BEAT.toFixed(6)} s, bar ${BAR.toFixed(4)} s), origin ${ORIGIN.toFixed(4)} s, key C major`);
  console.log(`  edit points -> beats: 8.4 s = ${((8.4 - ORIGIN) / BEAT).toFixed(2)}, 33.2 s = ${((33.2 - ORIGIN) / BEAT).toFixed(2)}, 55.9 s = ${((55.9 - ORIGIN) / BEAT).toFixed(2)}, 66.5 s = ${((66.5 - ORIGIN) / BEAT).toFixed(2)} (peak hit at ${tb(B.PEAK).toFixed(3)} s), final hit ${tb(B.END).toFixed(3)} s`);
  console.log(`  chords: ${CHORD_TL.map(([b, c]) => `${tb(b).toFixed(2)}s ${CHORDS[c].name}`).join(' | ')}`);

  const stems = renderMusic();
  const m = mixAndMaster(stems);
  if (m.nonFinite) throw new Error(`${m.nonFinite} non-finite samples in the master`);
  writeWav(OUT_PATH, m.out);
  console.log(`\nMaster: pre-gain ${m.preDb.toFixed(2)} dB, limiter max reduction ${m.maxReductionDb.toFixed(2)} dB, climax RMS ${m.rmsDb.toFixed(2)} dBFS, non-finite samples 0`);
  console.log(`Stem loudness in climax (K-weighted, dB rel. full mix): ${m.stemReport}`);
  console.log(`Stem loudness in intimate story 33.2-50 s (same reference): ${m.storyReport}`);
  console.log(`Piano notes rendered (cached): ${pianoCache.size}`);

  const { problems } = verify(OUT_PATH);
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / clipping / silent-tail checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT_PATH}`);
  if (problems.length) process.exitCode = 1;
}

main();
