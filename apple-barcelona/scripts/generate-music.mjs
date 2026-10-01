#!/usr/bin/env node
// =============================================================================
// scripts/generate-music.mjs
//
// Procedural music bed for the "apple-barcelona" vlog (Spanish voiceover).
// Brief: "un poco más movida pero a la vez que inspire" -> modern uplifting /
// motivational pop with drive, built to sit ~-18 dB under a talking voice.
//
// Every sound is synthesized from math (punchy sine kick, noise claps / snare /
// hats / shakers, additive felt piano, PolyBLEP plucks, pads and string
// ensemble, sine-based bass, FM bells, chord stabs, risers, cymbals, booms,
// freeverb, ping-pong delay). No samples, no downloads, zero npm deps.
// Deterministic: all randomness comes from seeded PRNGs (never Math.random),
// so two runs are byte-identical.
//
//   node scripts/generate-music.mjs
//
// Writes public/music.wav (48 kHz, stereo, 16-bit PCM, exactly 72.44 s) and
// prints a verification report computed by re-reading the file from disk.
//
// Musical design
//   Key D major, 4/4 (with a few 1-, 2- and 3-beat "edit" bars), ~114 BPM.
//   The tempo map is a smooth monotone (PCHIP) curve through anchor points, so
//   every edit point of the video lands EXACTLY on a downbeat while the tempo
//   only drifts gently between ~111.5 and ~120 BPM (average 114.2).
//   Voice-friendly: no lead melody; plucks / piano / stabs / bells are
//   low-passed and dipped at 2.6 kHz, the master has a wide 2.5 kHz pocket.
//
//   0.0- 8.4  intro     Dadd9 Bm7 Gmaj7 Asus4-A : low-passed four-on-the-floor
//                       opening up, 8th -> 16th plucks, riser + snare roll
//   8.4-18.4  groove    D A/C# Bm7 G | Asus4-A : kick, claps, offbeat hats,
//                       16th shaker, pumping bass, tresillo piano, 16th plucks
//  18.4-27.3  lift      G A Bm7 G-Asus4-A : open hats, octave bass, 8th piano,
//                       strings; chord-stab hits 18.4 22.6 24.2 25.0 26.5,
//                       one-beat stop + roll before 27.3
//  27.3-33.2  groove B  D A/C# G : lighter (snaps, 8th plucks, no strings)
//  33.2-38.9  dream     Bm7 Gmaj7 Asus4 : half-time, no 4-on-floor, bells,
//                       high plucks, wide pad; kick/snare build into 38.9
//  38.9-55.9  groove C  D A/C# Bm7 G D | Gmaj7 (break 49.5-51.6) | Em7 Asus4-A
//                       steady build, then riser + roll into 55.9
//  55.9-59.0  tension   Bm7 Asus4 : low-passed half-time bar, stop + riser
//  59.0-61.1  drop      D : full groove
//  61.1-69.9  climax    G Em7 Asus4 | D (66.4 = biggest hit) G A : everything +
//                       strings, tom fill into 66.4, IV-V-I cadence
//  69.9-72.44 ending    D final hit, ring-out, digital silence in the last 0.2 s
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
const FADE = [70.9, DURATION - SILENT_TAIL - 0.01]; // raised-cosine fade, zero from 72.23 s

// Section map of the final edit (seconds)
const SECTIONS = [
  ['intro', 0.0, 8.4],
  ['groove', 8.4, 18.4],
  ['lift', 18.4, 27.3],
  ['groove B', 27.3, 33.2],
  ['dream', 33.2, 38.9],
  ['groove C', 38.9, 55.9],
  ['tension', 55.9, 59.0],
  ['drop', 59.0, 61.1],
  ['climax', 61.1, 69.9],
  ['ending', 69.9, DURATION],
];
const sectionAtSec = (t) => (SECTIONS.find(([, a, b]) => t >= a && t < b) ?? SECTIONS[SECTIONS.length - 1])[0];
const lerp = (a, b, t) => a + (b - a) * t;

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
// Extra voices (pluck / bell / stab adapted from claude-ia/scripts/generate-audio.mjs)
// ----------------------------------------------------------------------------

// Pop snare: pitched shell (190 / 330 Hz) + high-passed noise, lightly saturated.
function snare({ seed = 35, tone = 1 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.32);
  const nz = filt(filt(whiteNoise(n, rng), 'hp', 1200), 'lp', 7500);
  const y = new Float64Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p1 += (TAU * 190 * tone * (1 + 0.3 * Math.exp(-t / 0.01))) / SR;
    p2 += (TAU * 330 * tone) / SR;
    const body = (0.8 * Math.sin(p1) + 0.35 * Math.sin(p2)) * Math.exp(-t / 0.045);
    const noise = nz[i] * (0.55 * Math.exp(-t / 0.02) + 0.45 * Math.exp(-t / 0.11));
    y[i] = Math.min(1, t / 0.0006) * (body + 0.9 * noise);
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], 1.4);
  return normMono(tailFade(y, 0.03));
}

// Plucky synth: two detuned saws + a sine through an enveloped low-pass
// (bright attack, quickly darkening). Cached per (midi, velocity level 1-8).
const pluckCache = new Map();
function pluckNote(midi, level) {
  const key = midi * 16 + level;
  const hit = pluckCache.get(key);
  if (hit) return hit;
  const rng = makeRng(90000 + key * 13);
  const freq = mtof(midi);
  const vel = level / 8;
  const n = samples(0.6);
  const src = new Float64Array(n);
  const o1 = new Osc(rng.next());
  const o2 = new Osc(rng.next());
  const o3 = new Osc(rng.next());
  for (let i = 0; i < n; i++) src[i] = 0.42 * o1.saw(freq) + 0.32 * o2.saw(freq * 1.0047) + 0.4 * o3.sine(freq);
  const y = filt(src, 'lp', (t) => 450 + 0.8 * freq + 2500 * (0.45 + 0.55 * vel) * Math.exp(-t / 0.05), 0.95);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.0015) * (0.7 * Math.exp(-t / 0.12) + 0.3 * Math.exp(-t / 0.38));
  }
  normMono(tailFade(y, 0.05));
  pluckCache.set(key, y);
  return y;
}

// Glassy bell: FM (ratio 4, decaying index) + inharmonic 2.756x partial. Sparkles.
function bell(freq, vel = 1, { len = 1.8, decay = 0.7, seed = 401 } = {}) {
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
    const idx = 0.12 + 0.9 * vel * Math.exp(-t / 0.1);
    const env = Math.min(1, t / 0.0015) * Math.exp(-t / (decay * kt));
    y[i] = (Math.sin(pc + idx * Math.sin(pm)) * env + 0.2 * Math.sin(pg) * Math.min(1, t / 0.0015) * Math.exp(-t / (0.18 * kt))) * vel;
  }
  return tailFade(y, 0.05);
}

// Chord-stab note: detuned saws + sub pulse through a decaying low-pass.
function stabNote(freq, dur, vel = 1, { seed = 501 } = {}) {
  const rng = makeRng(seed);
  const rel = 0.16;
  const n = samples(dur + rel + 0.02);
  const src = new Float64Array(n);
  const o1 = new Osc(rng.next());
  const o2 = new Osc(rng.next());
  const o3 = new Osc(rng.next());
  for (let i = 0; i < n; i++) src[i] = 0.4 * o1.saw(freq * 0.9965) + 0.4 * o2.saw(freq * 1.0035) + 0.15 * o3.pulse(freq * 0.5, 0.5);
  const y = filt(src, 'lp', (t) => 600 + 2600 * (0.6 + 0.4 * vel) * Math.exp(-t / 0.09), 0.8);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env = Math.min(1, t / 0.003) * (0.45 + 0.55 * Math.exp(-t / 0.12));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel) ** 2;
    y[i] *= env * vel;
  }
  return tailFade(y, 0.01);
}

// ----------------------------------------------------------------------------
// Tempo map. [beat, seconds] anchors: every edit point of the video is a
// downbeat (24.2 / 25.0 are accent hits on beat 4 / the "and" of 1). Between
// anchors, time(beat) is a monotone cubic (Fritsch-Butland PCHIP), so the
// tempo is continuous and drifts smoothly instead of jumping.
// ----------------------------------------------------------------------------
const ANCHORS = [
  [0, 0.0], //    intro
  [16, 8.4], //   groove kicks in
  [35, 18.4], //  motion-graphics lift
  [43, 22.6], //  hit
  [46, 24.2], //  hit (beat 4)
  [47.5, 25.0], // hit (and of 1)
  [52, 27.3], //  back to video
  [63, 33.2], //  dreamy interlude
  [74, 38.9], //  groove back
  [106, 55.9], // tension
  [112, 59.0], // drop
  [116, 61.1], // climax
  [126, 66.4], // biggest hit
  [133, 69.9], // final hit
];
const AX = ANCHORS.map((a) => a[0]);
const AY = ANCHORS.map((a) => a[1]);
const AH = AX.slice(1).map((x, k) => x - AX[k]);
const AD = AH.map((h, k) => (AY[k + 1] - AY[k]) / h); // seconds per beat per segment
const AM = AX.map((_, k) => {
  if (k === 0) return AD[0];
  if (k === AX.length - 1) return AD[k - 1];
  const h0 = AH[k - 1];
  const h1 = AH[k];
  const w1 = 2 * h1 + h0;
  const w2 = h1 + 2 * h0;
  return (w1 + w2) / (w1 / AD[k - 1] + w2 / AD[k]);
});
// beat -> seconds
function tb(beat) {
  const K = AX.length - 1;
  if (beat <= AX[0]) return AY[0] + (beat - AX[0]) * AM[0];
  if (beat >= AX[K]) return AY[K] + (beat - AX[K]) * AM[K];
  let k = 0;
  while (beat > AX[k + 1]) k++;
  const h = AH[k];
  const s = (beat - AX[k]) / h;
  const s2 = s * s;
  const s3 = s2 * s;
  return (2 * s3 - 3 * s2 + 1) * AY[k] + (s3 - 2 * s2 + s) * h * AM[k] + (-2 * s3 + 3 * s2) * AY[k + 1] + (s3 - s2) * h * AM[k + 1];
}
const bpmAt = (beat) => 60 / ((tb(beat + 1e-3) - tb(beat - 1e-3)) / 2e-3);
// seconds -> beat (bisection table every 32 samples, linear in between)
const BT_STEP = 32;
const BEAT_TABLE = (() => {
  const m = Math.ceil(N_TOTAL / BT_STEP) + 2;
  const y = new Float64Array(m);
  let lo = -8;
  for (let j = 0; j < m; j++) {
    const t = (j * BT_STEP) / SR;
    let a = lo;
    let b = 200;
    for (let it = 0; it < 48; it++) {
      const mid = 0.5 * (a + b);
      if (tb(mid) < t) a = mid;
      else b = mid;
    }
    y[j] = 0.5 * (a + b);
    lo = y[j] - 0.01;
  }
  return y;
})();
function beatAt(t) {
  const x = (t * SR) / BT_STEP;
  const j = clamp(Math.floor(x), 0, BEAT_TABLE.length - 2);
  return lerp(BEAT_TABLE[j], BEAT_TABLE[j + 1], x - j);
}
const END_BEAT = beatAt(DURATION);
const AVG_BPM = (60 * AX[AX.length - 1]) / AY[AY.length - 1];
const NOM_BEAT = 60 / AVG_BPM; // nominal beat for delay times
const GAP = 0.03; // swells stop just before their downbeat (a breath)

// Bars: [start beat, length in beats, section]
const BARS = [
  [0, 4, 'intro'], [4, 4, 'intro'], [8, 4, 'intro'], [12, 4, 'intro'],
  [16, 4, 'groove'], [20, 4, 'groove'], [24, 4, 'groove'], [28, 4, 'groove'], [32, 3, 'groove'],
  [35, 4, 'lift'], [39, 4, 'lift'], [43, 4, 'lift'], [47, 4, 'lift'], [51, 1, 'lift (stop)'],
  [52, 4, 'groove B'], [56, 4, 'groove B'], [60, 3, 'groove B'],
  [63, 4, 'dream'], [67, 4, 'dream'], [71, 3, 'dream (build)'],
  [74, 4, 'groove C'], [78, 4, 'groove C'], [82, 4, 'groove C'], [86, 4, 'groove C'], [90, 4, 'groove C'],
  [94, 4, 'groove C (break)'], [98, 4, 'groove C (build)'], [102, 4, 'groove C (build)'],
  [106, 4, 'tension (half-time)'], [110, 2, 'tension (stop)'],
  [112, 4, 'drop'],
  [116, 4, 'climax'], [120, 4, 'climax'], [124, 2, 'climax (fill)'], [126, 4, 'climax (PEAK)'], [130, 3, 'climax (cadence)'],
  [133, 5, 'ending'],
];

// Requested hit points -> grid position
const HITS = [
  ['groove in', 8.4, 16], ['lift', 18.4, 35], ['accent', 22.6, 43], ['accent', 24.2, 46], ['accent', 25.0, 47.5],
  ['accent', 26.5, 50.5], ['back to video', 27.3, 52], ['dream', 33.2, 63], ['groove back', 38.9, 74],
  ['break bar', null, 94], ['tension', 55.9, 106], ['drop', 59.0, 112], ['climax', 61.1, 116],
  ['BIGGEST hit', 66.4, 126], ['final hit', 69.9, 133],
];

// ----------------------------------------------------------------------------
// Harmony: D major. bass: bass note; rh: piano chord; arp: 6 pluck tones
// low->high; pad / str: pad and string voicings (MIDI).
// ----------------------------------------------------------------------------
const CH = (name, bass, rh, arp, pad, str) => ({ name, bass, rh, arp, pad, str });
const CHORDS = {
  Dadd9: CH('Dadd9', 38, [62, 64, 69], [57, 62, 64, 66, 69, 74], [50, 57, 62, 64, 66], [50, 57, 64, 66, 69]),
  D: CH('D', 38, [62, 66, 69], [57, 62, 64, 66, 69, 74], [50, 57, 62, 66, 69], [50, 57, 62, 66, 69]),
  'A/C#': CH('A/C#', 37, [61, 64, 69], [57, 61, 64, 69, 71, 73], [45, 52, 57, 61, 64], [49, 57, 61, 64, 69]),
  Bm7: CH('Bm7', 35, [62, 66, 71], [54, 59, 62, 66, 69, 71], [47, 54, 57, 62, 66], [47, 54, 62, 66, 69]),
  G: CH('G', 31, [62, 67, 71], [55, 59, 62, 67, 69, 71], [43, 50, 57, 59, 62], [43, 50, 59, 62, 67]),
  Gmaj7: CH('Gmaj7', 31, [62, 66, 71], [55, 59, 62, 66, 67, 71], [43, 50, 54, 59, 62], [43, 50, 59, 62, 66]),
  Em7: CH('Em7', 40, [62, 67, 71], [55, 59, 62, 64, 67, 71], [40, 47, 55, 59, 62], [40, 47, 59, 62, 67]),
  Asus4: CH('Asus4', 33, [62, 64, 69], [57, 62, 64, 69, 71, 74], [45, 52, 57, 62, 64], [45, 52, 62, 64, 69]),
  A: CH('A', 33, [61, 64, 69], [57, 61, 64, 69, 71, 73], [45, 52, 57, 61, 64], [45, 52, 61, 64, 69]),
};
const CHORD_TL = [
  [0, 'Dadd9'], [4, 'Bm7'], [8, 'Gmaj7'], [12, 'Asus4'], [14, 'A'],
  [16, 'D'], [20, 'A/C#'], [24, 'Bm7'], [28, 'G'], [32, 'Asus4'], [34, 'A'],
  [35, 'G'], [39, 'A'], [43, 'Bm7'], [47, 'G'], [49, 'Asus4'], [50.5, 'A'],
  [52, 'D'], [56, 'A/C#'], [60, 'G'],
  [63, 'Bm7'], [67, 'Gmaj7'], [71, 'Asus4'],
  [74, 'D'], [78, 'A/C#'], [82, 'Bm7'], [86, 'G'], [90, 'D'], [94, 'Gmaj7'], [98, 'Em7'], [102, 'Asus4'], [104, 'A'],
  [106, 'Bm7'], [110, 'Asus4'],
  [112, 'D'],
  [116, 'G'], [120, 'Em7'], [124, 'Asus4'],
  [126, 'D'], [130, 'G'], [132, 'A'],
  [133, 'D'],
];
const chordAt = (beat) => {
  let c = CHORD_TL[0];
  for (const e of CHORD_TL) if (e[0] <= beat + 1e-9) c = e;
  return CHORDS[c[1]];
};
const nextChange = (beat) => {
  for (const [b] of CHORD_TL) if (b > beat + 1e-9) return b;
  return END_BEAT + 1;
};

const ARP16 = [0, 2, 4, 2, 5, 2, 4, 1, 0, 3, 4, 2, 5, 3, 4, 2];
const ACC16 = [1, 0.55, 0.72, 0.58, 0.9, 0.55, 0.75, 0.6, 0.95, 0.55, 0.72, 0.58, 0.88, 0.55, 0.75, 0.62];
const ARP8 = [0, 2, 4, 5, 3, 4, 2, 1];
const ACC8 = [1, 0.7, 0.85, 0.72, 0.92, 0.7, 0.85, 0.75];

// ----------------------------------------------------------------------------
// Music render: returns the dry stems + a drum reverb send
// ----------------------------------------------------------------------------
function renderMusic() {
  const N = N_TOTAL;
  const bus = {
    drums: stereoN(N),
    drumVerb: stereoN(N),
    bass: stereoN(N),
    piano: stereoN(N),
    pluck: stereoN(N),
    bells: stereoN(N),
    strings: stereoN(N),
    pad: stereoN(N),
    stab: stereoN(N),
    fx: stereoN(N),
  };
  const rng = makeRng(2027);
  const hum = () => rng.range(-0.003, 0.003);
  const kickTimes = [];

  // ---- kit
  const KICK = kickSoft({ f0: 160, f1: 50, pitchTau: 0.028, decay: 0.2, len: 0.45, click: 0.3, drive: 1.8, lp: 9000, seed: 11 });
  const KICK_SOFT = kickSoft({ f0: 110, f1: 46, click: 0.05, decay: 0.24, lp: 2400, seed: 12 });
  const SNARES = [snare({ seed: 35 }), snare({ seed: 36, tone: 1.03 })];
  const CLAPS = [clap({ seed: 31 }), clap({ seed: 32, tail: 0.09 })];
  const SNAPS = [snap({ seed: 91 }), snap({ seed: 92, tone: 1.05 })];
  const HATS = [0, 1, 2, 3].map((k) => hat({ seed: 41 + k, tone: 0.97 + 0.012 * k, decay: 0.02 + 0.004 * (k % 3) }));
  const HAT_OPEN = hat({ open: true, seed: 48, decay: 0.15 });
  const SHAKE = [0, 1, 2, 3].map((k) => shaker({ seed: 70 + k, bright: 0.94 + 0.04 * k }));
  const TOMS = [tom(196, { seed: 61 }), tom(165, { seed: 62 }), tom(131, { seed: 63 })];

  const kick = (beat, v = 1, soft = false) => {
    const t = tb(beat);
    addMono(bus.drums, soft ? KICK_SOFT : KICK, t, 0.95 * v);
    kickTimes.push([t, soft ? 0.5 * v : v]);
  };
  const clapAt = (beat, v = 1) => {
    addMono(bus.drums, CLAPS[rng.int(0, 1)], tb(beat) + 0.002 + hum(), 0.5 * v, -0.08);
    addMono(bus.drumVerb, CLAPS[0], tb(beat), 0.45 * v);
  };
  const snareAt = (beat, v = 1, pan = 0.05) => {
    addMono(bus.drums, SNARES[rng.int(0, 1)], tb(beat), 0.42 * v, pan);
    addMono(bus.drumVerb, SNARES[0], tb(beat), 0.3 * v);
  };
  const snapAt = (beat, v = 1) => {
    addMono(bus.drums, SNAPS[rng.int(0, 1)], tb(beat) + hum(), 0.4 * v, 0.18);
    addMono(bus.drumVerb, SNAPS[0], tb(beat), 0.45 * v);
  };
  const hatAt = (beat, v) => addMono(bus.drums, HATS[rng.int(0, 3)], tb(beat) + hum(), 0.15 * v, 0.3);
  const openHatAt = (beat, chokeBeats, v) => {
    const x = Float64Array.from(HAT_OPEN);
    const c = samples(tb(beat + chokeBeats) - tb(beat));
    const fl = samples(0.015);
    for (let i = c; i < x.length; i++) x[i] *= Math.max(0, 1 - (i - c) / fl);
    addMono(bus.drums, x, tb(beat) + hum(), 0.11 * v, 0.28);
  };
  const shakerAt = (beat, v) => addMono(bus.drums, SHAKE[rng.int(0, 3)], tb(beat) + hum() + 0.003, 0.17 * v, -0.35);
  const tomAt = (beat, k, v = 1) => {
    addMono(bus.drums, TOMS[k], tb(beat), 0.5 * v, [0.3, 0, -0.3][k]);
    addMono(bus.drumVerb, TOMS[k], tb(beat), 0.25 * v);
  };
  const roll = (from, to, step, v0, v1, kind = 'snare') => {
    const n = Math.round((to - from) / step);
    for (let k = 0; k < n; k++) {
      const v = v0 + (v1 - v0) * (k / Math.max(1, n - 1));
      if (kind === 'snare') snareAt(from + k * step, v, k % 2 ? 0.12 : -0.04);
      else clapAt(from + k * step, v);
    }
  };

  // One bar of drums. o: { kick: '4' | 'half' | 'one', kv, softKick, back: '24' | '3',
  // cv (clap), snare, snap, hat (offbeat closed), open (offbeat open), hat16, shaker, shaker16 }
  const drumBar = (start, len, o) => {
    for (let q = 0; q < len; q++) {
      const b = start + q;
      if (o.kick === '4') kick(b, (q === 0 ? 1 : 0.92) * o.kv);
      if (o.kick === 'half' && q % 2 === 0) kick(b, (q === 0 ? 1 : 0.8) * o.kv, !!o.softKick);
      if (o.kick === 'one' && q === 0) kick(b, o.kv, !!o.softKick);
      const backbeat = (o.back === '24' && q % 2 === 1) || (o.back === '3' && q === 2);
      if (backbeat) {
        if (o.cv) clapAt(b, o.cv);
        if (o.snare) snareAt(b, o.snare);
        if (o.snap) snapAt(b, o.snap);
      }
      if (o.open) openHatAt(b + 0.5, 0.42, o.open);
      else if (o.hat) hatAt(b + 0.5, o.hat);
      if (o.hat16) {
        hatAt(b + 0.25, o.hat16 * 0.8);
        hatAt(b + 0.75, o.hat16);
      }
      if (o.shaker) {
        const steps = o.shaker16 ? [0, 0.25, 0.5, 0.75] : [0, 0.5];
        for (const s of steps) shakerAt(b + s, o.shaker * (s === 0.5 ? 1 : s === 0 ? 0.75 : 0.55));
      }
    }
  };

  // ---- bass
  const bassVoice = (midi, beat, durBeats, vel, opts = {}) => {
    const dur = Math.max(0.05, tb(beat + durBeats) - tb(beat) - 0.015);
    addMono(bus.bass, bassNote(midi, dur, vel, opts), tb(beat), 0.55);
  };
  // mode: 'pump' (8ths), 'oct' (8ths, offbeats an octave up), 'off' (offbeats only), 'long'
  const bassBar = (start, len, mode, v) => {
    if (mode === 'long') {
      for (let b = start; b < start + len - 1e-9; ) {
        const e = Math.min(nextChange(b), start + len);
        bassVoice(chordAt(b).bass, b, e - b, 0.75 * v, { release: 0.25 });
        b = e;
      }
      return;
    }
    for (let e = 0; e < len * 2; e++) {
      const beat = start + e * 0.5;
      const ch = chordAt(beat);
      const off = e % 2 === 1;
      if (mode === 'off' && !off) continue;
      bassVoice(mode === 'oct' && off ? ch.bass + 12 : ch.bass, beat, 0.42, (off ? 1 : 0.85) * v);
    }
  };

  // ---- piano (felt piano played brighter / harder)
  const pianoHit = (midi, beat, durBeats, vel, pan = null) =>
    addPiano(bus.piano, midi, tb(beat) + rng.range(-0.004, 0.004), tb(beat + durBeats) - tb(beat), clamp(vel + rng.range(-0.03, 0.03), 0.1, 1), { pan, rel: 0.12 });
  const PIANO_PAT = {
    tres: [[0, 1.4, 0.66], [1.5, 1.4, 0.56], [3, 0.9, 0.6]],
    pop: [[0, 0.45, 0.74], [0.5, 0.4, 0.46], [1, 0.4, 0.52], [1.5, 0.45, 0.64], [2, 0.4, 0.55], [2.5, 0.4, 0.62], [3, 0.4, 0.5], [3.5, 0.45, 0.62]],
  };
  const pianoBar = (start, len, pat, vAdd = 0) => {
    // left hand / held chords at every chord change inside the bar
    for (let b = start; b < start + len - 1e-9; ) {
      const e = Math.min(nextChange(b), start + len);
      const ch = chordAt(b);
      if (pat === 'hold') for (const m of ch.rh) pianoHit(m, b, e - b + 0.1, 0.5 + vAdd);
      pianoHit(ch.bass + 12, b, e - b + 0.05, 0.5 + vAdd);
      b = e;
    }
    if (pat === 'hold') return;
    for (const [s, d, v] of PIANO_PAT[pat]) {
      if (s >= len) continue;
      const beat = start + s;
      const dur = Math.max(0.2, Math.min(d, nextChange(beat) - beat - 0.05, start + len - beat));
      for (const m of chordAt(beat).rh) pianoHit(m, beat, dur, v + vAdd);
    }
  };

  // ---- plucks
  const pluckAt = (midi, beat, vel, pan) => {
    const lvl = clamp(Math.round(vel * 8), 1, 8);
    addMono(bus.pluck, pluckNote(midi, lvl), tb(beat) + rng.range(-0.002, 0.002), Math.pow(vel, 1.2), pan);
  };
  const pluckBar = (start, len, mode, v, oct = 0) => {
    const step = mode === '16' ? 0.25 : 0.5;
    const pat = mode === '16' ? ARP16 : ARP8;
    const acc = mode === '16' ? ACC16 : ACC8;
    for (let e = 0; e < Math.round(len / step); e++) {
      const beat = start + e * step;
      const k = e % pat.length;
      pluckAt(chordAt(beat).arp[pat[k]] + oct, beat, v * acc[k], k % 2 ? 0.28 : -0.22);
    }
  };

  // ---- bells, stabs, hits
  const bellAt = (midi, beat, vel) => addMono(bus.bells, bell(mtof(midi), vel, { seed: 400 + midi }), tb(beat), 1, rng.range(-0.5, 0.5));
  const stabAt = (beat, v = 1, lenBeats = 0.5) => {
    const ch = chordAt(beat);
    const dur = tb(beat + lenBeats) - tb(beat);
    const notes = [ch.bass + 24, ...ch.rh, ch.rh[0] + 12];
    notes.forEach((m, k) => addMono(bus.stab, stabNote(mtof(m), dur, 1, { seed: 500 + m }), tb(beat), 0.2 * v, k % 2 ? 0.3 : -0.3));
  };
  const before = (beat, dur) => tb(beat) - GAP - dur;
  let crashSeed = 51;
  const hit = (beat, { crashG = 0, boomG = 0, decay = 1.3, bright = 1, boom = {} } = {}) => {
    if (crashG) addStereo(bus.fx, crash({ seed: crashSeed++, decay, len: decay * 2.6, bright }), tb(beat), crashG);
    if (boomG) addStereo(bus.fx, softBoom({ seed: 80 + crashSeed, ...boom }), tb(beat), boomG);
  };
  const riserTo = (beat, dur, gain, opts = {}) => addStereo(bus.fx, riser({ dur, ...opts }), before(beat, dur), gain);
  const revTo = (beat, dur, gain, seed) => addStereo(bus.fx, reverseCymbal(dur, seed), before(beat, dur), gain);

  // =====================================================================
  // INTRO 0.0-8.4 (beats 0-16): low-passed beat + plucks, building fast
  // =====================================================================
  for (let bar = 0; bar < 4; bar++) {
    const s = bar * 4;
    drumBar(s, bar === 3 ? 2 : 4, {
      kick: '4',
      kv: 0.72 + 0.08 * bar,
      back: bar >= 1 ? '24' : null,
      cv: bar >= 2 ? 0.55 + 0.1 * (bar - 2) : 0,
      snap: bar >= 1 ? 0.5 : 0,
      hat: bar >= 1 ? 0.45 + 0.05 * bar : 0,
      shaker: bar >= 2 ? 0.35 + 0.1 * (bar - 2) : 0,
      shaker16: bar >= 3,
    });
    pluckBar(s, 4, bar < 2 ? '8' : '16', 0.5 + 0.05 * bar);
    if (bar >= 2) bassBar(s, 4, 'off', 0.6 + 0.12 * (bar - 2));
  }
  kick(14, 0.9);
  kick(15, 0.95);
  roll(14, 15, 0.5, 0.3, 0.45);
  roll(15, 16, 0.25, 0.5, 0.85);
  riserTo(16, tb(16) - tb(8) - GAP, 0.09, { fStart: 350, fEnd: 7000, toneFrom: 293.7, toneTo: 1174.7, toneAmt: 0.1, seed: 71 });
  revTo(16, 1.5, 0.11, 58);

  // =====================================================================
  // GROOVE 8.4-18.4 (beats 16-35)
  // =====================================================================
  hit(16, { crashG: 0.1, boomG: 0.22, boom: { decay: 0.4 } });
  for (const s of [16, 20, 24, 28]) {
    drumBar(s, 4, { kick: '4', kv: 0.95, back: '24', cv: 0.8, snare: 0.45, hat: 0.6, shaker: 0.5, shaker16: true });
    bassBar(s, 4, 'pump', 0.9);
    pianoBar(s, 4, 'tres');
    pluckBar(s, 4, '16', 0.55);
  }
  // bar 32 (3/4): fill into the lift
  drumBar(32, 3, { kick: '4', kv: 0.9, hat: 0.55, shaker: 0.5, shaker16: true });
  roll(33, 34, 0.5, 0.45, 0.6, 'clap');
  roll(34, 35, 0.25, 0.5, 0.9);
  tomAt(34.5, 0, 0.5);
  tomAt(34.75, 1, 0.65);
  bassBar(32, 3, 'pump', 0.9);
  pianoBar(32, 3, 'tres');
  pluckBar(32, 3, '16', 0.58);
  riserTo(35, 1.5, 0.07, { fStart: 500, fEnd: 8000, toneAmt: 0.08, seed: 72 });
  revTo(35, 1.2, 0.12, 59);

  // =====================================================================
  // LIFT 18.4-27.3 (beats 35-52): motion-graphics, fuller groove + hits
  // =====================================================================
  for (const s of [35, 39, 43, 47]) {
    drumBar(s, 4, { kick: '4', kv: 0.95, back: '24', cv: 0.85, snare: 0.5, open: 0.62, hat16: 0.3, shaker: 0.5, shaker16: true });
    bassBar(s, 4, 'oct', 0.9);
    pianoBar(s, 4, 'pop', 0.02);
    pluckBar(s, 4, '16', 0.6);
  }
  hit(35, { crashG: 0.14, boomG: 0.3 });
  hit(43, { crashG: 0.15, boomG: 0.36 });
  hit(46, { boomG: 0.14, boom: { decay: 0.3, len: 1 } });
  hit(47.5, { boomG: 0.16, boom: { decay: 0.3, len: 1 } });
  hit(50.5, { crashG: 0.08, boomG: 0.18, decay: 0.8 });
  for (const [b, v] of [[35, 1], [43, 1.1], [46, 0.8], [47.5, 0.85], [50.5, 0.95]]) stabAt(b, v);
  snareAt(46, 0.7);
  tomAt(46.5, 1, 0.5);
  kick(47.5, 0.75);
  // beat 51: one-beat stop (no kick), roll into 27.3
  for (const m of chordAt(50.5).rh) pianoHit(m, 50.5, 1.5, 0.66);
  pluckBar(51, 1, '16', 0.5);
  roll(51, 52, 0.25, 0.3, 0.7);
  revTo(52, 0.7, 0.1, 60);

  // =====================================================================
  // GROOVE B 27.3-33.2 (beats 52-63): back to video, a bit lighter
  // =====================================================================
  hit(52, { crashG: 0.08, boomG: 0.14 });
  for (const s of [52, 56]) {
    drumBar(s, 4, { kick: '4', kv: 0.85, back: '24', cv: 0.6, snap: 0.6, hat: 0.5, shaker: 0.45 });
    bassBar(s, 4, 'pump', 0.8);
    pianoBar(s, 4, 'tres', -0.06);
    pluckBar(s, 4, '8', 0.52);
  }
  drumBar(60, 3, { kick: 'one', kv: 0.8, back: '24', cv: 0.5, snap: 0.5, hat: 0.4, shaker: 0.4 });
  bassBar(60, 3, 'long', 0.8);
  pianoBar(60, 3, 'tres', -0.08);
  pluckBar(60, 3, '8', 0.48);
  revTo(63, 1.4, 0.12, 61);

  // =====================================================================
  // DREAM 33.2-38.9 (beats 63-74): half-time, sparkly
  // =====================================================================
  hit(63, { crashG: 0.08, boomG: 0.16, decay: 2.2, bright: 0.9, boom: { decay: 0.6, len: 1.8 } });
  for (const s of [63, 67]) {
    drumBar(s, 4, { kick: 'one', kv: 0.55, softKick: true, back: '3', cv: 0.25, snap: 0.55, shaker: 0.3 });
    bassBar(s, 4, 'long', 0.6);
    pianoBar(s, 4, 'hold', -0.12);
    pluckBar(s, 4, '8', 0.4, 12);
  }
  const SPARK = [[0, 5, 0.55], [1.5, 3, 0.4], [2.5, 4, 0.45], [3, 2, 0.35], [3.5, 5, 0.3]];
  for (const [s, len] of [[63, 4], [67, 4], [71, 3]]) {
    for (const [o, k, v] of SPARK) if (o < len) bellAt(chordAt(s + o).arp[k] + 12, s + o, v);
  }
  // bar 71 (3/4): build back into the groove
  kick(71, 0.5, true);
  kick(72, 0.6);
  kick(73, 0.7);
  kick(73.5, 0.75);
  for (let e = 0; e < 12; e++) shakerAt(71 + e * 0.25, 0.25 + 0.35 * (e / 11));
  roll(72, 73, 0.5, 0.3, 0.45);
  roll(73, 74, 0.25, 0.45, 0.85);
  bassBar(71, 3, 'long', 0.65);
  pianoBar(71, 3, 'hold', -0.08);
  pluckBar(71, 3, '16', 0.45, 12);
  riserTo(74, tb(74) - tb(69), 0.08, { fStart: 400, fEnd: 7500, toneFrom: 220, toneTo: 880, toneAmt: 0.1, seed: 73 });
  revTo(74, 1.3, 0.12, 62);

  // =====================================================================
  // GROOVE C 38.9-55.9 (beats 74-106): steady build, break, riser
  // =====================================================================
  hit(74, { crashG: 0.12, boomG: 0.26 });
  [74, 78, 82, 86, 90].forEach((s, i) => {
    drumBar(s, 4, {
      kick: '4',
      kv: 0.93 + 0.015 * i,
      back: '24',
      cv: 0.75 + 0.04 * i,
      snare: i >= 4 ? 0.5 : i >= 2 ? 0.35 : 0,
      snap: i < 2 ? 0.4 : 0,
      open: i >= 2 ? 0.55 + 0.05 * (i - 2) : 0,
      hat: 0.58,
      hat16: i >= 3 ? 0.28 : 0,
      shaker: 0.5,
      shaker16: true,
    });
    bassBar(s, 4, i >= 4 ? 'oct' : 'pump', 0.88 + 0.03 * i);
    pianoBar(s, 4, i >= 2 ? 'pop' : 'tres', -0.04 + 0.02 * i);
    pluckBar(s, 4, '16', 0.52 + 0.02 * i);
  });
  hit(90, { crashG: 0.06 });
  // break bar 94 (49.5-51.65 s)
  revTo(94, 1.0, 0.08, 63);
  hit(94, { boomG: 0.15, boom: { decay: 0.6, len: 1.8 } });
  kick(94, 0.7);
  drumBar(94, 4, { shaker: 0.3 });
  bassBar(94, 4, 'long', 0.6);
  pianoBar(94, 4, 'hold', -0.04);
  pluckBar(94, 4, '8', 0.45);
  // build 98-106 (51.65-55.9 s)
  drumBar(98, 4, { kick: '4', kv: 0.8, hat: 0.45, shaker: 0.4, shaker16: true });
  drumBar(102, 4, { kick: '4', kv: 0.9, hat: 0.55, shaker: 0.5, shaker16: true });
  roll(100, 102, 1, 0.4, 0.5, 'clap');
  roll(102, 104, 0.5, 0.45, 0.6, 'clap');
  roll(104, 105, 0.25, 0.4, 0.6);
  roll(105, 106, 0.125, 0.55, 0.95);
  tomAt(105.5, 0, 0.6);
  tomAt(105.75, 2, 0.8);
  bassBar(98, 4, 'off', 0.8);
  bassBar(102, 4, 'pump', 0.9);
  pianoBar(98, 4, 'tres', -0.04);
  pianoBar(102, 4, 'pop', 0);
  pluckBar(98, 4, '16', 0.52);
  pluckBar(102, 4, '16', 0.58);
  riserTo(106, tb(106) - tb(98) - GAP, 0.14, { fStart: 300, fEnd: 7500, toneFrom: 196, toneTo: 784, toneAmt: 0.14, curve: 2.4, seed: 74 });
  revTo(106, 2.0, 0.16, 64);

  // =====================================================================
  // TENSION 55.9-59.0 (beats 106-112): low-passed half-time, stop, drop
  // =====================================================================
  hit(106, { crashG: 0.13, boomG: 0.34, decay: 1.8 });
  drumBar(106, 4, { kick: 'half', kv: 0.9, back: '3', cv: 0.7, snare: 0.5, hat: 0.35 });
  bassBar(106, 4, 'long', 0.85);
  pianoBar(106, 4, 'hold', -0.06);
  pluckBar(106, 4, '8', 0.5);
  bassBar(110, 2, 'long', 0.6);
  pianoBar(110, 2, 'hold', -0.06);
  pluckBar(110, 2, '16', 0.52);
  roll(110, 111, 0.5, 0.35, 0.5);
  roll(111, 112, 0.25, 0.5, 0.95);
  riserTo(112, tb(112) - tb(107) - GAP, 0.13, { fStart: 400, fEnd: 9000, toneFrom: 293.7, toneTo: 1174.7, toneAmt: 0.12, curve: 2.6, seed: 75 });
  revTo(112, 1.6, 0.18, 65);

  // =====================================================================
  // DROP 59.0-61.1 (beats 112-116)
  // =====================================================================
  hit(112, { crashG: 0.17, boomG: 0.4 });
  stabAt(112, 1);
  drumBar(112, 4, { kick: '4', kv: 0.97, back: '24', cv: 0.9, snare: 0.55, open: 0.62, hat16: 0.3, shaker: 0.5, shaker16: true });
  bassBar(112, 4, 'oct', 0.95);
  pianoBar(112, 4, 'pop', 0.04);
  pluckBar(112, 4, '16', 0.62);

  // =====================================================================
  // CLIMAX 61.1-69.9 (beats 116-133): biggest; 66.4 = beat 126 peak
  // =====================================================================
  hit(116, { crashG: 0.17, boomG: 0.36 });
  stabAt(116, 1);
  for (const s of [116, 120]) {
    drumBar(s, 4, { kick: '4', kv: 1, back: '24', cv: 1, snare: 0.65, open: 0.75, hat16: 0.4, shaker: 0.6, shaker16: true });
    bassBar(s, 4, 'oct', 1);
    pianoBar(s, 4, 'pop', 0.06);
    pluckBar(s, 4, '16', 0.62);
  }
  // 124 (2/4): tom fill into the peak
  kick(124, 1);
  kick(125, 0.9);
  clapAt(125, 0.9);
  snareAt(125, 0.6);
  for (const [b, k, v] of [[125, 0, 0.6], [125.25, 0, 0.7], [125.5, 1, 0.8], [125.75, 2, 0.95]]) tomAt(b, k, v);
  for (let e = 0; e < 8; e++) shakerAt(124 + e * 0.25, 0.6);
  bassBar(124, 2, 'oct', 1);
  pianoBar(124, 2, 'pop', 0.06);
  pluckBar(124, 2, '16', 0.64);
  riserTo(126, 1.1, 0.09, { fStart: 600, fEnd: 9000, toneAmt: 0.08, seed: 76 });
  revTo(126, 1.1, 0.2, 66);
  // 126 PEAK (66.4 s)
  hit(126, { crashG: 0.26, boomG: 0.6, decay: 1.8, boom: { f0: 60, decay: 0.55, len: 1.8 } });
  hit(126, { crashG: 0.1, decay: 2.4, bright: 0.85 });
  stabAt(126, 1.3, 1);
  for (const m of [74, 78, 81]) pianoHit(m, 126, 1.5, 0.8);
  drumBar(126, 4, { kick: '4', kv: 1.05, back: '24', cv: 1.1, snare: 0.75, open: 0.85, hat16: 0.45, shaker: 0.65, shaker16: true });
  bassBar(126, 4, 'oct', 1.05);
  pianoBar(126, 4, 'pop', 0.1);
  pluckBar(126, 4, '16', 0.66);
  // 130 (3/4): G - A cadence into the final hit
  drumBar(130, 3, { kick: '4', kv: 1.02, back: '24', cv: 1.05, snare: 0.7, open: 0.8, hat16: 0.42, shaker: 0.62, shaker16: true });
  roll(132, 133, 0.25, 0.55, 1);
  bassBar(130, 3, 'oct', 1.05);
  pianoBar(130, 3, 'pop', 0.08);
  pluckBar(130, 3, '16', 0.64);
  revTo(133, 1.2, 0.11, 67);

  // =====================================================================
  // ENDING 69.9-72.44 (beat 133): final tonic hit + ring-out
  // =====================================================================
  hit(133, { crashG: 0.11, boomG: 0.28, decay: 1.5, boom: { decay: 0.6, len: 2 } });
  stabAt(133, 0.8, 1.5);
  kick(133, 0.85);
  for (const m of [50, 57, 62, 66, 69, 74]) pianoHit(m, 133, END_BEAT - 133, 0.72);
  bassVoice(38, 133, END_BEAT - 133 - 0.5, 0.9, { release: 0.6 });
  [[133.5, 66, 0.5], [134, 69, 0.45], [134.5, 74, 0.4], [135, 78, 0.34]].forEach(([b, m, v]) => pluckAt(m, b, v, 0));

  // =====================================================================
  // PAD (whole song) and STRINGS (lift, dream, late groove C, tension, climax)
  // =====================================================================
  const strOn = (s) => s >= 35 && !(s >= 52 && s < 63) && !(s >= 74 && s < 86);
  CHORD_TL.forEach(([s, name], idx) => {
    const ch = CHORDS[name];
    const last = idx === CHORD_TL.length - 1;
    const t0 = tb(s);
    const dur = last ? DURATION - t0 : tb(CHORD_TL[idx + 1][0]) - t0 + 0.05;
    ch.pad.forEach((m, k) => {
      const x = padVoice(mtof(m), dur, { attack: s === 0 ? 1.6 : 0.35, release: last ? 0.6 : 0.8, seed: 3000 + idx * 10 + k });
      addStereo(bus.pad, x, t0, 0.1);
    });
    if (!strOn(s)) return;
    const notes = [...ch.str];
    if (s >= 112) notes.unshift(ch.str[0] - 12);
    if (s >= 126) notes.push(ch.str[ch.str.length - 1] + 12);
    notes.forEach((m, k) => {
      const x = stringVoice(mtof(m), dur, { attack: s >= 112 ? 0.25 : 0.5, release: last ? 0.8 : 0.9, seed: 5000 + idx * 10 + k });
      addStereo(bus.strings, x, t0, k === 0 ? 0.1 : 0.085);
    });
  });

  // =====================================================================
  // Bus processing
  // =====================================================================
  // Sidechain pump from every kick
  const duck = new Float64Array(N);
  for (const [tk, v] of kickTimes) {
    const s0 = Math.round(tk * SR);
    const m = Math.min(N - s0, samples(0.4));
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      duck[s0 + i] = Math.max(duck[s0 + i], v * Math.min(1, t / 0.004) * Math.exp(-t / 0.12));
    }
  }
  const duckBy = (buf, amt) => {
    for (let i = 0; i < N; i++) {
      const g = 1 - amt * Math.min(1, duck[i]);
      buf.L[i] *= g;
      buf.R[i] *= g;
    }
  };
  duckBy(bus.bass, 0.5);
  duckBy(bus.pad, 0.38);
  duckBy(bus.pluck, 0.25);
  duckBy(bus.strings, 0.15);
  duckBy(bus.piano, 0.1);

  // Beat filter (drums + bass): low-passed intro opening up, low-passed tension bar
  const beatFcFn = (t) => {
    const b = beatAt(t);
    if (b < 16) return expInterp(260, 2800, Math.pow(Math.max(0, b) / 16, 1.15));
    if (b >= 106 && b < 110) return 750;
    if (b >= 110 && b < 112) return expInterp(750, 20000, Math.pow((b - 110) / 2, 2.2));
    return 20000;
  };
  const beatFc = fromArray(automation(N, beatFcFn, 0.012, true));
  filtStereo(bus.drums, 'lp', beatFc, 0.8);
  filtStereo(bus.bass, 'lp', beatFc, 0.75);
  filtStereo(bus.bass, 'hp', 30, 0.7);
  filtStereo(bus.bass, 'lp', 900, 0.7);

  // Pad: airy, low-passed, level per section
  const padLevelFn = (t) => {
    const b = beatAt(t);
    if (b < 16) return 0.35 + 0.45 * smoothstep(b / 12);
    if (b < 35) return 0.7;
    if (b < 52) return 0.8;
    if (b < 63) return 0.62;
    if (b < 74) return 1.0;
    if (b < 94) return 0.68;
    if (b < 98) return 1.0;
    if (b < 106) return 0.75;
    if (b < 112) return 0.95;
    return 0.95;
  };
  const padFcFn = (t) => {
    const b = beatAt(t);
    if (b < 16) return expInterp(700, 2200, b / 16);
    if (b < 35) return 2400;
    if (b < 52) return 3000;
    if (b < 63) return 2300;
    if (b < 74) return 3200;
    if (b < 94) return 2400;
    if (b < 98) return 3000;
    if (b < 106) return expInterp(2400, 3200, (b - 98) / 8);
    if (b < 112) return expInterp(1200, 3600, (b - 106) / 6);
    if (b < 133) return 3800;
    return expInterp(3800, 1200, (b - 133) / 5);
  };
  let pad = chorus(bus.pad, { mix: 0.35 });
  pad = filtStereo(pad, 'lp', fromArray(automation(N, padFcFn, 0.1, true)), 0.75);
  filtStereo(pad, 'hp', 150, 0.7);
  applyGain(pad, automation(N, padLevelFn, 0.12));

  // Air: very quiet pink-noise shimmer above the voice band
  const air = stereoN(N);
  ['L', 'R'].forEach((c, ci) => {
    air[c] = filt(filt(pinkNoise(N, makeRng(880 + ci)), 'bp', 7500, 0.6), 'hp', 5000, 0.7);
  });
  const airLevelFn = (t) => {
    const b = beatAt(t);
    if (b < 16) return 0.3 + 0.3 * (b / 16);
    if (b < 35) return 0.5;
    if (b < 52) return 0.8;
    if (b < 63) return 0.5;
    if (b < 74) return 0.9;
    if (b < 106) return 0.6;
    if (b < 112) return 0.8;
    return 1;
  };
  applyGain(air, automation(N, airLevelFn, 0.3));

  // Strings: 24 dB/oct low-pass automation, level per section
  const strLevelFn = (t) => {
    const b = beatAt(t);
    if (b < 35) return 0;
    if (b < 52) return 0.36;
    if (b < 63) return 0;
    if (b < 74) return 0.3;
    if (b < 86) return 0;
    if (b < 94) return 0.35;
    if (b < 98) return 0.5;
    if (b < 106) return 0.4 + 0.15 * smoothstep((b - 98) / 8);
    if (b < 112) return 0.5 + 0.35 * smoothstep((b - 106) / 6);
    if (b < 116) return 0.8;
    if (b < 126) return 1.0;
    return 1.15;
  };
  const strFcFn = (t) => {
    const b = beatAt(t);
    if (b < 63) return 2200;
    if (b < 74) return 2000;
    if (b < 106) return expInterp(2200, 2800, (b - 86) / 20);
    if (b < 112) return expInterp(1500, 3500, (b - 106) / 6);
    if (b < 126) return 3800;
    if (b < 133) return 4200;
    return expInterp(4200, 1500, (b - 133) / 5);
  };
  const strFc = fromArray(automation(N, strFcFn, 0.1, true));
  filtStereo(bus.strings, 'lp', strFc, 0.6);
  filtStereo(bus.strings, 'lp', strFc, 0.6);
  filtStereo(bus.strings, 'hp', 90, 0.7);
  const strings = chorus(bus.strings, { mix: 0.25, rate: 0.27, depth: 0.003 });
  applyGain(strings, automation(N, strLevelFn, 0.08));

  // Piano: bright-ish but with a voice-pocket dip
  filtStereo(bus.piano, 'hp', 80, 0.7);
  filtStereo(bus.piano, 'lp', 5000, 0.7);
  eqStereo(bus.piano, peakEq, 2600, -4, 0.9);

  // Plucks: filter automation, voice-pocket dip, dotted-8th ping-pong
  const pluckFcFn = (t) => {
    const b = beatAt(t);
    if (b < 16) return expInterp(700, 3200, b / 16);
    if (b >= 63 && b < 74) return 2100;
    if (b >= 94 && b < 98) return 1100;
    if (b >= 98 && b < 106) return expInterp(1100, 3400, (b - 98) / 8);
    if (b >= 106 && b < 110) return 900;
    if (b >= 110 && b < 112) return expInterp(900, 3400, (b - 110) / 2);
    return 3400;
  };
  filtStereo(bus.pluck, 'lp', fromArray(automation(N, pluckFcFn, 0.03, true)), 0.8);
  filtStereo(bus.pluck, 'hp', 200, 0.7);
  eqStereo(bus.pluck, peakEq, 2600, -4, 0.9);
  const pluckEcho = pingPong(bus.pluck, { time: 0.75 * NOM_BEAT, feedback: 0.35, lp: 3000, hp: 400 });
  const pluck = stereoN(N);
  addStereo(pluck, bus.pluck, 0, 1);
  addStereo(pluck, pluckEcho, 0, 0.3);

  // Bells: sparkle above the voice core, long echo
  filtStereo(bus.bells, 'hp', 400, 0.7);
  filtStereo(bus.bells, 'lp', 7000, 0.7);
  eqStereo(bus.bells, peakEq, 2600, -5, 0.9);
  const bellEcho = pingPong(bus.bells, { time: 0.75 * NOM_BEAT, feedback: 0.45, lp: 5000, hp: 600 });
  const bells = stereoN(N);
  addStereo(bells, bus.bells, 0, 1);
  addStereo(bells, bellEcho, 0, 0.4);

  // Stabs
  filtStereo(bus.stab, 'hp', 120, 0.7);
  filtStereo(bus.stab, 'lp', 5000, 0.7);
  eqStereo(bus.stab, peakEq, 2600, -4, 0.9);

  return { drums: bus.drums, bass: bus.bass, piano: bus.piano, pluck, bells, strings, pad, air, stab: bus.stab, fx: bus.fx, drumVerb: bus.drumVerb };
}

// ----------------------------------------------------------------------------
// Mix + master
// ----------------------------------------------------------------------------
const CLIMAX_RANGE = [[61.1, 69.9]];
const DREAM_RANGE = [[33.2, 38.9]];
// Stem balance: each stem is scaled so its K-weighted RMS over a reference
// range hits the target (dB). stab / fx / drumVerb follow the drums' gain.
const STEM_TARGETS = {
  drums: [CLIMAX_RANGE, -15.5],
  bass: [CLIMAX_RANGE, -17.5],
  piano: [CLIMAX_RANGE, -21],
  pluck: [CLIMAX_RANGE, -21.5],
  strings: [CLIMAX_RANGE, -19.5],
  pad: [CLIMAX_RANGE, -23],
  air: [CLIMAX_RANGE, -38],
  bells: [DREAM_RANGE, -26],
  verb: [CLIMAX_RANGE, -22],
};
const TARGET_RMS_DB = -13.0; // climax RMS (dBFS) after the master chain
const CEILING_DB = -1.0;
const STEM_ORDER = ['drums', 'bass', 'piano', 'pluck', 'bells', 'strings', 'pad', 'air', 'stab', 'fx', 'verb'];

function mixAndMaster(stems) {
  const N = stems.drums.L.length;
  const gains = {};
  for (const k of ['drums', 'bass', 'piano', 'pluck', 'bells', 'strings', 'pad', 'air']) {
    const [range, target] = STEM_TARGETS[k];
    const r = gainToDb(rmsOf(kWeight(stems[k]), range));
    gains[k] = dbToGain(target - r);
    scaleBuf(stems[k], gains[k]);
  }
  scaleBuf(stems.stab, gains.drums);
  scaleBuf(stems.fx, gains.drums);
  scaleBuf(stems.drumVerb, gains.drums);

  // Reverb glue: one shared hall fed by the melodic stems, claps / snares and fx.
  const send = stereoN(N);
  addStereo(send, stems.pad, 0, 0.2);
  addStereo(send, stems.strings, 0, 0.25);
  addStereo(send, stems.piano, 0, 0.22);
  addStereo(send, stems.pluck, 0, 0.22);
  addStereo(send, stems.bells, 0, 0.45);
  addStereo(send, stems.stab, 0, 0.25);
  addStereo(send, stems.drumVerb, 0, 0.35);
  addStereo(send, stems.fx, 0, 0.15);
  const verb = freeverb(send, { room: 0.84, damp: 0.35 });
  filtStereo(verb, 'hp', 300, 0.7);
  filtStereo(verb, 'lp', 7000, 0.7);
  const rv = gainToDb(rmsOf(kWeight(verb), STEM_TARGETS.verb[0]));
  scaleBuf(verb, dbToGain(STEM_TARGETS.verb[1] - rv));
  stems.verb = verb;

  const mix = stereoN(N);
  for (const k of STEM_ORDER) addStereo(mix, stems[k], 0, 1);

  // Master: 25 Hz HP, low-end weight, wide dip in the voice presence band,
  // a touch of air, then soft clip -> limiter -> end fade -> peak normalise.
  filtStereo(mix, 'hp', 25, 0.7);
  eqStereo(mix, lowShelf, 120, 1.0);
  eqStereo(mix, peakEq, 2500, -2.5, 0.7);
  eqStereo(mix, highShelf, 10000, 1.0);

  let pre = 1;
  let result = null;
  for (let iter = 0; iter < 8; iter++) {
    const out = stereoN(N);
    for (let i = 0; i < N; i++) {
      out.L[i] = softClip(mix.L[i] * pre, 0.7);
      out.R[i] = softClip(mix.R[i] * pre, 0.7);
    }
    const { maxReductionDb } = limiter(out, { ceilingDb: CEILING_DB - 0.05, releaseSec: 0.12 });
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
  result.stemReport = STEM_ORDER.map((k) => `${k} ${gainToDb(rmsOf(kWeight(stems[k]), CLIMAX_RANGE) / mixK).toFixed(1)}`).join(', ');
  return result;
}

// ----------------------------------------------------------------------------
// Verification (operates on the file re-read from disk)
// ----------------------------------------------------------------------------
const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(1) : '-inf');
const padR = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

function peakIn(L, R, a, b) {
  let pk = 0;
  let at = a;
  for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(L.length, Math.round(b * SR)); i++) {
    const v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (v > pk) {
      pk = v;
      at = i / SR;
    }
  }
  return [pk, at];
}

function verify(path) {
  const w = readWav(path);
  const [L, R] = w.ch;
  const buf = { L, R };
  const n = w.frames;
  const problems = [];

  let nonFinite = 0;
  let sumL = 0;
  let sumR = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) nonFinite++;
    sumL += L[i];
    sumR += R[i];
  }
  const [peak, peakAt] = peakIn(L, R, 0, DURATION);
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
  console.log(`  peak            ${fmtDb(gainToDb(peak))} dBFS at ${peakAt.toFixed(3)} s`);
  console.log(`  RMS (whole)     ${fmtDb(gainToDb(rmsOf(buf, [[0, DURATION]])))} dBFS`);
  console.log(`  NaN / Inf       ${nonFinite}`);
  console.log(`  full-scale smp  ${w.fullScale}`);
  console.log(`  DC offset       L ${((sumL / n) * 100).toFixed(4)} %  R ${((sumR / n) * 100).toFixed(4)} %`);
  console.log(`  last ${SILENT_TAIL} s     ${tailPk === 0 ? 'digital silence (all samples 0)' : 'peak ' + fmtDb(gainToDb(tailPk)) + ' dBFS'}; last non-zero sample at ${(lastNonZero / SR).toFixed(4)} s`);
  console.log(`  sha256          ${sha}`);

  if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16 || w.format !== 1) problems.push('wrong format');
  if (Math.abs(w.duration - DURATION) > 0.001) problems.push(`duration ${w.duration} != ${DURATION}`);
  if (nonFinite) problems.push(`${nonFinite} non-finite samples`);
  if (w.fullScale) problems.push(`${w.fullScale} full-scale (clipped) samples`);
  if (gainToDb(peak) > -0.95) problems.push('peak above -1 dBFS');
  if (tailPk !== 0) problems.push(`last ${SILENT_TAIL} s not silent`);

  const bar = (db) => '#'.repeat(Math.max(0, Math.round(db + 40)));
  console.log('\nRMS per 2 s window (dBFS):');
  console.log('  window (s)      section       RMS   peak');
  for (let a = 0; a < DURATION - 1e-9; a += 2) {
    const b = Math.min(DURATION, a + 2);
    const [pk] = peakIn(L, R, a, b);
    const r = gainToDb(rmsOf(buf, [[a, b]]));
    console.log(`  ${padL(a.toFixed(1), 5)} - ${padR(b.toFixed(2), 6)}  ${padR(sectionAtSec((a + b) / 2), 10)} ${padL(fmtDb(r), 6)} ${padL(fmtDb(gainToDb(pk)), 6)}  ${bar(r)}`);
  }

  console.log('\nRMS per section (dBFS):');
  const rows = [
    ...SECTIONS,
    ['  groove C: story', 38.9, tb(94)],
    ['  groove C: break', tb(94), tb(98)],
    ['  groove C: build', tb(98), 55.9],
    ['  climax: 61.1-66.4', 61.1, 66.4],
    ['  climax: peak 66.4-69.9', 66.4, 69.9],
    ['  ring-out 69.9-72.24', 69.9, DURATION - SILENT_TAIL],
  ];
  const secRms = {};
  for (const [name, a, b] of rows) {
    const [pk, at] = peakIn(L, R, a, b);
    const r = gainToDb(rmsOf(buf, [[a, b]]));
    secRms[name] = r;
    console.log(`  ${padR(name, 26)} ${padL(a.toFixed(2), 6)}-${padR(b.toFixed(2), 6)} RMS ${padL(fmtDb(r), 6)}  peak ${padL(fmtDb(gainToDb(pk)), 6)} @ ${at.toFixed(2)} s`);
  }
  // 0.5 s windows: where is the loudest moment?
  let best = [-Infinity, 0];
  for (let a = 0; a < DURATION - 0.5; a += 0.25) {
    const r = gainToDb(rmsOf(buf, [[a, a + 0.5]]));
    if (r > best[0]) best = [r, a];
  }
  console.log(`  loudest 0.5 s window: ${best[1].toFixed(2)}-${(best[1] + 0.5).toFixed(2)} s at ${best[0].toFixed(1)} dBFS RMS`);
  for (const t of [59.0, 61.1, 66.4, 69.9]) console.log(`  0.5 s after the ${t.toFixed(1)} s hit: ${fmtDb(gainToDb(rmsOf(buf, [[t, t + 0.5]])))} dBFS RMS`);
  const band = { L: filt(filt(L, 'hp', 1000, 0.7), 'lp', 4000, 0.7), R: filt(filt(R, 'hp', 1000, 0.7), 'lp', 4000, 0.7) };
  const share = SECTIONS.map(([s, a, b]) => `${s} ${fmtDb(gainToDb(rmsOf(band, [[a, b]]) / rmsOf(buf, [[a, b]])))}`).join(', ');
  console.log(`  1-4 kHz band level rel. full band (dB): ${share}`);

  const peakHit = gainToDb(rmsOf(buf, [[66.4, 66.9]]));
  const arc = [
    ['intro < groove', secRms.intro < secRms.groove],
    ['dream (33.2) softer than groove B and groove C', secRms.dream < secRms['groove B'] && secRms.dream < secRms['groove C']],
    ['climax loudest section', SECTIONS.every(([s]) => s === 'climax' || secRms[s] < secRms.climax)],
    ['peak half of climax (66.4-69.9) louder than 61.1-66.4', secRms['  climax: peak 66.4-69.9'] > secRms['  climax: 61.1-66.4']],
    ['66.4 s hit is the loudest hit (0.5 s RMS vs 59.0 / 61.1 / 69.9)', [59.0, 61.1, 69.9].every((t) => gainToDb(rmsOf(buf, [[t, t + 0.5]])) < peakHit)],
  ];
  console.log('\nArc checks:');
  for (const [name, ok] of arc) {
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`);
    if (!ok) problems.push(`arc: ${name}`);
  }
  return { problems, sha };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
function main() {
  const t0 = Date.now();
  mkdirSync(dirname(OUT_PATH), { recursive: true });

  let minBpm = Infinity;
  let maxBpm = -Infinity;
  for (let b = 0; b <= AX[AX.length - 1]; b += 0.05) {
    const v = bpmAt(b);
    minBpm = Math.min(minBpm, v);
    maxBpm = Math.max(maxBpm, v);
  }
  console.log(`Key D major, 4/4. Tempo map (PCHIP through anchors): average ${AVG_BPM.toFixed(2)} BPM, instantaneous ${minBpm.toFixed(1)}-${maxBpm.toFixed(1)} BPM`);
  console.log('  anchor segments (beat@s -> beat@s : mean BPM):');
  for (let k = 0; k < AX.length - 1; k++) {
    console.log(`    ${padL(AX[k], 5)} @ ${padL(AY[k].toFixed(2), 5)} s -> ${padL(AX[k + 1], 5)} @ ${padL(AY[k + 1].toFixed(2), 5)} s : ${(60 / AD[k]).toFixed(2)} BPM`);
  }
  console.log('\nBars (start time, length, chord(s)):');
  for (const [s, len, name] of BARS) {
    const chords = CHORD_TL.filter(([b]) => b >= s && b < s + len).map(([b, c]) => (b === s ? CHORDS[c].name : `${CHORDS[c].name}@+${b - s}`));
    if (!chords.length || CHORD_TL.every(([b]) => b !== s)) chords.unshift(`(${chordAt(s).name})`);
    console.log(`  beat ${padL(s, 3)}  ${padL(tb(s).toFixed(3), 7)} s  ${len}/4  ${padR(name, 22)} ${chords.join(' ')}`);
  }
  console.log('\nHit points -> grid:');
  for (const [name, t0, b] of HITS) {
    const t = t0 ?? tb(b);
    const bar = BARS.filter(([s]) => s <= b + 1e-9).pop();
    const pos = b - bar[0];
    const where = pos === 0 ? 'downbeat' : `beat ${Math.floor(pos) + 1}${pos % 1 ? ' +1/8 ("and")' : ''}`;
    console.log(`  ${padR(name, 15)} ${padL(t.toFixed(2), 6)} s -> beat ${padL(b, 5)} (${padR(where, 18)}) at ${tb(b).toFixed(3)} s, ${t0 === null ? `(requested "around 50-52 s"; bar runs ${tb(b).toFixed(2)}-${tb(b + 4).toFixed(2)} s)` : `error ${padL(((tb(b) - t) * 1000).toFixed(1), 6)} ms`}`);
  }

  const stems = renderMusic();
  const m = mixAndMaster(stems);
  if (m.nonFinite) throw new Error(`${m.nonFinite} non-finite samples in the master`);
  writeWav(OUT_PATH, m.out);
  console.log(`\nMaster: pre-gain ${m.preDb.toFixed(2)} dB, limiter max reduction ${m.maxReductionDb.toFixed(2)} dB, climax RMS ${m.rmsDb.toFixed(2)} dBFS, non-finite samples 0`);
  console.log(`Stem loudness in climax (K-weighted, dB rel. full mix): ${m.stemReport}`);
  console.log(`Notes rendered (cached): piano ${pianoCache.size}, pluck ${pluckCache.size}`);

  const { problems } = verify(OUT_PATH);
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / clipping / silent-tail / arc checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT_PATH}`);
  if (problems.length) process.exitCode = 1;
}

main();
