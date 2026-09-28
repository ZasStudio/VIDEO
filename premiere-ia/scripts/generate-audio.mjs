#!/usr/bin/env node
// =============================================================================
// scripts/generate-audio.mjs
//
// Procedural audio for the "premiere-ia" Remotion video.
// Every sound is synthesized from math (oscillators, noise, envelopes, filters,
// delays). No samples, no downloads, no external services, zero npm deps.
// Deterministic: all randomness comes from seeded PRNGs (never Math.random).
//
//   node scripts/generate-audio.mjs
//
// Writes public/audio/*.wav (48 kHz, stereo, 16-bit PCM) and prints a
// verification report that is computed by re-reading the files from disk.
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
const stereo = (sec) => stereoN(samples(sec));

// Equal-power pan, p in [-1, 1]; unity gain on both sides at center.
function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a) * Math.SQRT2, Math.sin(a) * Math.SQRT2];
}

// Mix a mono source into a stereo bus at time t (seconds).
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

// Mix a stereo source into a stereo bus at time t (seconds).
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
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      ch[c][i] = b.readInt16LE(data.off + (i * fmt.channels + c) * 2) / 32768;
    }
  }
  return { ...fmt, frames, duration: frames / fmt.sampleRate, ch };
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

// RBJ-cookbook high shelf (slope 1), used as a gentle "air" lift on the master.
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

// Freeverb-style stereo reverb (8 damped combs + 4 allpasses per side).
// Returns the 100% wet signal, same length as the input.
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

// Ping-pong delay: first echo on the left, then right, then left...
// Feedback path is band-limited (one-pole LP + HP). Returns the wet signal.
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
function chorus(inp, { base = 0.011, depth = 0.0022, rate = 0.45, mix = 0.4 } = {}) {
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

// Look-ahead peak limiter (stereo-linked). The gain is computed from a
// forward-looking window minimum followed by a box filter of the same length,
// which guarantees the gain has fully ramped down when the peak arrives.
function limiter(buf, { ceilingDb = -1.2, lookSec = 0.005, releaseSec = 0.12 } = {}) {
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

// ----------------------------------------------------------------------------
// Drum & FX voices. Mono voices return Float64Array, others { L, R }.
// Most voices are normalised to a peak of 1 so mix gains are predictable.
// ----------------------------------------------------------------------------

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

// Punchy 808-style kick: sine with a fast pitch drop (f0 -> f1), click, saturation.
function kick({ f0 = 160, f1 = 50, pitchTau = 0.03, decay = 0.17, len = 0.5, click = 0.5, drive = 1.8, seed = 11 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / pitchTau);
    ph += (TAU * f) / SR;
    y[i] = Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t / decay);
    if (t < 0.006) {
      y[i] += click * (0.5 * rng.bi() * Math.exp(-t / 0.0007) + 0.6 * Math.sin(TAU * 3200 * t) * Math.exp(-t / 0.0012));
    }
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], drive);
  return normMono(tailFade(y, 0.02));
}

// Snare: two pitched body modes + band-limited noise (snappy attack + tail).
function snare({ tone = 190, bodyDecay = 0.07, noiseDecay = 0.15, len = 0.45, bodyAmt = 0.6, noiseAmt = 1.0, seed = 21 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const nz = filt(filt(whiteNoise(n, rng), 'hp', 1400, 0.8), 'lp', 9000);
  const y = new Float64Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = tone * (1 + 0.6 * Math.exp(-t / 0.006));
    p1 += (TAU * f) / SR;
    p2 += (TAU * f * 1.72) / SR;
    const body = Math.sin(p1) * Math.exp(-t / bodyDecay) + 0.5 * Math.sin(p2) * Math.exp(-t / (bodyDecay * 0.6));
    const nenv = 0.6 * Math.exp(-t / 0.045) + 0.4 * Math.exp(-t / noiseDecay);
    y[i] = Math.min(1, t / 0.0005) * (body * bodyAmt + nz[i] * nenv * noiseAmt);
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], 1.5);
  return normMono(tailFade(y, 0.02));
}

// Hand clap: band-passed noise with 4 quick bursts, then a short diffuse tail.
function clap({ tail = 0.09, len = 0.4, seed = 31 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const nz = filt(filt(whiteNoise(n, rng), 'bp', 1400, 1.1), 'hp', 700);
  const bursts = [
    [0, 0.8],
    [0.0105, 0.75],
    [0.0205, 0.7],
    [0.031, 1.0],
  ];
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let e = 0;
    for (const [tb, a] of bursts) if (t >= tb) e = Math.max(e, a * Math.exp(-(t - tb) / 0.0045));
    if (t >= 0.031) e = Math.max(e, 0.55 * Math.exp(-(t - 0.031) / tail));
    y[i] = nz[i] * e;
  }
  return normMono(tailFade(y, 0.02));
}

// Hi-hat: six detuned square "metal" oscillators (808 ratios) + noise, band-passed high.
const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
function hat({ open = false, tone = 1, decay = null, len = null, seed = 41 } = {}) {
  const rng = makeRng(seed);
  const d = decay ?? (open ? 0.2 : 0.026);
  const n = samples(len ?? (open ? 0.7 : 0.16));
  const oscs = HAT_FREQS.map(() => new Osc(rng.next()));
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let k = 0; k < 6; k++) m += oscs[k].pulse(HAT_FREQS[k] * 1.9 * tone);
    src[i] = (m / 6) * 0.7 + rng.bi() * 0.55;
  }
  const y = filt(filt(src, 'bp', 9000 * tone, 0.8), 'hp', 6000);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.0003) * (0.35 * Math.exp(-t / 0.006) + 0.65 * Math.exp(-t / d));
  }
  return normMono(tailFade(y, 0.01));
}

// Crash cymbal (stereo, decorrelated noise per side + shared metallic partials).
function crash({ decay = 1.1, len = 3, bright = 1, seed = 51 } = {}) {
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
    for (let i = 0; i < n; i++) src[i] = nz[i] * 0.8 + metal[i] * 0.35;
    const y = filt(filt(filt(src, 'hp', 3200 * bright, 0.7), 'hp', 2500 * bright, 0.7), 'lp', 13000);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      y[i] *= Math.min(1, t / 0.0015) * (0.6 * Math.exp(-t / 0.05) + Math.exp(-t / decay));
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

// Cinematic sub boom: sine gliding f0 -> f1 with long decay + low-passed noise burst.
function impactBoom({ f0 = 70, f1 = 30, glideTau = 0.25, decay = 0.55, len = 1.5, noiseAmt = 0.45, noiseDecay = 0.09, drive = 1.4, seed = 61 } = {}) {
  const n = samples(len);
  const body = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / glideTau);
    ph += (TAU * f) / SR;
    body[i] = Math.sin(ph) * Math.min(1, t / 0.002) * Math.exp(-t / decay);
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const nz = filt(whiteNoise(n, makeRng(seed * 13 + ci)), 'lp', (t) => 180 + 3800 * Math.exp(-t / 0.07), 0.7);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const click = t < 0.003 ? Math.exp(-t / 0.0006) * (ci ? -0.3 : 0.3) : 0;
      y[i] = sat(body[i] + nz[i] * noiseAmt * Math.exp(-t / noiseDecay) + click, drive);
    }
    out[c] = tailFade(y, 0.04);
  });
  return normalizePeak(out, 0);
}

// Riser: band-passed noise sweeping up (decorrelated L/R = width) + a rising
// tone (sine, optionally phase-locked saw + octave saw, so it never beats),
// swelling to its peak exactly at the end (only a 1.5 ms declick, no tail).
function riser({ dur = 2, fStart = 300, fEnd = 9000, toneFrom = 110, toneTo = 880, toneAmt = 0.35, sawAmt = 1, noiseAmt = 1, curve = 2.2, seed = 71 } = {}) {
  const n = samples(dur);
  const fcAt = (t) => expInterp(fStart, fEnd, Math.pow(t / dur, 1.2));
  const qAt = (t) => 1 + 3.5 * (t / dur);
  const tone = new Float64Array(n);
  const oSine = new Osc(0);
  const oSaw = new Osc(0.25);
  const oOct = new Osc(0.5);
  for (let i = 0; i < n; i++) {
    const f = expInterp(toneFrom, toneTo, Math.pow(i / n, 1.6));
    tone[i] = sawAmt * (0.6 * oSaw.saw(f) + 0.25 * oOct.saw(2 * f)) + oSine.sine(f) * (sawAmt ? 0.4 : 1);
  }
  const toneF = filt(tone, 'lp', (t) => Math.min(12000, fcAt(t) * 0.8 + 400), 0.9);
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const nz = filt(whiteNoise(n, makeRng(seed * 17 + ci)), 'bp', fcAt, qAt);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const p = i / n;
      const a = 0.015 + 0.985 * (0.7 * Math.pow(p, curve) + 0.3 * Math.pow(p, 10)); // extra swell into the end
      y[i] = (nz[i] * noiseAmt + toneF[i] * toneAmt) * a;
    }
    out[c] = tailFade(y, 0.0015);
  });
  return normalizePeak(out, 0);
}

// Vinyl crackle: sparse ticks (Poisson), a few rounder pops, faint hiss and a
// once-per-revolution (33 1/3 rpm = 1.8 s) click. Independent per channel.
function vinylCrackle(dur, { rate = 40, popRate = 0.9, hiss = 1, seed = 81 } = {}) {
  const n = samples(dur);
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const rng = makeRng(seed * 31 + ci);
    const ch = filt(filt(pinkNoise(n, rng), 'hp', 1200), 'lp', 6000);
    for (let i = 0; i < n; i++) ch[i] *= 0.05 * hiss;
    const pops = new Float64Array(n);
    const addEvents = (target, evRate, ampFn, tauLo, tauHi) => {
      let t = 0;
      for (;;) {
        t += -Math.log(1 - rng.next()) / evRate;
        if (t >= dur) break;
        const s = Math.round(t * SR);
        const amp = ampFn();
        const tau = rng.range(tauLo, tauHi) * SR;
        const m = Math.min(n - s, Math.ceil(tau * 6) + 2);
        const sign = rng.chance(0.5) ? 1 : -1;
        for (let k = 0; k < m; k++) target[s + k] += sign * amp * Math.exp(-k / tau) * (k === 0 ? 1 : rng.bi());
      }
    };
    addEvents(ch, rate, () => Math.min(0.18, 0.018 * Math.pow(-Math.log(1 - rng.next()), 1.6)), 0.00006, 0.0003);
    addEvents(pops, popRate, () => rng.range(0.08, 0.2), 0.0006, 0.0015);
    for (let t = 0.9; t < dur - 0.01; t += 1.8) pops[Math.round(t * SR) + ci * 3] += 0.15;
    const popsF = filt(pops, 'lp', 2600, 0.7);
    for (let i = 0; i < n; i++) ch[i] += popsF[i];
    out[c] = filt(ch, 'hp', 300);
  });
  return out;
}

// DJ scratch: a vowel-like "ahh" source read by a virtual turntable whose speed
// goes forward/backward (baby scratch strokes). Pitch and level follow speed.
function scratchFx({ len = 0.5, seed = 91 } = {}) {
  const rng = makeRng(seed);
  const ns = samples(1.5);
  const o = new Osc(0);
  const raw = new Float64Array(ns);
  for (let i = 0; i < ns; i++) {
    const t = i / SR;
    raw[i] = o.saw(165 * (1 + 0.012 * Math.sin(TAU * 5.5 * t))) * 0.8 + rng.bi() * 0.12;
  }
  const f1 = filt(raw, 'bp', 730, 6);
  const f2 = filt(raw, 'bp', 1090, 7);
  const f3 = filt(raw, 'bp', 2440, 8);
  const lo = filt(raw, 'lp', 400);
  const src = new Float64Array(ns);
  for (let i = 0; i < ns; i++) src[i] = f1[i] + 0.7 * f2[i] + 0.35 * f3[i] + 0.3 * lo[i];
  normMono(src);

  // [start, end, direction, peak speed (1 = normal playback)]
  const strokes = [
    [0.0, 0.085, 1, 2.4],
    [0.085, 0.165, -1, 2.2],
    [0.165, 0.235, 1, 2.8],
    [0.235, 0.305, -1, 2.6],
    [0.305, len, 1, 1.6],
  ];
  const n = samples(len);
  const y = new Float64Array(n);
  const f = new SVF(2000, 0.8);
  let pos = 0.25 * SR;
  let si = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (si < strokes.length - 1 && t >= strokes[si][1]) si++;
    const [a, b, dir, peak] = strokes[si];
    const v = dir * peak * Math.sin((Math.PI * clamp((t - a) / (b - a), 0, 1)));
    pos = clamp(pos + v, 0, ns - 2);
    const i0 = Math.floor(pos);
    const fr = pos - i0;
    const s = src[i0] * (1 - fr) + src[i0 + 1] * fr;
    if ((i & 15) === 0) f.set(600 + 6000 * Math.min(1, Math.abs(v) / 2.5), 0.8);
    y[i] = f.tick(s) * Math.pow(Math.min(1, Math.abs(v) / 1.2), 0.8);
  }
  tailFade(y, 0.03);
  const out = stereoN(n);
  for (let i = 0; i < n; i++) {
    out.L[i] = y[i];
    out.R[i] = i >= 6 ? y[i - 6] : 0; // tiny inter-channel offset for width
  }
  return normalizePeak(out, 0);
}

// ----------------------------------------------------------------------------
// Tonal voices
// ----------------------------------------------------------------------------

// FM electric piano: sine carrier phase-modulated by itself (ratio 1, decaying
// index = the "bark") plus a ratio-14 modulator for the metallic tine attack.
function epNote(freq, dur, vel = 0.8, { bright = 1, seed = 101 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + 0.3);
  const y = new Float64Array(n);
  const kt = Math.sqrt(261.6 / freq); // key tracking: high notes decay faster
  const i1 = bright * (0.5 + 1.5 * vel);
  const i2 = bright * 0.9 * vel;
  const fc = freq * (1 + rng.range(-0.0012, 0.0012));
  let pc = 0;
  let pt = rng.next() * TAU;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    pc += (TAU * fc) / SR;
    pt += (TAU * fc * 14) / SR;
    const idx1 = 0.25 + i1 * Math.exp(-t / 0.35);
    const idx2 = i2 * Math.exp(-t / 0.012);
    let env = Math.min(1, t / 0.002) * (0.7 * Math.exp(-t / (1.8 * kt)) + 0.3 * Math.exp(-t / (0.22 * kt)));
    if (t > dur) env *= Math.exp(-(t - dur) / 0.06);
    y[i] = Math.sin(pc + idx1 * Math.sin(pc) + idx2 * Math.sin(pt)) * env * vel;
  }
  return tailFade(y, 0.01);
}

// 808 sub bass: sine + a touch of 2nd harmonic, short pitch punch, optional
// legato slide (glide) to another note, saturated so it reads on small speakers.
function bass808(midi, dur, vel = 1, { slideTo = null, slideAt = 0, slideTime = 0.1, drive = 2.2 } = {}) {
  const rel = 0.035;
  const n = samples(dur + rel);
  const y = new Float64Array(n);
  const f0 = mtof(midi);
  const f1 = slideTo != null ? mtof(slideTo) : f0;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let f = slideTo != null && t > slideAt ? expInterp(f0, f1, smoothstep((t - slideAt) / slideTime)) : f0;
    f *= 1 + 0.3 * Math.exp(-t / 0.012);
    ph += (TAU * f) / SR;
    let env = Math.min(1, t / 0.004) * (0.35 + 0.65 * Math.exp(-t / 0.6));
    if (t > dur) env *= Math.max(0, 1 - (t - dur) / rel);
    y[i] = sat((Math.sin(ph) + 0.15 * Math.sin(2 * ph)) * env * vel, drive);
  }
  return y;
}

// Plucky arp synth: pulse + saw (PolyBLEP) through an enveloped low-pass.
function pluck(freq, vel = 1, { len = 0.24, seed = 201 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const src = new Float64Array(n);
  const o1 = new Osc(rng.next());
  const o2 = new Osc(rng.next());
  for (let i = 0; i < n; i++) src[i] = 0.6 * o1.pulse(freq, 0.3) + 0.4 * o2.saw(freq * 1.004);
  const y = filt(src, 'lp', (t) => 1100 + 6000 * (0.6 + 0.4 * vel) * Math.exp(-t / 0.055), 1.2);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= Math.min(1, t / 0.001) * Math.exp(-t / 0.09) * vel;
  }
  return tailFade(y, 0.02);
}

// ----------------------------------------------------------------------------
// Song map: 96 BPM, 4/4, A minor, 18 bars = 45.000 s
// ----------------------------------------------------------------------------
const BPM = 96;
const BEAT = 60 / BPM; // 0.625 s
const BAR = 4 * BEAT; // 2.5 s
const STEP = BEAT / 4; // 16th note = 0.15625 s
const SWING = 0.55; // 16th swing (55%): off-16ths are late by 15.6 ms
const SONG_SEC = 45;
const DROP1 = 5.0; // bar 3 downbeat
const BREAK = 20.0; // bar 9
const DROP2 = 22.5; // bar 10 downbeat
const FINAL = 42.5; // bar 18 downbeat
const GAP1 = 0.03; // build-ups stop just before the drops ("breath")
const GAP2 = 0.06;

const barStart = (bar) => (bar - 1) * BAR;
const at = (bar, step) => barStart(bar) + step * STEP + (step % 2 === 1 ? (SWING - 0.5) * 2 * STEP : 0);

// One chord per bar, loop of 4 bars starting at bar 1. EP voicings, 808 roots
// and arp tones (an octave above the voicing).
const CHORDS = [
  { name: 'Am7', root: 33, low: 45, notes: [57, 60, 64, 67], arp: [69, 72, 76, 79, 81] },
  { name: 'Fmaj7', root: 29, low: 41, notes: [53, 57, 60, 64], arp: [65, 69, 72, 76, 77] },
  { name: 'Cmaj7', root: 36, low: 48, notes: [52, 55, 59, 64], arp: [67, 71, 72, 76, 79] },
  { name: 'G(add9)', root: 31, low: 43, notes: [55, 59, 62, 69], arp: [67, 69, 71, 74, 79] },
];
const chordOf = (bar) => CHORDS[(bar - 1) % 4];
// Bar 18 continues the loop -> Fmaj7. Use CHORDS[0] here to end on the tonic Am7.
const FINAL_CHORD = chordOf(18);

// Patterns in 16th steps, indexed by chord position in the loop.
const KICKS = [[0, 7, 10], [0, 6, 10, 13], [0, 7, 10], [0, 3, 8, 10, 14]];
// 808: [step, midi, slideTo?] - each note lasts until the next one.
const BASS_A = [
  [[0, 33], [7, 33], [10, 33]],
  [[0, 29], [6, 29], [10, 29], [13, 41]],
  [[0, 36], [7, 36], [10, 36]],
  [[0, 31], [3, 31], [8, 31], [10, 31], [14, 31, 33]], // glide G1 -> A1 into the next loop
];
const BASS_B = [BASS_A[0], [[0, 29], [6, 29], [10, 29], [13, 29, 41]], BASS_A[2], BASS_A[3]];
const HAT_FILLS = [[7], [11, 15], [3, 7], [13]];
const STABS = [
  [[0, 2.5, 0.9], [3, 1.5, 0.55], [6, 1.5, 0.7], [10, 3, 0.8]],
  [[0, 3, 0.9], [7, 1.5, 0.6], [10, 2, 0.75], [14, 1.5, 0.55]],
];
const ARP_SEQ = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1];
const ARP_ACCENTS = new Set([0, 3, 6, 10, 12]);

function playChord(bus, chord, t, dur, vel, { rng, withLow = false, strum = 0.006, gain = 0.28 } = {}) {
  const notes = withLow ? [chord.low, ...chord.notes] : chord.notes;
  notes.forEach((m, k) => {
    const v = vel * (withLow && k === 0 ? 0.55 : 1) * (1 + rng.range(-0.06, 0.06));
    const x = epNote(mtof(m), dur, v, { seed: rng.int(1, 1e9) });
    addMono(bus, x, t + k * strum, gain, (k / (notes.length - 1) - 0.5) * 0.4);
  });
}

// ----------------------------------------------------------------------------
// Music render: returns the stem buses (not yet mastered)
// ----------------------------------------------------------------------------
function renderMusic() {
  const N = samples(SONG_SEC);
  const bus = {
    drums: stereoN(N),
    bass: stereoN(N),
    keys: stereoN(N),
    arp: stereoN(N),
    fx: stereoN(N),
    crackle: stereoN(N),
    verb: stereoN(N), // reverb send
  };
  const rng = makeRng(2024);
  const kickTimes = [];

  // Pre-rendered drum voices
  const K = kick({ seed: 11 });
  const Ksoft = kick({ f0: 130, decay: 0.24, click: 0.15, drive: 1.3, seed: 12 });
  const SN = snare({ seed: 21 });
  const CL = clap({ seed: 31 });
  const HATS = [0, 1, 2, 3, 4, 5].map((k) => hat({ seed: 41 + k, tone: 0.97 + 0.012 * k, decay: 0.022 + 0.004 * (k % 3) }));
  const HAT_OPEN = hat({ open: true, seed: 48 });

  const addKick = (t, v = 1, x = K) => {
    addMono(bus.drums, x, t, 0.95 * v);
    kickTimes.push(t);
  };
  const addSnare = (t, v = 1) => {
    addMono(bus.drums, SN, t, 0.7 * v);
    addMono(bus.drums, CL, t + 0.004, 0.55 * v);
    addMono(bus.verb, SN, t, 0.1 * v);
    addMono(bus.verb, CL, t, 0.14 * v);
  };
  const addHat = (t, v, pan = 0.22, x = null) => addMono(bus.drums, x ?? HATS[rng.int(0, 5)], t, 0.26 * v, pan);
  const addOpenHat = (t, chokeAfter, v = 1) => {
    const x = Float64Array.from(HAT_OPEN);
    const c = samples(chokeAfter);
    const fl = samples(0.012);
    for (let i = c; i < x.length; i++) x[i] *= Math.max(0, 1 - (i - c) / fl);
    addMono(bus.drums, x, t, 0.17 * v, -0.25);
  };

  function grooveBar(bar, { arp, grooveStart }) {
    const ci = (bar - 1) % 4;
    const ch = CHORDS[ci];
    const roll = (bar - grooveStart) % 2 === 1;

    // Kick + 808 (808 follows the kick rhythm and the chord root)
    KICKS[ci].forEach((s) => addKick(at(bar, s), s === 0 ? 1 : 0.85));
    const line = (arp ? BASS_B : BASS_A)[ci];
    line.forEach(([s, m, slide], k) => {
      const t0 = at(bar, s);
      const next = k + 1 < line.length ? at(bar, line[k + 1][0]) : barStart(bar + 1);
      const dur = next - t0 - 0.012;
      const opts = slide != null ? { slideTo: slide, slideAt: Math.max(0, dur - 0.2), slideTime: 0.14 } : {};
      addMono(bus.bass, bass808(m, dur, s === 0 ? 1 : 0.9, opts), t0, 0.55);
    });

    // Snare + clap on 2 and 4, a ghost snare now and then
    [4, 12].forEach((s) => addSnare(at(bar, s)));
    if (ci === 1) addMono(bus.drums, SN, at(bar, 11), 0.1);

    // Hats: 8ths + 16th fills, velocity variation, swing, rolls / open hats
    const steps = new Set([0, 2, 4, 6, 8, 10, 12, 14, ...HAT_FILLS[ci]]);
    const sorted = [...steps].sort((a, b) => a - b);
    for (const s of sorted) {
      if (roll && s >= 12) continue;
      const v = (s % 4 === 0 ? 0.85 : s % 2 === 0 ? 0.62 : 0.4) + rng.range(-0.08, 0.08);
      if (!roll && s === 14) {
        const nextStep = sorted.find((x) => x > 14);
        const chokeT = (nextStep != null ? at(bar, nextStep) : barStart(bar + 1)) - at(bar, 14);
        addOpenHat(at(bar, 14), chokeT);
        continue;
      }
      addHat(at(bar, s), v);
    }
    if (roll) {
      // trap-style 32nd-note roll over the last beat, rising in pitch and level
      for (let k = 0; k < 8; k++) {
        const t = barStart(bar) + 12 * STEP + (k * STEP) / 2;
        const x = hat({ seed: 400 + bar * 8 + k, tone: 1 + 0.02 * k, decay: 0.018 });
        addHat(t, 0.4 + (0.5 * k) / 7, k % 2 ? 0.35 : 0.1, x);
      }
    }

    // Electric-piano chord stabs
    STABS[bar % 2].forEach(([s, d, v]) => playChord(bus.keys, ch, at(bar, s), d * STEP, v * (arp ? 0.85 : 1), { rng }));

    // Groove B: 16th-note pluck arpeggio (chord tones an octave up)
    if (arp) {
      for (let s = 0; s < 16; s++) {
        const m = ch.arp[ARP_SEQ[s]];
        const v = ARP_ACCENTS.has(s) ? 1 : 0.62;
        addMono(bus.arp, pluck(mtof(m), v, { seed: 1000 + bar * 16 + s }), at(bar, s), 0.11, s % 2 ? 0.18 : -0.18);
      }
    }
  }

  // --- Vinyl crackle bed (level automated below)
  addStereo(bus.crackle, vinylCrackle(SONG_SEC, { seed: 81 }), 0);

  // --- INTRO (bars 1-2): filtered EP, soft kick on beat 1, riser, scratch
  [1, 2].forEach((bar) => {
    STABS[bar % 2].forEach(([s, d, v]) => playChord(bus.keys, chordOf(bar), at(bar, s), d * STEP, v, { rng, withLow: true }));
    addKick(barStart(bar), 0.55, Ksoft);
  });
  addStereo(bus.fx, riser({ dur: BAR - GAP1, toneFrom: 220, toneTo: 1320, toneAmt: 0.3, sawAmt: 0, seed: 71 }), barStart(2), 0.2);
  const scr = scratchFx({ seed: 91 });
  addStereo(bus.fx, scr, at(2, 12), 0.6);
  addStereo(bus.verb, scr, at(2, 12), 0.12);

  // --- DROP 1 (5.000 s): sub boom + crash, groove A (bars 3-8)
  const imp1 = impactBoom({ seed: 61 });
  addStereo(bus.fx, imp1, DROP1, 0.7);
  addStereo(bus.verb, imp1, DROP1, 0.06);
  addStereo(bus.fx, crash({ seed: 51 }), DROP1, 0.26);
  for (let bar = 3; bar <= 8; bar++) grooveBar(bar, { arp: false, grooveStart: 3 });

  // --- BREAK (bar 9): drums out, chords close down, riser + reverse cymbal, snare roll
  playChord(bus.keys, chordOf(9), BREAK, BAR - 0.1, 0.85, { rng, withLow: true });
  addStereo(bus.fx, riser({ dur: BAR - GAP2, toneAmt: 0.45, curve: 2.0, seed: 72 }), BREAK, 0.3);
  const rc = reverseCymbal(1.9, 57);
  addStereo(bus.fx, rc, DROP2 - GAP2 - 1.9, 0.3);
  {
    let t = at(9, 8); // 21.25 s
    let dt = STEP;
    while (t < DROP2 - GAP2 - 0.03) {
      const p = (t - at(9, 8)) / (DROP2 - at(9, 8));
      const x = snare({ tone: 180 + 90 * p, noiseDecay: 0.08, len: 0.25, seed: 300 + Math.round(t * 100) });
      addMono(bus.drums, x, t, 0.5 * (0.3 + 0.7 * p));
      addMono(bus.verb, x, t, 0.12 * (0.3 + 0.7 * p));
      t += dt;
      dt = Math.max(0.035, dt * 0.88);
    }
  }

  // --- DROP 2 (22.500 s): bigger impact + crash, groove B (bars 10-17)
  const imp2 = impactBoom({ f0: 80, f1: 28, decay: 0.8, len: 2.0, noiseAmt: 0.6, noiseDecay: 0.14, drive: 1.8, seed: 62 });
  addStereo(bus.fx, imp2, DROP2, 0.9);
  addStereo(bus.verb, imp2, DROP2, 0.08);
  addStereo(bus.fx, crash({ seed: 52, decay: 1.3 }), DROP2, 0.3);
  addStereo(bus.fx, crash({ seed: 54, decay: 0.5, bright: 1.3 }), DROP2, 0.12);
  for (let bar = 10; bar <= 17; bar++) grooveBar(bar, { arp: true, grooveStart: 10 });

  // --- FINAL HIT (42.500 s): kick + 808 + crash + full chord, then ring out
  addKick(FINAL, 1.05);
  addMono(bus.bass, bass808(FINAL_CHORD.root, 2.3, 1), FINAL, 0.6);
  addStereo(bus.fx, crash({ seed: 53, decay: 1.5, len: 2.5 }), FINAL, 0.3);
  addStereo(bus.fx, impactBoom({ seed: 63, decay: 0.6 }), FINAL, 0.45);
  playChord(bus.keys, FINAL_CHORD, FINAL, 2.3, 1.0, { rng, withLow: true });
  playChord(bus.keys, { ...FINAL_CHORD, notes: FINAL_CHORD.notes.map((m) => m + 12) }, FINAL + 0.012, 2.3, 0.45, { rng });

  // ---------------------------------------------------------------- bus FX
  // Sidechain-style ducking from every kick (bass a lot, keys a little)
  const duck = new Float64Array(N);
  for (const tk of kickTimes) {
    const s0 = Math.round(tk * SR);
    const m = Math.min(N - s0, samples(0.35));
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      duck[s0 + i] = Math.max(duck[s0 + i], Math.min(1, t / 0.002) * Math.exp(-t / 0.08));
    }
  }
  for (let i = 0; i < N; i++) {
    const gb = 1 - 0.5 * duck[i];
    const gk = 1 - 0.15 * duck[i];
    bus.bass.L[i] *= gb;
    bus.bass.R[i] *= gb;
    bus.keys.L[i] *= gk;
    bus.keys.R[i] *= gk;
  }
  filtStereo(bus.bass, 'hp', 28, 0.7);
  filtStereo(bus.bass, 'lp', 1200, 0.7);

  // Keys: chorus, gentle autopan tremolo, automated low-pass (intro opens, break closes)
  let keys = chorus(bus.keys, { mix: 0.35 });
  for (let i = 0; i < N; i++) {
    const m = 0.12 * Math.sin((TAU * 3.2 * i) / SR);
    keys.L[i] *= 1 + m;
    keys.R[i] *= 1 - m;
  }
  const keysCutoff = (t) => {
    if (t < DROP1) return expInterp(280, 3200, Math.pow(t / DROP1, 1.6));
    if (t < BREAK) return 6500;
    if (t < DROP2) return expInterp(4200, 420, smoothstep((t - BREAK) / (DROP2 - 0.2 - BREAK)));
    if (t < FINAL) return 7000;
    return expInterp(7000, 1800, (t - FINAL) / 2.4);
  };
  keys = filtStereo(keys, 'lp', keysCutoff, (t) => (t < DROP1 ? 1.3 : 0.9));
  addStereo(bus.verb, keys, 0, 0.22);

  // Arp: ping-pong dotted-8th delay + a little reverb
  const echoes = pingPong(bus.arp, { time: 3 * STEP, feedback: 0.38, lp: 4500, hp: 400 });
  const arp = stereoN(N);
  addStereo(arp, bus.arp, 0, 1);
  addStereo(arp, echoes, 0, 0.5);
  addStereo(bus.verb, arp, 0, 0.18);

  // Crackle level automation: up front in the intro and the tail, low in grooves
  const crackleLevel = (t) => (t < DROP1 ? 1 : t < BREAK ? 0.3 : t < DROP2 ? 0.55 : t < FINAL ? 0.25 : 0.8);
  let cl = 1;
  for (let i = 0; i < N; i++) {
    cl += (crackleLevel(i / SR) - cl) * 0.0005;
    bus.crackle.L[i] *= cl;
    bus.crackle.R[i] *= cl;
  }

  // Shared reverb
  const verb = freeverb(bus.verb, { room: 0.85, damp: 0.3 });
  filtStereo(verb, 'hp', 250, 0.7);
  filtStereo(verb, 'lp', 7000, 0.7);

  return { drums: bus.drums, bass: bus.bass, keys, arp, fx: bus.fx, crackle: bus.crackle, verb };
}

// ----------------------------------------------------------------------------
// One-shot SFX (each returns a stereo buffer of exactly the requested length)
// ----------------------------------------------------------------------------

// Band-passed noise sweep (up, then down) with an equal-power pan L -> R.
function sfxWhoosh({ dur = 0.6, fLo = 300, fPeak = 3500, fEnd = 700, peakAt = 0.55, q = 1.6, panFrom = -0.9, panTo = 0.9, seed = 501 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur);
  const pink = pinkNoise(n, rng);
  const white = whiteNoise(n, rng);
  const src = new Float64Array(n);
  for (let i = 0; i < n; i++) src[i] = pink[i] * 0.7 + white[i] * 0.3;
  const tp = peakAt * dur;
  const fcAt = (t) => (t < tp ? expInterp(fLo, fPeak, smoothstep(t / tp)) : expInterp(fPeak, fEnd, smoothstep((t - tp) / (dur - tp))));
  const body = filt(src, 'bp', fcAt, q);
  const air = filt(src, 'bp', (t) => Math.min(16000, fcAt(t) * 2.1), q * 1.5);
  const out = stereoN(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = t < tp ? Math.sin((Math.PI / 2) * (t / tp)) ** 2 : Math.cos((Math.PI / 2) * ((t - tp) / (dur - tp))) ** 1.6;
    const [gl, gr] = panGains(lerp(panFrom, panTo, smoothstep(t / dur)));
    const v = (body[i] + 0.45 * air[i]) * env;
    out.L[i] = v * gl;
    out.R[i] = v * gr;
  }
  return out;
}

// Cartoony bubble pop: fast upward sine chirp + tiny click.
function sfxPop({ seed = 503 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.15);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = expInterp(380, 1500, t / 0.045);
    ph += (TAU * f) / SR;
    const env = Math.min(1, t / 0.0015) * Math.exp(-t / 0.028);
    y[i] = (Math.sin(ph) + 0.2 * Math.sin(2 * ph)) * env;
    if (t < 0.0015) y[i] += 0.35 * rng.bi() * Math.exp(-t / 0.0004);
  }
  return monoToStereo(tailFade(y, 0.01));
}

// Mouse click: press + release transients about 21 ms apart.
function sfxClick({ seed = 504 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.08);
  const y = new Float64Array(n);
  const transient = (t0, amp, fRes, tauRes) => {
    const s0 = Math.round(t0 * SR);
    for (let i = s0; i < n; i++) {
      const t = (i - s0) / SR;
      y[i] +=
        amp *
        (0.7 * rng.bi() * Math.exp(-t / 0.0004) +
          0.6 * Math.sin(TAU * fRes * t) * Math.exp(-t / tauRes) +
          0.3 * Math.sin(TAU * 1100 * t) * Math.exp(-t / 0.003));
    }
  };
  transient(0, 1, 4200, 0.0012);
  transient(0.021, 0.6, 5200, 0.0009);
  return monoToStereo(tailFade(filt(y, 'hp', 400), 0.005));
}

// One keyboard key: top click (band-passed noise + plastic ping) and the
// bottom-out "thock" ~7 ms later.
function keyTap(rng, { amp = 1, pitch = 1, body = 1, len = 0.06 } = {}) {
  const n = samples(len);
  const click = filt(whiteNoise(n, rng), 'bp', 3200 * pitch, 1.2);
  const thud = filt(whiteNoise(n, rng), 'lp', 1500);
  const y = new Float64Array(n);
  const tb = 0.007 * (0.85 + 0.3 * rng.next());
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = click[i] * 1.6 * Math.exp(-t / 0.0025) + 0.25 * Math.sin(TAU * 2100 * pitch * t) * Math.exp(-t / 0.004);
    if (t >= tb) {
      const u = t - tb;
      v += body * (0.6 * Math.sin(TAU * 330 * pitch * u) * Math.exp(-u / 0.009) + 0.5 * thud[i] * Math.exp(-u / 0.002));
    }
    y[i] = v * amp;
  }
  return tailFade(filt(y, 'hp', 120), 0.006);
}

function sfxKey({ seed = 505 } = {}) {
  return monoToStereo(keyTap(makeRng(seed)));
}

// ~11 irregular key taps (one space bar), first one at t = 0.
function sfxTyping({ seed = 506 } = {}) {
  const rng = makeRng(seed);
  const out = stereo(1.2);
  const gaps = [0.09, 0.07, 0.13, 0.08, 0.1, 0.21, 0.075, 0.095, 0.12, 0.085];
  let t = 0;
  for (let k = 0; k <= gaps.length; k++) {
    const space = k === 6;
    const x = keyTap(rng, {
      amp: rng.range(0.7, 1),
      pitch: space ? 0.75 : rng.range(0.9, 1.12),
      body: space ? 1.6 : rng.range(0.7, 1.1),
      len: space ? 0.08 : 0.06,
    });
    addMono(out, x, t, 1, rng.range(-0.25, 0.25));
    if (k < gaps.length) t += gaps[k] + rng.range(-0.015, 0.015);
  }
  return out;
}

// Razor/blade "snip": click + metallic ring + downward scrape + small body thunk.
function sfxCut({ seed = 507 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.25);
  const scrape = filt(whiteNoise(n, rng), 'bp', (t) => expInterp(9000, 4500, t / 0.06), 2.5);
  const partials = [
    [3150, 0.5, 0.05],
    [4730, 0.4, 0.035],
    [6320, 0.35, 0.03],
    [8870, 0.25, 0.02],
    [11200, 0.15, 0.015],
  ];
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      partials.forEach(([f, a, tau], k) => {
        const d = 1 + (ci ? 1 : -1) * 0.002 * (k + 1);
        v += a * Math.sin(TAU * f * d * t + k) * Math.exp(-t / tau);
      });
      v *= Math.min(1, t / 0.0005);
      v += 0.7 * scrape[i] * Math.min(1, t / 0.001) * Math.exp(-t / 0.025);
      v += 0.45 * Math.sin(TAU * 180 * t) * Math.exp(-t / 0.02) * Math.min(1, t / 0.001);
      if (t < 0.0015) v += 0.8 * rng.bi() * Math.exp(-t / 0.0003);
      y[i] = v;
    }
    out[c] = tailFade(filt(y, 'hp', 90), 0.02);
  });
  return out;
}

// Cinematic boom with a short reverb tail.
function sfxImpact() {
  const dry = impactBoom({ f0: 70, f1: 30, glideTau: 0.3, decay: 0.5, len: 1.5, noiseAmt: 0.55, seed: 508 });
  const wet = freeverb(dry, { room: 0.8, damp: 0.35 });
  const out = stereoN(dry.L.length);
  addStereo(out, dry, 0, 1);
  addStereo(out, filtStereo(wet, 'hp', 150), 0, 0.25);
  return fadeOutRange(out, 1.3, 1.5);
}

// Success chime: bell partials (E6, B6, octave, inharmonic 2.76x), slight L/R detune.
function sfxDing({ seed = 510 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.9);
  const partials = [
    [1318.5, 1.0, 0.45],
    [1975.5, 0.55, 0.32],
    [2637.0, 0.22, 0.2],
    [3636.0, 0.18, 0.09],
    [5270.0, 0.07, 0.05],
  ];
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      partials.forEach(([f, a, tau], k) => {
        v += a * Math.sin(TAU * (f + (ci ? 1.2 : -1.2) * (k < 2 ? 1 : 0)) * t + k * 0.7) * Math.exp(-t / tau);
      });
      y[i] = v * Math.min(1, t / 0.0015);
      if (t < 0.003) y[i] += 0.15 * rng.bi() * Math.exp(-t / 0.0008);
    }
    out[c] = y;
  });
  return fadeOutRange(out, 0.8, 0.9);
}

// "AI" shimmer: fast ascending high sine arpeggio (A minor pentatonic),
// alternating pan, faint glints, run through a small reverb.
function sfxSparkle({ seed = 511 } = {}) {
  const rng = makeRng(seed);
  const dur = 0.9;
  const n = samples(dur);
  const dry = stereoN(n);
  const notes = [93, 96, 98, 100, 103, 105, 108]; // A6 C7 D7 E7 G7 A7 C8
  notes.forEach((m, k) => {
    const f = mtof(m);
    const len = samples(0.4);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      y[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t + 1)) * Math.min(1, t / 0.001) * Math.exp(-t / 0.12);
    }
    addMono(dry, tailFade(y, 0.02), k * 0.038, 0.9 - k * 0.06, k % 2 ? 0.55 : -0.55);
  });
  for (let g = 0; g < 9; g++) {
    const t0 = rng.range(0.08, 0.5);
    const f = rng.range(5000, 9000);
    const len = samples(0.06);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) y[i] = Math.sin((TAU * f * i) / SR) * Math.exp(-i / SR / 0.012);
    addMono(dry, y, t0, 0.18, rng.bi() * 0.8);
  }
  const hiss = filt(whiteNoise(n, rng), 'hp', 8000);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const e = 0.05 * Math.sin(Math.PI * clamp(t / 0.7, 0, 1));
    dry.L[i] += hiss[i] * e;
    dry.R[i] += hiss[(i + 97) % n] * e;
  }
  const wet = freeverb(dry, { room: 0.78, damp: 0.2 });
  const out = stereoN(n);
  addStereo(out, dry, 0, 1);
  addStereo(out, wet, 0, 0.45);
  return fadeOutRange(out, 0.72, dur);
}

// Digital glitch: sample-and-hold noise, bit-crushed tones and buzz, chopped
// into short segments with stutter repeats and random panning.
function sfxGlitch({ seed = 512 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.4);
  const out = stereoN(n);
  const makeSeg = (len, type) => {
    const y = new Float64Array(len);
    if (type === 'sh') {
      const hold = rng.int(8, 120);
      let v = 0;
      for (let i = 0; i < len; i++) {
        if (i % hold === 0) v = rng.bi();
        y[i] = v;
      }
    } else if (type === 'crush') {
      const f = rng.range(200, 2000);
      const hold = rng.int(6, 20);
      const levels = 2 ** rng.int(2, 3);
      let v = 0;
      for (let i = 0; i < len; i++) {
        if (i % hold === 0) v = Math.round(Math.sin((TAU * f * i) / SR) * levels) / levels;
        y[i] = v;
      }
    } else {
      const f = rng.range(60, 120);
      for (let i = 0; i < len; i++) {
        const p = ((f * i) / SR) % 1;
        y[i] = Math.round((p < 0.5 ? 1 : -1) * (0.6 + 0.4 * Math.sin(TAU * 7 * f * (i / SR))) * 4) / 4;
      }
    }
    const r = Math.min(15, len >> 2); // 0.3 ms edges
    for (let i = 0; i < r; i++) {
      y[i] *= i / r;
      y[len - 1 - i] *= i / r;
    }
    return y;
  };
  let t = 0;
  let prev = null;
  const types = ['sh', 'crush', 'buzz'];
  while (t < 0.36) {
    let seg;
    let reps = 1;
    if (prev && rng.chance(0.35)) {
      seg = prev;
      reps = rng.int(2, 3);
    } else {
      seg = makeSeg(samples(rng.range(0.018, 0.05)), types[rng.int(0, 2)]);
    }
    const pan = rng.range(-0.7, 0.7);
    const g = t === 0 ? 1 : rng.range(0.5, 1);
    for (let r = 0; r < reps && t < 0.37; r++) {
      addMono(out, seg, t, g * (r ? 0.85 : 1), pan);
      t += seg.length / SR;
    }
    prev = seg;
    if (rng.chance(0.3)) t += rng.range(0.008, 0.03); // short gap
  }
  filtStereo(out, 'hp', 80);
  return fadeOutRange(out, 0.385, 0.4);
}

function sfxRiser() {
  return riser({ dur: 2.0, fStart: 250, fEnd: 10000, toneFrom: 110, toneTo: 880, toneAmt: 0.45, curve: 2.2, seed: 513 });
}

const SFX = [
  ['whoosh.wav', 0.6, () => sfxWhoosh()],
  ['whoosh-short.wav', 0.35, () => sfxWhoosh({ dur: 0.35, fLo: 800, fPeak: 7000, fEnd: 2000, peakAt: 0.45, q: 1.3, panFrom: -0.6, panTo: 0.7, seed: 502 })],
  ['pop.wav', 0.15, () => sfxPop()],
  ['click.wav', 0.08, () => sfxClick()],
  ['key.wav', 0.06, () => sfxKey()],
  ['typing.wav', 1.2, () => sfxTyping()],
  ['cut.wav', 0.25, () => sfxCut()],
  ['impact.wav', 1.5, () => sfxImpact()],
  ['scratch.wav', 0.5, () => scratchFx({ seed: 91 })],
  ['ding.wav', 0.9, () => sfxDing()],
  ['sparkle.wav', 0.9, () => sfxSparkle()],
  ['glitch.wav', 0.4, () => sfxGlitch()],
  ['riser.wav', 2.0, () => sfxRiser()],
];

// ----------------------------------------------------------------------------
// Master bus: stem sum -> 25 Hz high-pass -> soft clip -> look-ahead limiter ->
// loudness targeting (iterated) -> end fade (digital silence from 44.85 s).
// ----------------------------------------------------------------------------
const MIX = { drums: 1.0, bass: 0.72, keys: 1.8, arp: 2.8, fx: 1.0, crackle: 1.0, verb: 1.0 };
const TARGET_RMS_DB = -14; // integrated over the two groove sections
const CEILING_DB = -1.2;
const GROOVE = [
  [DROP1, BREAK],
  [DROP2, FINAL],
];
const FADE = [43.4, 44.85];

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

function master(stems) {
  const N = stems.drums.L.length;
  const mix = stereoN(N);
  for (const [k, g] of Object.entries(MIX)) addStereo(mix, stems[k], 0, g);
  filtStereo(mix, 'hp', 25, 0.7);
  mix.L = highShelf(mix.L, 5000, 2.5);
  mix.R = highShelf(mix.R, 5000, 2.5);
  let pre = 1;
  let result = null;
  for (let iter = 0; iter < 6; iter++) {
    const out = stereoN(N);
    for (let i = 0; i < N; i++) {
      out.L[i] = softClip(mix.L[i] * pre, 0.7);
      out.R[i] = softClip(mix.R[i] * pre, 0.7);
    }
    const { maxReductionDb } = limiter(out, { ceilingDb: CEILING_DB });
    fadeOutRange(out, FADE[0], FADE[1]);
    const rmsDb = gainToDb(rmsOf(out, GROOVE));
    result = { out, preDb: gainToDb(pre), maxReductionDb, rmsDb };
    if (Math.abs(rmsDb - TARGET_RMS_DB) < 0.05) break;
    pre *= dbToGain(TARGET_RMS_DB - rmsDb);
  }
  return result;
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
const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(2) : '-inf');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

// ITU-R BS.1770 K-weighting (its two 48 kHz biquads) for loudness-style numbers.
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
// Ungated BS.1770 loudness (LUFS-like) of a K-weighted buffer over time ranges.
const loudnessOf = (kbuf, ranges) => -0.691 + 10 * Math.log10(2 * rmsOf(kbuf, ranges) ** 2 + 1e-20);

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
  return {
    w,
    peakDb: gainToDb(peak),
    rmsDb: gainToDb(Math.sqrt(sq / (2 * w.frames))),
    dcPct: (Math.max(Math.abs(sumL), Math.abs(sumR)) / w.frames) * 100,
    bad,
  };
}

function verifyMusic(path) {
  const { w } = fileStats(path);
  const [L, R] = w.ch;
  const buf = { L, R };
  const n = w.frames;
  // prefix sums of the per-frame mean square for O(1) window RMS
  const P = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) P[i + 1] = P[i] + (L[i] * L[i] + R[i] * R[i]) / 2;
  const win = (a, b) => {
    const i0 = clamp(Math.round(a * SR), 0, n);
    const i1 = clamp(Math.round(b * SR), 0, n);
    return i1 > i0 ? Math.sqrt((P[i1] - P[i0]) / (i1 - i0)) : 0;
  };
  const jumpDb = (t) => gainToDb(win(t, t + 0.05) / Math.max(1e-9, win(t - 0.15, t)));

  const kbuf = kWeight(buf);
  console.log('\nmusic.wav sections:');
  const sections = [
    ['intro', 0, 5],
    ['groove A', 5, 20],
    ['break/build', 20, 22.5],
    ['groove B', 22.5, 42.5],
    ['final + tail', 42.5, 45],
  ];
  for (const [name, a, b] of sections) {
    let pk = 0;
    for (let i = Math.round(a * SR); i < Math.min(n, Math.round(b * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    console.log(
      `  ${pad(name, 13)} ${padL(a.toFixed(1), 5)}-${pad(b.toFixed(1), 5)} RMS ${padL(fmtDb(gainToDb(rmsOf(buf, [[a, b]]))), 7)} dBFS` +
        `   peak ${padL(fmtDb(gainToDb(pk)), 7)} dBFS   ~${fmtDb(loudnessOf(kbuf, [[a, b]]))} LUFS (ungated)`
    );
  }
  console.log(`  groove sections integrated RMS: ${fmtDb(gainToDb(rmsOf(buf, GROOVE)))} dBFS, ~${fmtDb(loudnessOf(kbuf, GROOVE))} LUFS`);

  // Spectral balance snapshot of groove B (mid channel, 4th-order band splits)
  {
    const i0 = Math.round(DROP2 * SR);
    const i1 = Math.round(FINAL * SR);
    const mid = new Float64Array(i1 - i0);
    for (let i = i0; i < i1; i++) mid[i - i0] = (L[i] + R[i]) / 2;
    const ms = (x) => x.reduce((s, v) => s + v * v, 0) / x.length;
    const total = ms(mid);
    const bands = [
      [20, 60, 'sub'],
      [60, 150, 'bass'],
      [150, 500, 'low-mid'],
      [500, 2000, 'mid'],
      [2000, 6000, 'hi-mid'],
      [6000, 20000, 'air'],
    ];
    const parts = bands.map(([lo, hi, label]) => {
      const b = filt(filt(filt(filt(mid, 'hp', lo), 'hp', lo), 'lp', hi), 'lp', hi);
      return `${label} ${fmtDb(10 * Math.log10(ms(b) / total))}`;
    });
    console.log(`  groove B band energy (dB rel. total): ${parts.join(', ')}`);
  }

  console.log('\nOnset check (RMS of the 50 ms after t vs the 150 ms before t):');
  for (const [label, t] of [
    ['drop 1', DROP1],
    ['drop 2', DROP2],
    ['final hit', FINAL],
  ]) {
    const secChange = gainToDb(win(t, t + 1) / Math.max(1e-9, win(t - 1, t)));
    console.log(`  ${pad(label, 10)} t=${t.toFixed(3)} s  onset jump ${padL('+' + jumpDb(t).toFixed(1), 6)} dB   1 s before->after ${padL((secChange >= 0 ? '+' : '') + secChange.toFixed(1), 6)} dB`);
  }
  // Strongest onsets of the whole track by energy flux (power after - power
  // before, relative to the track's mean power), 5 ms hop, 250 ms suppression.
  const meanPow = P[n] / n;
  const flux = (t) => (win(t, t + 0.05) ** 2 - win(t - 0.15, t) ** 2) / meanPow;
  const cands = [];
  for (let k = 40; k < 8980; k++) cands.push([k * 0.005, flux(k * 0.005)]);
  const picked = [];
  for (const c of cands.sort((a, b) => b[1] - a[1])) {
    if (picked.every((p) => Math.abs(p[0] - c[0]) > 0.25)) picked.push(c);
    if (picked.length >= 6) break;
  }
  console.log('  strongest onsets (energy flux x mean power): ' + picked.map(([t, f]) => `${t.toFixed(3)} s (${f.toFixed(1)}x)`).join(', '));
  const grooveFlux = cands.filter(([t]) => t > DROP1 + 0.3 && t < BREAK - 0.1).map(([, f]) => f);
  console.log(`  flux at drop 1 = ${flux(DROP1).toFixed(1)}x, drop 2 = ${flux(DROP2).toFixed(1)}x (largest groove-A kick onset: ${Math.max(...grooveFlux).toFixed(1)}x)`);

  let tailPk = 0;
  for (let i = Math.round(44.9 * SR); i < n; i++) tailPk = Math.max(tailPk, Math.abs(L[i]), Math.abs(R[i]));
  console.log(`\nLast 0.1 s (44.9-45.0 s) peak: ${tailPk === 0 ? 'digital silence (all samples 0)' : fmtDb(gainToDb(tailPk)) + ' dBFS'}`);

  const bars = [];
  for (let b = 0; b < 18; b++) bars.push(fmtDb(gainToDb(win(b * BAR, (b + 1) * BAR))));
  console.log('RMS per bar (dBFS): ' + bars.join(' | '));

  let m2 = 0;
  let s2 = 0;
  for (let i = Math.round(DROP2 * SR); i < Math.round(FINAL * SR); i++) {
    m2 += ((L[i] + R[i]) / 2) ** 2;
    s2 += ((L[i] - R[i]) / 2) ** 2;
  }
  console.log(`Stereo width in groove B: side/mid = ${fmtDb(10 * Math.log10(s2 / m2))} dB`);
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
function main() {
  const t0 = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  const stems = renderMusic();
  const m = master(stems);
  writeWav(join(OUT_DIR, 'music.wav'), m.out);
  console.log(`music.wav: pre-gain ${m.preDb.toFixed(2)} dB, limiter max reduction ${m.maxReductionDb.toFixed(2)} dB, groove RMS ${m.rmsDb.toFixed(2)} dBFS`);
  const sum = stereoN(stems.drums.L.length);
  for (const [k, g] of Object.entries(MIX)) addStereo(sum, stems[k], 0, g);
  const mixK = rmsOf(kWeight(sum), [[DROP2, FINAL]]);
  console.log(
    'stem loudness in groove B (K-weighted, dB relative to the full mix): ' +
      Object.keys(MIX)
        .map((k) => `${k} ${fmtDb(gainToDb((MIX[k] * rmsOf(kWeight(stems[k]), [[DROP2, FINAL]])) / mixK))}`)
        .join(', ')
  );

  for (const [name, len, gen] of SFX) {
    let buf = fitLength(gen(), samples(len));
    filtStereo(buf, 'hp', 20, 0.7); // DC / infrasonic guard
    if (name !== 'riser.wav') fadeOutRange(buf, len - 0.003, len); // declick after the filter
    normalizePeak(buf, -3);
    writeWav(join(OUT_DIR, name), buf);
  }

  console.log('\nVerification (every file re-read from disk):');
  console.log(pad('file', 18) + padL('dur (s)', 9) + padL('rate', 7) + padL('ch', 4) + padL('bits', 5) + padL('peak dBFS', 11) + padL('RMS dBFS', 10) + padL('DC %', 8) + padL('bad', 5));
  const problems = [];
  for (const name of ['music.wav', ...SFX.map((s) => s[0])]) {
    const s = fileStats(join(OUT_DIR, name));
    const { w } = s;
    console.log(
      pad(name, 18) +
        padL(w.duration.toFixed(4), 9) +
        padL(w.sampleRate, 7) +
        padL(w.channels, 4) +
        padL(w.bits, 5) +
        padL(fmtDb(s.peakDb), 11) +
        padL(fmtDb(s.rmsDb), 10) +
        padL(s.dcPct.toFixed(3), 8) +
        padL(s.bad, 5)
    );
    if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16) problems.push(`${name}: wrong format`);
    if (s.bad) problems.push(`${name}: non-finite samples`);
    if (s.dcPct > 0.5) problems.push(`${name}: DC offset ${s.dcPct.toFixed(3)}%`);
    if (name === 'music.wav') {
      if (Math.abs(w.duration - SONG_SEC) > 0.001) problems.push('music.wav: duration off');
      if (s.peakDb > -1.0) problems.push('music.wav: peak above -1 dBFS');
    }
    const want = name === 'music.wav' ? SONG_SEC : SFX.find((x) => x[0] === name)[1];
    if (Math.abs(w.duration - want) > 0.001) problems.push(`${name}: duration ${w.duration} != ${want}`);
  }
  verifyMusic(join(OUT_DIR, 'music.wav'));
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / DC checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT_DIR}`);
  if (problems.length) process.exitCode = 1;
}

main();
