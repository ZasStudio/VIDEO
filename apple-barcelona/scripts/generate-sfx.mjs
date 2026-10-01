#!/usr/bin/env node
// =============================================================================
// scripts/generate-sfx.mjs
//
// Subtle, premium sound-effects set for the "apple-barcelona" vlog (v2).
// Client feedback on public/sfx/: "too strong and don't fit the video". This
// set is the opposite: soft, airy, glassy, Apple-like. It supports the motion
// graphics (glassmorphism cards, 3D glass/aluminium MacBook) without masking
// the Spanish voiceover or fighting the D-major ~114 BPM pop bed.
//
// Design rules
//   - No harsh transients: every attack is a raised-cosine ramp (>= 0.4 ms),
//     taps get only a tiny low-passed noise "touch".
//   - Energy mostly below ~6 kHz: noise is low-passed (24 dB/oct) and every
//     tonal partial is weighted by a soft 5 kHz roll-off; the per-file energy
//     share above 6 kHz is measured and must stay < 10 %.
//   - Short, damped reverb only (freeverb room <= 0.68, high damping, HP'd and
//     LP'd wet), no boomy tails; each file ends with a raised-cosine fade.
//   - Tonal elements use D-major pitches only (D, E, F#, A, B).
//   - Every file starts at sample 0 (except swell / rise-soft, which build up
//     and peak at their very end, to be placed right before a cut).
//   - Peak-normalised to -6 dBFS, so they are quiet by default.
//
// Every sound is synthesized from math (no samples, no downloads, zero npm
// deps). Deterministic: all randomness comes from seeded PRNGs (never
// Math.random), so two runs are byte-identical.
//
//   node scripts/generate-sfx.mjs
//
// Writes public/sfx2/*.wav (48 kHz, stereo, 16-bit PCM) and prints a
// verification report computed by re-reading every file from disk.
//
// Files
//   air-in.wav       0.45 s  airy swoosh INTO an interlude (pan L -> R)
//   air-out.wav      0.40 s  darker airy swoosh back to video (pan R -> L)
//   swell.wav        0.80 s  reverse-air swell, peaks at its last sample
//   thump.wav        0.35 s  tight, soft sub thump (no click) for a landing
//   glass-tap.wav    0.40 s  delicate glass ping, A5
//   glass-tap-2.wav  0.40 s  same family, B5
//   glass-tap-3.wav  0.40 s  same family, D6
//   shimmer.wav      1.10 s  gentle rising glass shimmer (D-major pentatonic)
//   tick.wav         0.05 s  very soft UI tick
//   rise-soft.wav    1.20 s  gentle riser (air + faint D/A sweep), peaks at end
//   resolve.wav      1.60 s  warm two-note ending tone A4 -> D5
// =============================================================================

import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'sfx2');

const SR = 48000;
const TAU = Math.PI * 2;
const PEAK_DB = -6.0;
const HF_CUTOFF = 6000; // spectral check: energy share above this frequency
const HF_MAX_SHARE = 0.1;

// ----------------------------------------------------------------------------
// Math helpers (from generate-music.mjs)
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
// Raised-cosine attack ramp: 0 -> 1 over `sec` seconds (no click).
const rcAttack = (t, sec) => (t >= sec ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * t) / sec));
// Soft 4th-order roll-off weight for tonal partials (keeps highs gentle).
const hfWeight = (f, fc = 5000) => 1 / (1 + Math.pow(f / fc, 4));

// D-major pitches (MIDI)
const NOTE = { D4: 62, A4: 69, D5: 74, E5: 76, Fs5: 78, A5: 81, B5: 83, D6: 86, E6: 88, Fs6: 90 };

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
  };
}

// ----------------------------------------------------------------------------
// Buffers. Mono = Float64Array, stereo = { L, R }.
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

const monoToStereo = (x) => ({ L: Float64Array.from(x), R: Float64Array.from(x) });

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

// Very short linear declick over the last `sec` seconds (stereo).
function tailDeclick(buf, sec) {
  const m = Math.min(buf.L.length, samples(sec));
  for (let k = 0; k < m; k++) {
    const g = (k + 1) / (m + 1);
    buf.L[buf.L.length - 1 - k] *= g;
    buf.R[buf.R.length - 1 - k] *= g;
  }
  return buf;
}

// Level a noise signal: divide by its zero-phase smoothed RMS (one-pole,
// forward + backward), so a build envelope applied afterwards is not undone
// by random loudness fluctuations of the noise.
function levelNoise(x, tau = 0.02) {
  const n = x.length;
  const a = 1 - Math.exp(-1 / (tau * SR));
  const ms = new Float64Array(n);
  let s = 0;
  for (let i = 0; i < n; i++) ms[i] = s += (x[i] * x[i] - s) * a;
  s = ms[n - 1];
  for (let i = n - 1; i >= 0; i--) ms[i] = s += (ms[i] - s) * a;
  let ref = 0;
  for (let i = 0; i < n; i++) ref += ms[i];
  ref /= n;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (x[i] * Math.sqrt(ref)) / Math.sqrt(ms[i] + ref * 1e-4);
  return y;
}

// Reverse a stereo buffer.
function reverse(buf) {
  const n = buf.L.length;
  const out = stereoN(n);
  for (let i = 0; i < n; i++) {
    out.L[i] = buf.L[n - 1 - i];
    out.R[i] = buf.R[n - 1 - i];
  }
  return out;
}

// ----------------------------------------------------------------------------
// WAV I/O (RIFF, PCM 16-bit, stereo) - from generate-music.mjs
// ----------------------------------------------------------------------------
function toInt16(x) {
  if (!Number.isFinite(x)) throw new Error('non-finite sample while writing WAV');
  return clamp(Math.round(clamp(x, -1, 1) * 32767), -32768, 32767);
}

function encodeWav(buf) {
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
// DSP building blocks (from generate-music.mjs)
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

// 24 dB/oct Butterworth-ish low-pass (two cascaded SVFs).
const lp4 = (x, fc) => filt(filt(x, 'lp', fc, 0.541), 'lp', fc, 1.307);
function lp4Stereo(buf, fc) {
  buf.L = lp4(buf.L, fc);
  buf.R = lp4(buf.R, fc);
  return buf;
}

// Gentle saturation normalised so that sat(1) === 1.
const sat = (x, drive) => Math.tanh(drive * x) / Math.tanh(drive);

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

// Soft "air" source: mostly pink, a touch of white.
function airNoise(n, rng) {
  const p = pinkNoise(n, rng);
  const w = whiteNoise(n, rng);
  for (let i = 0; i < n; i++) p[i] = p[i] * 0.8 + w[i] * 0.2;
  return p;
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

// Short, dark, band-limited room added to a dry stereo buffer.
function withRoom(dry, { room = 0.55, damp = 0.55, wet = 0.15, hp = 400, lp = 4500 } = {}) {
  const w = freeverb(dry, { room, damp });
  filtStereo(w, 'hp', hp);
  lp4Stereo(w, lp);
  const out = stereoN(dry.L.length);
  addStereo(out, dry, 0, 1);
  addStereo(out, w, 0, wet);
  return out;
}

// ----------------------------------------------------------------------------
// Voices
// ----------------------------------------------------------------------------

// Airy swoosh: low-passed band-swept noise with a smooth asymmetric bell
// envelope and an equal-power pan sweep. `event` = audible body length; the
// file is `dur` long so the short room can tail off naturally.
function airSwoosh({ dur, event, fLo, fPeak, fEnd, peakAt, q, lp, panFrom, panTo, floor = 0.1, wet = 0.12, seed }) {
  const rng = makeRng(seed);
  const n = samples(dur);
  const src = airNoise(n, rng);
  const tp = peakAt * event;
  const fcAt = (t) =>
    t < tp ? expInterp(fLo, fPeak, smoothstep(t / tp)) : expInterp(fPeak, fEnd, smoothstep((t - tp) / (event - tp)));
  const body = filt(src, 'bp', fcAt, q);
  const low = filt(src, 'bp', (t) => fcAt(t) * 0.5, 0.7); // soft lower "breath" layer
  const mono = new Float64Array(n);
  for (let i = 0; i < n; i++) mono[i] = body[i] + 0.35 * low[i];
  const sm = lp4(mono, lp);
  const dry = stereoN(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let env;
    if (t < tp) env = floor + (1 - floor) * Math.pow(Math.sin((Math.PI / 2) * (t / tp)), 2);
    else if (t < event) env = Math.pow(Math.cos((Math.PI / 2) * ((t - tp) / (event - tp))), 1.8);
    else env = 0;
    env *= rcAttack(t, 0.002);
    const [gl, gr] = panGains(lerp(panFrom, panTo, smoothstep(t / event)));
    dry.L[i] = sm[i] * env * gl;
    dry.R[i] = sm[i] * env * gr;
  }
  const out = withRoom(dry, { room: 0.5, damp: 0.6, wet, hp: 500, lp: lp * 0.9 });
  return fadeOutRange(out, dur - 0.05, dur);
}

// Glass tap: inharmonic glass partials (1, 2.32, 4.25, 6.63), fast decays,
// slight L/R detune for life, a tiny low-passed "touch" instead of a click.
function glassTap(f0, { dur = 0.4, seed }) {
  const rng = makeRng(seed);
  const n = samples(dur);
  const parts = [
    [1, 1, 0.12],
    [2.32, 0.32, 0.055],
    [4.25, 0.14, 0.03],
    [6.63, 0.05, 0.017],
  ];
  const touch = lp4(whiteNoise(n, rng), 2600);
  const dry = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const det = ci ? 1.0009 : 0.9991;
    const phs = parts.map(() => rng.next() * TAU);
    const y = dry[c];
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let v = 0;
      parts.forEach(([r, a, tau], k) => {
        const f = f0 * r * (k === 0 ? det : 1);
        v += a * hfWeight(f) * Math.sin(TAU * f * t + phs[k]) * Math.exp(-t / tau);
      });
      v += 0.1 * touch[i] * Math.exp(-t / 0.0015);
      y[i] = v * rcAttack(t, 0.0012);
    }
  });
  const out = withRoom(dry, { room: 0.55, damp: 0.5, wet: 0.2, hp: 600, lp: 5000 });
  lp4Stereo(out, 6500);
  return fadeOutRange(out, dur - 0.08, dur);
}

// Soft glass/bell note for the shimmer: fundamental + octave + a faint
// inharmonic glint, gentle attack.
function softBell(f, { len, decay, attack = 0.006, phase = 0 }) {
  const n = samples(len);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v =
      Math.sin(TAU * f * t + phase) * Math.exp(-t / decay) +
      0.14 * hfWeight(2 * f) * Math.sin(TAU * 2 * f * t) * Math.exp(-t / (decay * 0.4)) +
      0.07 * hfWeight(2.76 * f) * Math.sin(TAU * 2.76 * f * t + 1) * Math.exp(-t / (decay * 0.18));
    y[i] = v * rcAttack(t, attack);
  }
  return y;
}

// Felt-piano / glass-like tone: stretched additive partials with a soft
// roll-off, two-stage decay (high partials faster), felt attack, a warm
// sub-octave and a faint glass glint.
function feltNote(f, { len, decay = 0.45, attack = 0.005, seed }) {
  const rng = makeRng(seed);
  const n = samples(len);
  const y = new Float64Array(n);
  const B = 0.00035;
  const parts = [];
  for (let k = 1; k <= 7; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    const amp = (1 / Math.pow(k, 1.8)) * hfWeight(fk, 3500) * (0.6 + 0.4 * Math.abs(Math.sin(Math.PI * k * 0.13)));
    const tau = decay / (1 + 0.45 * (k - 1));
    parts.push([fk, amp, tau, rng.next() * TAU]);
  }
  parts.push([f * 0.5, 0.22, decay * 0.9, 0]); // warmth
  parts.push([f * 2.76, 0.035, 0.06, 1]); // glass glint
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (const [fk, a, tau, ph] of parts) {
      v += a * Math.sin(TAU * fk * t + ph) * (0.72 * Math.exp(-t / tau) + 0.28 * Math.exp(-t / (tau * 2.6)));
    }
    y[i] = v * rcAttack(t, attack);
  }
  return y;
}

// ----------------------------------------------------------------------------
// SFX (each returns a stereo buffer, starting at sample 0)
// ----------------------------------------------------------------------------

function sfxAirIn() {
  return airSwoosh({
    dur: 0.45, event: 0.38, fLo: 600, fPeak: 2300, fEnd: 1300, peakAt: 0.45, q: 0.85,
    lp: 5200, panFrom: -0.55, panTo: 0.55, seed: 7101,
  });
}

function sfxAirOut() {
  return airSwoosh({
    dur: 0.4, event: 0.33, fLo: 1500, fPeak: 1700, fEnd: 650, peakAt: 0.4, q: 0.8,
    lp: 3800, panFrom: 0.55, panTo: -0.55, floor: 0.12, seed: 7202,
  });
}

// Reverse-air swell: a soft air puff + faint D/A glass tone through a short
// room, reversed (true reverse-reverb character), shaped to peak at the end.
function sfxSwell() {
  const dur = 0.8;
  const n = samples(dur);
  const rng = makeRng(7303);
  // forward event: air puff + faint tones, then room; reversed afterwards
  const fwd = stereoN(n);
  ['L', 'R'].forEach((c) => {
    const nz = lp4(filt(airNoise(n, rng), 'bp', (t) => expInterp(3200, 500, t / 0.5), 0.7), 4200);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      fwd[c][i] = nz[i] * rcAttack(t, 0.003) * Math.exp(-t / 0.12);
    }
  });
  addMono(fwd, softBell(mtof(NOTE.D5), { len: dur, decay: 0.22, attack: 0.003 }), 0, 0.12, -0.3);
  addMono(fwd, softBell(mtof(NOTE.A5), { len: dur, decay: 0.18, attack: 0.003, phase: 0.7 }), 0, 0.08, 0.3);
  const wet = freeverb(fwd, { room: 0.68, damp: 0.5 });
  filtStereo(wet, 'hp', 250);
  const mix = stereoN(n);
  addStereo(mix, fwd, 0, 1);
  addStereo(mix, wet, 0, 0.6);
  const out = reverse(mix);
  // shape: guarantee a smooth monotone build that peaks in the last instant
  for (let i = 0; i < n; i++) {
    const p = (i + 1) / n;
    const g = 0.7 * Math.pow(p, 2.4) + 0.3 * Math.pow(p, 9);
    out.L[i] *= g;
    out.R[i] *= g;
  }
  lp4Stereo(out, 4800);
  return tailDeclick(out, 0.0008);
}

// Tight soft sub thump: sine with a short downward glide (115 -> 55 Hz, A1),
// raised-cosine attack (no click), a low felt "puff", no reverb.
function sfxThump() {
  const dur = 0.35;
  const n = samples(dur);
  const rng = makeRng(7404);
  const puff = filt(lp4(pinkNoise(n, rng), 260), 'hp', 40);
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 55 + (115 - 55) * Math.exp(-t / 0.028);
    ph += (TAU * f) / SR;
    const body = (Math.sin(ph) + 0.16 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph)) * Math.exp(-t / 0.085);
    const air = 0.35 * puff[i] * Math.exp(-t / 0.022);
    y[i] = sat((body + air) * rcAttack(t, 0.004), 1.15);
  }
  const clean = filt(lp4(y, 1100), 'hp', 28);
  const out = monoToStereo(clean);
  return fadeOutRange(out, 0.26, dur);
}

function sfxGlassTap(midi, seed) {
  return glassTap(mtof(midi), { seed });
}

// Gentle shimmer: rising D-major pentatonic glass notes (D5 .. F#6), soft
// attacks, alternating pan, a faint low-passed air bed, short room.
function sfxShimmer() {
  const dur = 1.1;
  const n = samples(dur);
  const rng = makeRng(7606);
  const dry = stereoN(n);
  const notes = [NOTE.D5, NOTE.Fs5, NOTE.A5, NOTE.B5, NOTE.D6, NOTE.E6, NOTE.Fs6];
  notes.forEach((m, k) => {
    const y = softBell(mtof(m), { len: 0.75, decay: 0.26 - k * 0.012, attack: 0.007, phase: rng.next() * TAU });
    const pan = (k % 2 ? 0.45 : -0.45) * (0.6 + 0.4 * (k / (notes.length - 1)));
    addMono(dry, fadeOutRange(monoToStereo(y), 0.6, 0.75).L, k * 0.072, 0.75 - k * 0.04, pan);
  });
  ['L', 'R'].forEach((c) => {
    const air = lp4(filt(pinkNoise(n, rng), 'bp', 2800, 0.6), 5000);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      dry[c][i] += air[i] * 0.09 * Math.pow(Math.sin(Math.PI * clamp(t / 0.85, 0, 1)), 1.5);
    }
  });
  const out = withRoom(dry, { room: 0.66, damp: 0.5, wet: 0.32, hp: 450, lp: 4800 });
  lp4Stereo(out, 6000);
  return fadeOutRange(out, 0.88, dur);
}

// Very soft UI tick: a tiny A6/D5 sine blip with a felt "touch", 0.4 ms attack.
function sfxTick() {
  const dur = 0.05;
  const n = samples(dur);
  const rng = makeRng(7707);
  const touch = lp4(whiteNoise(n, rng), 3000);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v =
      0.55 * Math.sin(TAU * mtof(93) * t) * Math.exp(-t / 0.0035) + // A6
      0.5 * Math.sin(TAU * mtof(NOTE.D5) * t) * Math.exp(-t / 0.007) +
      0.12 * touch[i] * Math.exp(-t / 0.0008);
    y[i] = v * rcAttack(t, 0.0004);
  }
  const out = monoToStereo(filt(lp4(y, 5000), 'hp', 150));
  return fadeOutRange(out, 0.035, dur);
}

// Gentle riser: low-passed air sweeping up + a faint D/A fifth gliding an
// octave (D4->D5, A4->A5), swelling to its peak exactly at the end.
function sfxRiseSoft() {
  const dur = 1.2;
  const n = samples(dur);
  const fcAt = (t) => expInterp(350, 3000, Math.pow(t / dur, 1.3));
  const qAt = (t) => 0.8 + 1.0 * (t / dur);
  const tone = new Float64Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.pow(i / n, 1.5);
    p1 += (TAU * expInterp(mtof(NOTE.D4), mtof(NOTE.D5), s)) / SR;
    p2 += (TAU * expInterp(mtof(NOTE.A4), mtof(NOTE.A5), s)) / SR;
    tone[i] = 0.65 * Math.sin(p1) + 0.35 * Math.sin(p2);
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const nz = levelNoise(lp4(filt(airNoise(n, makeRng(7808 + ci)), 'bp', fcAt, qAt), 4800));
    const y = out[c];
    for (let i = 0; i < n; i++) {
      const p = (i + 1) / n;
      const a = 0.04 + 0.96 * (0.75 * Math.pow(p, 2.2) + 0.25 * Math.pow(p, 9));
      y[i] = (nz[i] * 1.6 + tone[i] * 0.22 * (ci ? 0.94 : 1)) * a * rcAttack(i / SR, 0.004);
    }
  });
  return tailDeclick(out, 0.0008);
}

// Warm two-note ending tone: A4 then D5 (V -> I), felt-piano / glass timbre,
// short soft room.
function sfxResolve() {
  const dur = 1.6;
  const n = samples(dur);
  const dry = stereoN(n);
  addMono(dry, feltNote(mtof(NOTE.A4), { len: dur, decay: 0.42, seed: 7909 }), 0, 0.75, -0.18);
  addMono(dry, feltNote(mtof(NOTE.D5), { len: dur - 0.2, decay: 0.5, seed: 7910 }), 0.2, 1, 0.18);
  const out = withRoom(dry, { room: 0.64, damp: 0.55, wet: 0.24, hp: 300, lp: 4200 });
  lp4Stereo(out, 5000);
  return fadeOutRange(out, 1.25, dur);
}

const SFX = [
  { file: 'air-in.wav', make: sfxAirIn, buildsToEnd: false },
  { file: 'air-out.wav', make: sfxAirOut, buildsToEnd: false },
  { file: 'swell.wav', make: sfxSwell, buildsToEnd: true },
  { file: 'thump.wav', make: sfxThump, buildsToEnd: false },
  { file: 'glass-tap.wav', make: () => sfxGlassTap(NOTE.A5, 7501), buildsToEnd: false },
  { file: 'glass-tap-2.wav', make: () => sfxGlassTap(NOTE.B5, 7502), buildsToEnd: false },
  { file: 'glass-tap-3.wav', make: () => sfxGlassTap(NOTE.D6, 7503), buildsToEnd: false },
  { file: 'shimmer.wav', make: sfxShimmer, buildsToEnd: false },
  { file: 'tick.wav', make: sfxTick, buildsToEnd: false },
  { file: 'rise-soft.wav', make: sfxRiseSoft, buildsToEnd: true },
  { file: 'resolve.wav', make: sfxResolve, buildsToEnd: false },
];

function render(entry) {
  return encodeWav(normalizePeak(entry.make(), PEAK_DB));
}

// ----------------------------------------------------------------------------
// Verification (on files re-read from disk)
// ----------------------------------------------------------------------------

// In-place iterative radix-2 FFT.
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const ai = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

// Welch power spectrum (Hann, 2048, 75 % overlap, both channels, zero-padded
// when shorter): energy share above `cut` Hz and spectral centroid.
function spectrum(chs, cut) {
  const N = 2048;
  const hop = N / 4;
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((TAU * i) / N));
  const pow = new Float64Array(N / 2 + 1);
  const frames = chs[0].length;
  for (const x of chs) {
    for (let s = 0; s === 0 || s + N <= frames; s += hop) {
      const re = new Float64Array(N);
      const im = new Float64Array(N);
      for (let i = 0; i < N && s + i < frames; i++) re[i] = x[s + i] * win[i];
      fft(re, im);
      for (let k = 0; k <= N / 2; k++) pow[k] += re[k] * re[k] + im[k] * im[k];
    }
  }
  let tot = 0;
  let hi = 0;
  let fw = 0;
  for (let k = 1; k <= N / 2; k++) {
    const f = (k * SR) / N;
    tot += pow[k];
    fw += pow[k] * f;
    if (f > cut) hi += pow[k];
  }
  return { hiShare: tot > 0 ? hi / tot : 0, centroid: tot > 0 ? fw / tot : 0 };
}

function analyze(path, entry) {
  const w = readWav(path);
  const [L, R] = w.ch;
  let peak = 0;
  let peakIdx = 0;
  let sq = 0;
  let bad = 0;
  for (let i = 0; i < w.frames; i++) {
    if (!Number.isFinite(L[i]) || !Number.isFinite(R[i])) bad++;
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) {
      peak = a;
      peakIdx = i;
    }
    sq += L[i] * L[i] + R[i] * R[i];
  }
  // onset: first sample above -40 dB relative to the file peak
  const thr = peak * dbToGain(-40);
  let onset = 0;
  while (onset < w.frames && Math.abs(L[onset]) < thr && Math.abs(R[onset]) < thr) onset++;
  // envelope: 5 ms RMS windows; index of loudest window vs the last window
  const W = samples(0.005);
  const nw = Math.floor(w.frames / W);
  let bestW = 0;
  let bestRms = 0;
  for (let k = 0; k < nw; k++) {
    let s = 0;
    for (let i = k * W; i < (k + 1) * W; i++) s += L[i] * L[i] + R[i] * R[i];
    if (s > bestRms) {
      bestRms = s;
      bestW = k;
    }
  }
  const envPeakFromEndMs = ((w.frames - (bestW + 1) * W) / SR) * 1000;
  const { hiShare, centroid } = spectrum([L, R], HF_CUTOFF);
  const peakDb = gainToDb(peak);
  const checks = {
    format: w.sampleRate === SR && w.channels === 2 && w.bits === 16 && w.format === 1,
    peak: Math.abs(peakDb - PEAK_DB) < 0.2,
    noClip: w.fullScale === 0 && bad === 0,
    onset: entry.buildsToEnd ? true : (onset / SR) * 1000 <= 10,
    endPeak: entry.buildsToEnd ? envPeakFromEndMs < 6 && (w.frames - 1 - peakIdx) / SR < 0.03 : true,
    hf: hiShare < HF_MAX_SHARE,
  };
  return {
    file: entry.file,
    dur: w.duration,
    peakDb,
    rmsDb: gainToDb(Math.sqrt(sq / (2 * w.frames))),
    onsetMs: (onset / SR) * 1000,
    peakFromEndMs: ((w.frames - 1 - peakIdx) / SR) * 1000,
    envPeakFromEndMs,
    hiShare,
    centroid,
    sha: createHash('sha256').update(w.bytes).digest('hex').slice(0, 12),
    ok: Object.values(checks).every(Boolean),
    checks,
  };
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
function main() {
  const t0 = performance.now();
  mkdirSync(OUT_DIR, { recursive: true });
  const written = SFX.map((e) => {
    const bytes = render(e);
    writeFileSync(join(OUT_DIR, e.file), bytes);
    return bytes;
  });
  const genMs = performance.now() - t0;

  // Determinism: render everything a second time in-process and compare bytes.
  const deterministic = SFX.every((e, k) => render(e).equals(written[k]));

  const rows = SFX.map((e) => analyze(join(OUT_DIR, e.file), e));
  const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '-inf');
  console.log(`\npublic/sfx2/  (48 kHz, stereo, 16-bit PCM, peak target ${PEAK_DB} dBFS)\n`);
  console.log(
    'file              dur(s)  peak   rms   onset(ms)  peak->end(ms)  >6kHz   centroid  sha256        ok'
  );
  for (const r of rows) {
    const endInfo = SFX.find((e) => e.file === r.file).buildsToEnd ? `${f(r.envPeakFromEndMs, 1)} env` : '   -';
    console.log(
      `${r.file.padEnd(17)} ${r.dur.toFixed(3).padStart(6)} ${f(r.peakDb).padStart(5)} ${f(r.rmsDb).padStart(6)} ` +
        `${f(r.onsetMs, 2).padStart(9)}  ${endInfo.padStart(13)}  ${(r.hiShare * 100).toFixed(2).padStart(5)}%  ` +
        `${f(r.centroid, 0).padStart(6)} Hz  ${r.sha}  ${r.ok ? 'PASS' : 'FAIL ' + JSON.stringify(r.checks)}`
    );
  }
  const allOk = rows.every((r) => r.ok) && deterministic;
  console.log(`\nin-process re-render byte-identical: ${deterministic ? 'yes' : 'NO'}`);
  console.log(`generation time: ${(genMs / 1000).toFixed(2)} s (render + write of ${SFX.length} files)`);
  console.log(allOk ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED');
  if (!allOk) process.exitCode = 1;
}

main();
