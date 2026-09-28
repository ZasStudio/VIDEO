// =============================================================================
// scripts/audio/instruments.mjs - synthesized instruments (all plain math).
// Mono voices return Float64Array, stereo voices return { L, R }.
// =============================================================================

import {
  SR,
  TAU,
  clamp,
  mtof,
  samples,
  smoothstep,
  expInterp,
  cents,
  makeRng,
  stereoN,
  addMono,
  normalizePeak,
  normMono,
  tailFade,
  headFade,
  filt,
  SVF,
  Osc,
  whiteNoise,
  sat,
} from './dsp.mjs';

// ----------------------------------------------------------------------------
// Drums
// ----------------------------------------------------------------------------

// Punchy kick: sine with a fast pitch drop (f0 -> f1), click, saturation.
export function kick({ f0 = 165, f1 = 52, pitchTau = 0.028, decay = 0.19, len = 0.5, click = 0.45, drive = 2.0, seed = 11 } = {}) {
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
      y[i] += click * Math.min(1, t / 0.0002) * (0.5 * rng.bi() * Math.exp(-t / 0.0007) + 0.6 * Math.sin(TAU * 3200 * t) * Math.exp(-t / 0.0012));
    }
  }
  for (let i = 0; i < n; i++) y[i] = sat(y[i], drive);
  return normMono(tailFade(y, 0.02));
}

// Snare: two pitched body modes + band-limited noise (snappy attack + tail).
export function snare({ tone = 190, bodyDecay = 0.07, noiseDecay = 0.15, len = 0.45, bodyAmt = 0.6, noiseAmt = 1.0, seed = 21 } = {}) {
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
export function clap({ tail = 0.09, len = 0.4, center = 1400, seed = 31 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const nz = filt(filt(whiteNoise(n, rng), 'bp', center, 1.1), 'hp', 700);
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
    for (const [tb, a] of bursts) if (t >= tb) e = Math.max(e, a * Math.min(1, (t - tb) / 0.0003) * Math.exp(-(t - tb) / 0.0045));
    if (t >= 0.031) e = Math.max(e, 0.55 * Math.exp(-(t - 0.031) / tail));
    y[i] = nz[i] * e;
  }
  return normMono(tailFade(y, 0.02));
}

// Hi-hat: six detuned square "metal" oscillators (808 ratios) + noise, band-passed high.
export const HAT_FREQS = [205.3, 304.4, 369.6, 522.7, 540.0, 800.0];
export function hat({ open = false, tone = 1, decay = null, len = null, seed = 41 } = {}) {
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

// Shaker / chajchas: grainy band-passed noise with a soft (seed-rattle) attack.
export function shaker({ len = 0.1, attack = 0.007, decay = 0.03, tone = 1, seed = 61 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const src = new Float64Array(n);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (i % 11 === 0) g = 0.35 + 0.65 * rng.next() ** 2; // individual seeds hitting the shell
    src[i] = rng.bi() * g;
  }
  const y = filt(filt(src, 'bp', 7200 * tone, 0.9), 'hp', 4200 * tone, 0.7);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] *= t < attack ? Math.sin((Math.PI / 2) * (t / attack)) ** 2 : Math.exp(-(t - attack) / decay);
  }
  return normMono(tailFade(y, 0.01));
}

// Tom (also used as a bombo-like floor drum): pitch-dropping sine + overtone + noise skin.
export function tom({ f0 = 140, f1 = 95, pitchTau = 0.05, decay = 0.28, len = 0.7, noiseAmt = 0.35, drive = 1.6, seed = 71 } = {}) {
  const rng = makeRng(seed);
  const n = samples(len);
  const nz = filt(whiteNoise(n, rng), 'lp', 2500, 0.7);
  const y = new Float64Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = f1 + (f0 - f1) * Math.exp(-t / pitchTau);
    p1 += (TAU * f) / SR;
    p2 += (TAU * f * 1.58) / SR;
    const body = Math.sin(p1) * Math.exp(-t / decay) + 0.25 * Math.sin(p2) * Math.exp(-t / (decay * 0.35));
    y[i] = sat(Math.min(1, t / 0.0008) * (body + noiseAmt * nz[i] * Math.exp(-t / 0.012)), drive);
  }
  return normMono(tailFade(y, 0.03));
}

// Crash cymbal (stereo, decorrelated noise per side + shared metallic partials).
export function crash({ decay = 1.1, len = 3, bright = 1, seed = 51 } = {}) {
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
export function reverseCymbal(dur, seed = 57) {
  const c = crash({ decay: dur * 0.45, len: dur, seed });
  const out = stereoN(c.L.length);
  for (let i = 0; i < c.L.length; i++) {
    out.L[i] = c.L[c.L.length - 1 - i];
    out.R[i] = c.R[c.R.length - 1 - i];
  }
  headFade(out.L, 0.02);
  headFade(out.R, 0.02);
  tailFade(out.L, 0.003);
  tailFade(out.R, 0.003);
  return out;
}

// Cinematic sub boom: sine gliding f0 -> f1 with long decay + low-passed noise burst.
export function impactBoom({ f0 = 70, f1 = 30, glideTau = 0.25, decay = 0.55, len = 1.5, noiseAmt = 0.45, noiseDecay = 0.09, drive = 1.4, seed = 61 } = {}) {
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
      y[i] = sat(body[i] + nz[i] * noiseAmt * Math.min(1, t / 0.0005) * Math.exp(-t / noiseDecay), drive);
    }
    out[c] = tailFade(y, 0.04);
  });
  return normalizePeak(out, 0);
}

// Riser: band-passed noise sweeping up (decorrelated L/R = width) + a rising
// tone (sine + phase-locked saws), swelling to its peak exactly at the end
// (only a 1.5 ms declick, no tail).
export function riser({ dur = 2, fStart = 300, fEnd = 9000, toneFrom = 110, toneTo = 880, toneAmt = 0.35, sawAmt = 1, noiseAmt = 1, curve = 2.2, endBoost = 0, seed = 71 } = {}) {
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
      const a = (0.015 + 0.985 * (0.7 * Math.pow(p, curve) + 0.3 * Math.pow(p, 10))) * (1 + endBoost * Math.pow(p, 80)); // extra swell into the end
      y[i] = (nz[i] * noiseAmt + toneF[i] * toneAmt) * a;
    }
    out[c] = tailFade(y, 0.0015);
  });
  return normalizePeak(out, 0);
}

// ----------------------------------------------------------------------------
// Bass: sine body + enveloped low-passed saw ("warm pluck"), optional glide.
// ----------------------------------------------------------------------------
export function bassNote(midi, dur, vel = 1, { cutoff = 420, env = 1400, envTau = 0.08, sawAmt = 0.5, release = 0.035, glideFrom = null, glideTime = 0.06, drive = 1.6, seed = 81 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + release + 0.004);
  const f0 = mtof(midi);
  const fg = glideFrom != null ? mtof(glideFrom) : f0;
  const oSaw = new Osc(rng.next());
  const sub = new Float64Array(n);
  const saw = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = glideFrom != null && t < glideTime ? expInterp(fg, f0, smoothstep(t / glideTime)) : f0;
    ph += (TAU * f) / SR;
    sub[i] = Math.sin(ph);
    saw[i] = oSaw.saw(f);
  }
  const sawF = filt(saw, 'lp', (t) => cutoff + env * vel * Math.exp(-t / envTau), 0.9);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let a = Math.min(1, t / 0.004) * (0.8 + 0.2 * Math.exp(-t / 0.15));
    if (t > dur) a *= Math.max(0, 1 - (t - dur) / release);
    y[i] = sat((sub[i] + sawAmt * sawF[i]) * a * vel, drive);
  }
  return y;
}

// ----------------------------------------------------------------------------
// Karplus-Strong plucked string with a tuned (allpass) fractional delay,
// brightness-controlled loop filter, pick-position comb and note-off damping.
// ----------------------------------------------------------------------------
export function ksPluck(freq, dur, { vel = 1, bright = 0.6, t60 = 1.0, pick = 0.2, damp = 0.05, seed = 91 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + damp * 7 + 0.005);
  const P = SR / freq;
  const b = clamp(0.5 - 0.44 * bright, 0.04, 0.5); // loop low-pass: (1-b) x[n] + b x[n-1], phase delay ~ b
  const total = P - b;
  const N = Math.max(2, Math.floor(total - 0.25));
  const d = total - N; // allpass fractional delay in [0.25, 1.25)
  const c = (1 - d) / (1 + d);
  const rho = Math.pow(10, -3 / (t60 * freq)); // loop gain for the requested T60
  const excLen = Math.max(4, Math.round(P));
  const raw = new Float64Array(excLen);
  let mean = 0;
  for (let i = 0; i < excLen; i++) {
    raw[i] = rng.bi();
    mean += raw[i];
  }
  mean /= excLen;
  for (let i = 0; i < excLen; i++) raw[i] -= mean;
  const exLP = filt(raw, 'lp', 1200 + 10000 * bright * (0.4 + 0.6 * vel), 0.6);
  const pd = Math.max(1, Math.round(pick * P));
  const exc = new Float64Array(excLen);
  for (let i = 0; i < excLen; i++) exc[i] = exLP[i] - (i >= pd ? 0.9 * exLP[i - pd] : 0);
  const line = new Float64Array(N);
  const y = new Float64Array(n);
  const ns = Math.round(dur * SR);
  const dampK = Math.exp(-1 / (damp * SR));
  let idx = 0;
  let vPrev = 0;
  let apx = 0;
  let apy = 0;
  let g = 1;
  for (let i = 0; i < n; i++) {
    const v = line[idx];
    const lp = (1 - b) * v + b * vPrev;
    vPrev = v;
    const ap = c * lp + apx - c * apy;
    apx = lp;
    apy = ap;
    const out = (i < excLen ? exc[i] : 0) + rho * ap;
    line[idx] = out;
    if (++idx >= N) idx = 0;
    if (i >= ns) g *= dampK;
    y[i] = out * g;
  }
  headFade(y, 0.0008);
  tailFade(y, 0.004);
  return normMono(y, vel);
}

// One charango course: two detuned strings (panned apart = width), optional octave string.
export function charangoNote(midi, dur, { vel = 1, bright = 0.62, t60 = 0.9, spread = 0.45, octave = 0, seed = 700 } = {}) {
  const f = mtof(midi);
  const a = ksPluck(f * cents(3), dur, { vel, bright, t60, pick: 0.17, seed });
  const b = ksPluck(f * cents(-3), dur, { vel: vel * 0.9, bright, t60: t60 * 0.95, pick: 0.23, seed: seed + 1 });
  const lag = 0.0016;
  const out = stereoN(Math.max(a.length, b.length + samples(lag)) + 2);
  addMono(out, a, 0, 0.6, -spread);
  addMono(out, b, lag, 0.6, spread);
  if (octave > 0) {
    const o = ksPluck(f * 2 * cents(1.5), dur, { vel: vel * octave, bright: Math.min(1, bright + 0.1), t60: t60 * 0.7, pick: 0.21, seed: seed + 2 });
    addMono(out, o, 0.0008, 0.6, 0);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Pad: detuned saws per note (different detune sets per side = width) through
// a (possibly swept) low-pass, soft attack/release.
// ----------------------------------------------------------------------------
export function padChord(midis, dur, { attack = 0.35, release = 0.6, cutoff = 1800, q = 0.7, detune = 10, voices = 3, seed = 401 } = {}) {
  const rng = makeRng(seed);
  const n = samples(dur + release);
  const out = stereoN(n);
  for (const c of ['L', 'R']) {
    const src = new Float64Array(n);
    for (const m of midis) {
      const f = mtof(m);
      for (let v = 0; v < voices; v++) {
        const spread = voices > 1 ? (2 * v) / (voices - 1) - 1 : 0;
        const fv = f * cents(spread * detune + rng.range(-2.5, 2.5));
        const o = new Osc(rng.next());
        for (let i = 0; i < n; i++) src[i] += o.saw(fv);
      }
    }
    const y = filt(src, 'lp', cutoff, q);
    const norm = 1 / (midis.length * voices);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      let a = t < attack ? Math.sin((Math.PI / 2) * (t / attack)) ** 2 : 1;
      if (t > dur) a *= Math.cos((Math.PI / 2) * Math.min(1, (t - dur) / release)) ** 2;
      y[i] *= a * norm;
    }
    out[c] = y;
  }
  return out;
}

// ----------------------------------------------------------------------------
// Pan flute / quena: one continuous monophonic breath per phrase.
// Sine core with weak (mostly odd, closed-pipe) harmonics, band-passed breath
// noise that follows the pitch, an airy noise layer, a "chiff" at each tongued
// onset, delayed vibrato (pitch + breath), short pitch scoops and slurs.
// notes: [{ t, dur, midi, vel = 0.9, scoop = 0 (semitones), fall = 0 }] (seconds)
// Returns { t0, y } (mono, starts at the first note).
// ----------------------------------------------------------------------------
export function fluteLine(notes, { breath = 1, vibDepth = 0.2, vibRate = 5.3, tone = 1, legato = 0.03, attack = 0.028, release = 0.055, seed = 301 } = {}) {
  const rng = makeRng(seed);
  const ns = [...notes].sort((a, b) => a.t - b.t);
  const t0 = ns[0].t;
  const last = ns[ns.length - 1];
  const n = samples(last.t + last.dur - t0 + 0.45);
  const pitch = new Float64Array(n);
  const target = new Float64Array(n);
  const vibAmt = new Float64Array(n);
  const chiff = new Float64Array(n);
  const dip = new Float64Array(n).fill(1);

  let prevMidi = ns[0].midi;
  let prevEnd = -1;
  for (let k = 0; k < ns.length; k++) {
    const nt = ns[k];
    const vel = nt.vel ?? 0.9;
    const scoop = nt.scoop ?? 0;
    const fall = nt.fall ?? 0;
    const s0 = Math.round((nt.t - t0) * SR);
    const s1 = Math.min(n, Math.round((nt.t + nt.dur - t0) * SR));
    const holdEnd = k + 1 < ns.length ? Math.min(n, Math.round((ns[k + 1].t - t0) * SR)) : n;
    const legatoIn = k > 0 && nt.t - prevEnd <= legato;
    const vibScale = clamp((nt.dur - 0.18) / 0.35, 0.2, 1);
    for (let i = s0; i < Math.max(holdEnd, s1); i++) {
      if (i >= n) break;
      const u = (i - s0) / SR;
      let p = nt.midi;
      if (scoop > 0) {
        const x = u / 0.075;
        if (x < 1) p -= scoop * Math.pow(1 - x, 3);
      } else if (legatoIn) {
        p = prevMidi + (nt.midi - prevMidi) * smoothstep(u / 0.02);
      } else if (u < 0.035) {
        p -= 0.3 * Math.pow(1 - u / 0.035, 2); // natural breath-onset scoop
      }
      if (fall > 0 && u > nt.dur - 0.08) p -= fall * smoothstep((u - (nt.dur - 0.08)) / 0.2);
      pitch[i] = p;
      vibAmt[i] = vibDepth * vibScale * smoothstep((u - 0.12) / 0.28);
      if (i < s1) target[i] = vel * (nt.dur > 0.45 ? 0.93 + 0.1 * Math.sin(Math.PI * clamp(u / nt.dur, 0, 1)) : 1);
    }
    // chiff (air turbulence) at every onset, stronger after a rest
    const ca = (legatoIn ? 0.3 : 0.65) * vel;
    for (let i = s0; i < Math.min(n, s0 + samples(0.07)); i++) chiff[i] += ca * Math.exp(-(i - s0) / SR / 0.013);
    // tongue articulation dip for slurred/legato notes
    if (legatoIn && !scoop) {
      const a = s0 - samples(0.008);
      const b = s0 + samples(0.018);
      for (let i = Math.max(0, a); i < Math.min(n, b); i++) {
        const x = (i - a) / (b - a);
        dip[i] = Math.min(dip[i], 1 - 0.4 * Math.sin(Math.PI * x) ** 2);
      }
    }
    prevMidi = nt.midi;
    prevEnd = nt.t + nt.dur;
  }

  const y = new Float64Array(n);
  const bp1 = new SVF(440, 7);
  const bp3 = new SVF(1320, 5);
  const airHP = new SVF(1800, 0.7);
  const airLP = new SVF(6500, 0.7);
  const chiffBP = new SVF(3000, 1.0);
  const kA = 1 - Math.exp(-1 / (attack * SR));
  const kR = 1 - Math.exp(-1 / (release * SR));
  let env = 0;
  let ph = 0;
  let vibPh = rng.next() * TAU;
  let drift = 0;
  let driftTarget = 0;
  let f = mtof(pitch[0]);
  let nbGain = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    vibPh += (TAU * vibRate * (1 + 0.035 * Math.sin(TAU * 0.37 * t))) / SR;
    if ((i & 1023) === 0) driftTarget = rng.bi() * 0.05; // +-5 cents slow wander
    drift += (driftTarget - drift) * 0.0004;
    const vib = vibAmt[i] * Math.sin(vibPh);
    f = mtof(pitch[i] + vib + drift);
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    const tg = target[i];
    env += (tg - env) * (tg > env ? kA : kR);
    const a = env * dip[i];
    const trem = 1 + (vibDepth > 0 ? (0.1 * vibAmt[i]) / vibDepth : 0) * Math.sin(vibPh - 0.6);
    const br = tone * (0.55 + 0.45 * Math.min(1, a));
    const x = TAU * ph;
    const s =
      Math.sin(x) +
      br * (0.06 * Math.sin(2 * x + 0.4) + 0.15 * Math.sin(3 * x + 1.1) + 0.03 * Math.sin(4 * x + 0.2) + 0.055 * Math.sin(5 * x + 2.0) + 0.018 * Math.sin(7 * x + 0.3));
    if ((i & 15) === 0) {
      bp1.set(f, 7);
      bp3.set(Math.min(15000, 3 * f), 5);
      chiffBP.set(Math.min(9000, 4 * f), 1.0);
      nbGain = 2.6 * Math.sqrt(660 / f);
    }
    const w = rng.bi();
    bp1.tick(w);
    bp3.tick(w);
    airHP.tick(w);
    airLP.tick(airHP.high);
    chiffBP.tick(w);
    const nb1 = bp1.band * bp1.k * nbGain;
    const nb3 = bp3.band * bp3.k * nbGain * 0.6;
    y[i] =
      a * trem * (0.82 * s + breath * (0.52 * nb1 + 0.18 * nb3)) +
      breath * 0.18 * Math.pow(a, 0.8) * airLP.low +
      breath * 0.5 * chiff[i] * chiffBP.band * chiffBP.k;
  }
  return { t0, y: tailFade(y, 0.01) };
}
