// =============================================================================
// scripts/audio/sfx.mjs - one-shot sound effects and mascot voice blips.
// Every generator returns a stereo buffer; the caller trims/normalises.
// =============================================================================

import {
  SR,
  TAU,
  clamp,
  lerp,
  mtof,
  samples,
  smoothstep,
  expInterp,
  makeRng,
  stereoN,
  addMono,
  addStereo,
  monoToStereo,
  panGains,
  normMono,
  tailFade,
  fadeIn,
  fadeOutRange,
  filt,
  filtStereo,
  freeverb,
  whiteNoise,
  pinkNoise,
  brownNoise,
  sat,
} from './dsp.mjs';
import { riser } from './instruments.mjs';

// Sum of damped sinusoids ("modes"): [freq, amp, decay] with random phases.
function modalHit(n, modes, rng, { attack = 0.0005, scale = 1 } = {}) {
  const y = new Float64Array(n);
  const ph = modes.map(() => rng.next() * TAU);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let v = 0;
    for (let k = 0; k < modes.length; k++) {
      const [f, a, d] = modes[k];
      v += a * Math.sin(TAU * f * scale * t + ph[k]) * Math.exp(-t / d);
    }
    y[i] = v * Math.min(1, t / attack);
  }
  return y;
}

// ---------------------------------------------------------------- impact.wav
// Sub drop 60 -> 28 Hz + distorted mid thump + noise crack + short reverb tail.
export function sfxImpact({ seed = 601 } = {}) {
  const dur = 1.6;
  const n = samples(dur);
  const sub = new Float64Array(n);
  const thump = new Float64Array(n);
  let p1 = 0;
  let p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    p1 += (TAU * (28 + 32 * Math.exp(-t / 0.2))) / SR;
    sub[i] = Math.sin(p1) * Math.min(1, t / 0.002) * (0.6 * Math.exp(-t / 0.75) + 0.4 * Math.exp(-t / 0.2));
    p2 += (TAU * (62 + 90 * Math.exp(-t / 0.03))) / SR;
    thump[i] = Math.tanh(4.5 * Math.sin(p2) * Math.exp(-t / 0.08)) * Math.min(1, t / 0.0008);
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const r = makeRng(seed * 7 + ci);
    const crack = filt(filt(whiteNoise(n, r), 'hp', 900, 0.7), 'lp', (t) => 1800 + 9000 * Math.exp(-t / 0.03), 0.7);
    const body = filt(whiteNoise(n, r), 'lp', 220, 0.8);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      const cr = crack[i] * Math.min(1, t / 0.0004) * (0.9 * Math.exp(-t / 0.018) + 0.25 * Math.exp(-t / 0.12));
      const bd = body[i] * Math.min(1, t / 0.003) * Math.exp(-t / 0.25);
      y[i] = sat(sub[i] * 0.95 + thump[i] * 0.5 + cr * 0.55 + bd * 1.3, 1.3);
    }
    out[c] = y;
  });
  const wet = freeverb(out, { room: 0.78, damp: 0.45 });
  filtStereo(wet, 'hp', 150, 0.7);
  addStereo(out, wet, 0, 0.3);
  return fadeOutRange(out, 1.3, dur);
}

// ------------------------------------------------------ whoosh / whoosh-short
// Band-passed noise sweep (up, then down) with an equal-power pan L -> R.
export function sfxWhoosh({ dur = 0.6, fLo = 300, fPeak = 3500, fEnd = 700, peakAt = 0.55, q = 1.6, panFrom = -0.9, panTo = 0.9, seed = 501 } = {}) {
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

// ------------------------------------------------------------------- pop.wav
// Bubbly pop: fast upward sine chirp with a little "bloop" overtone + tiny click.
export function sfxPop({ seed = 503 } = {}) {
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
    if (t < 0.0015) y[i] += 0.35 * Math.min(1, t / 0.0002) * rng.bi() * Math.exp(-t / 0.0004);
  }
  return monoToStereo(tailFade(y, 0.01));
}

// ------------------------------------------------------------------ ding.wav
// Success chime: bell partials (E6, B6, octave, inharmonic), slight L/R detune.
export function sfxDing({ seed = 510 } = {}) {
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
        v += a * Math.sin(TAU * (f + (ci ? 0.3 : -0.3) * (k < 2 ? 1 : 0)) * t + k * 0.7) * Math.exp(-t / tau); // +-0.3 Hz: no mono null
      });
      y[i] = v * Math.min(1, t / 0.0015);
      if (t < 0.003) y[i] += 0.15 * Math.min(1, t / 0.0003) * rng.bi() * Math.exp(-t / 0.0008);
    }
    out[c] = y;
  });
  return fadeOutRange(out, 0.8, 0.9);
}

// ------------------------------------------------------------------ tick.wav
// Tiny mechanical tick: band-passed noise snap + two short resonances.
export function sfxTick({ seed = 611 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.05);
  const nz = filt(whiteNoise(n, rng), 'bp', 4200, 1.4);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    y[i] =
      Math.min(1, t / 0.00015) *
      (nz[i] * Math.exp(-t / 0.0007) + 0.55 * Math.sin(TAU * 2750 * t) * Math.exp(-t / 0.0035) + 0.3 * Math.sin(TAU * 1250 * t + 0.5) * Math.exp(-t / 0.002));
  }
  return monoToStereo(tailFade(filt(y, 'hp', 300, 0.7), 0.01));
}

// ----------------------------------------------------------------- riser.wav
export function sfxRiser() {
  return riser({ dur: 2.0, fStart: 250, fEnd: 10000, toneFrom: 110, toneTo: 880, toneAmt: 0.45, curve: 2.2, endBoost: 0.6, seed: 513 });
}

// ---------------------------------------------------------------- rumble.wav
// Earthquake: low brown-noise rumble with irregular shaking, a wobbling sub,
// and rattling debris (Poisson grains: small gravel ticks + a few rock knocks).
export function sfxRumble({ seed = 621 } = {}) {
  const dur = 3.0;
  const n = samples(dur);
  const envAt = (t) => smoothstep(t / 0.45) * (1 - smoothstep((t - 2.05) / 0.95)) * (0.82 + 0.18 * Math.sin(TAU * 0.55 * t + 0.3));
  const sub = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (34 + 5 * Math.sin(TAU * 1.3 * t) + 2 * Math.sin(TAU * 3.1 * t + 1))) / SR;
    sub[i] = Math.sin(ph) * (0.65 + 0.35 * Math.sin(TAU * 7.3 * t) * Math.sin(TAU * 2.2 * t + 0.4));
  }
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const r = makeRng(seed * 11 + ci);
    const low = normMono(filt(filt(brownNoise(n, r), 'lp', 140, 0.8), 'hp', 22, 0.7));
    const shake = normMono(filt(filt(whiteNoise(n, r), 'lp', 11, 0.7), 'lp', 11, 0.7));
    const deb = new Float64Array(n);
    for (let t = r.exp(40); t < dur; t += r.exp(60)) {
      const e = envAt(t);
      if (r.next() > e) continue; // debris density follows the shaking
      const s0 = Math.round(t * SR);
      const big = r.chance(0.12);
      const f = big ? r.range(250, 700) : r.range(1200, 4500);
      const tau = big ? r.range(0.02, 0.05) : r.range(0.003, 0.012);
      const amp = (big ? r.range(0.4, 0.9) : r.range(0.1, 0.5)) * e;
      const p0 = r.next() * TAU;
      const m = Math.min(n - s0, Math.ceil(tau * 6 * SR));
      for (let k = 0; k < m; k++) {
        const tt = k / SR;
        deb[s0 + k] += amp * Math.min(1, tt / 0.0003) * Math.exp(-tt / tau) * (0.6 * Math.sin(TAU * f * tt + p0) + 0.4 * r.bi());
      }
    }
    const debF = filt(deb, 'hp', 200, 0.7);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const e = envAt(i / SR);
      y[i] = e * (low[i] * 0.9 * (0.65 + 0.7 * Math.abs(shake[i])) + sub[i] * 0.5) + debF[i] * 0.35;
    }
    out[c] = y;
  });
  return out;
}

// ------------------------------------------------------------------ rain.wav
// Heavy rain bed: band-limited pink noise with gusts + hiss, dense tiny droplet
// ticks and some larger "plip" drops (rising pitched bubbles). 0.3 s fades.
export function sfxRain({ seed = 631 } = {}) {
  const dur = 6.0;
  const n = samples(dur);
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const r = makeRng(seed * 13 + ci);
    const bed = filt(filt(pinkNoise(n, r), 'hp', 450, 0.7), 'lp', 7500, 0.7);
    const hiss = filt(whiteNoise(n, r), 'hp', 5000, 0.7);
    const gust = normMono(filt(filt(whiteNoise(n, r), 'lp', 0.7, 0.7), 'lp', 0.7, 0.7));
    const drops = new Float64Array(n);
    for (let t = r.exp(420); t < dur; t += r.exp(420)) {
      const s0 = Math.round(t * SR);
      const amp = 0.05 + 0.5 * r.next() ** 3;
      const f = r.range(2500, 7500);
      const tau = r.range(0.0006, 0.0025);
      const p0 = r.next() * TAU;
      const m = Math.min(n - s0, Math.ceil(tau * 7 * SR));
      for (let k = 0; k < m; k++) drops[s0 + k] += amp * Math.min(1, k / 8) * Math.exp(-k / SR / tau) * Math.sin((TAU * f * k) / SR + p0);
    }
    for (let t = r.exp(14); t < dur; t += r.exp(14)) {
      const s0 = Math.round(t * SR);
      const amp = r.range(0.15, 0.4);
      const f0 = r.range(1200, 2400);
      const tau = r.range(0.008, 0.02);
      const m = Math.min(n - s0, Math.ceil(tau * 6 * SR));
      let ph = 0;
      for (let k = 0; k < m; k++) {
        const tt = k / SR;
        ph += (TAU * f0 * (1 + (0.8 * tt) / (6 * tau))) / SR;
        drops[s0 + k] += amp * Math.min(1, tt / 0.0005) * Math.exp(-tt / tau) * Math.sin(ph);
      }
    }
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const g = 1 + 0.18 * gust[i];
      y[i] = bed[i] * 0.55 * g + hiss[i] * 0.08 * g + drops[i] * 0.6;
    }
    out[c] = filt(y, 'hp', 150, 0.7);
  });
  fadeIn(out, 0.3);
  return fadeOutRange(out, dur - 0.3, dur);
}

// --------------------------------------------------------------- thunder.wav
// Crack (dense micro-crackles + bright burst) then a long low roll made of
// random rumbling bumps, a low boom and a big reverb.
export function sfxThunder({ seed = 641 } = {}) {
  const dur = 2.5;
  const n = samples(dur);
  const rng = makeRng(seed);
  const bumps = [];
  for (let tb = 0.05; tb < 1.9; tb += rng.range(0.08, 0.32)) bumps.push([tb, rng.range(0.4, 1), rng.range(0.08, 0.3)]);
  const rollEnv = (t) => {
    let e = 0;
    for (const [c, a, w] of bumps) e += a * Math.exp(-(((t - c) / w) ** 2));
    return e * Math.exp(-t / 1.1);
  };
  const out = stereoN(n);
  ['L', 'R'].forEach((c, ci) => {
    const r = makeRng(seed * 17 + ci);
    const crack = new Float64Array(n);
    for (let t = 0.0005 + r.exp(3000); t < 0.9; ) {
      crack[Math.round(t * SR)] += r.bi() * (0.4 + 0.6 * r.next()) * Math.exp(-t / 0.12);
      t += r.exp(3000 * Math.exp(-t / 0.05) + 60 * Math.exp(-t / 0.4));
    }
    const crackF = filt(filt(crack, 'hp', 500, 0.7), 'lp', 7000, 0.7);
    const burst = filt(whiteNoise(n, r), 'bp', 2200, 0.6);
    const roll = filt(filt(brownNoise(n, r), 'lp', 260, 0.7), 'hp', 25, 0.7);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / SR;
      y[i] = crackF[i] * 2.0 + burst[i] * 0.7 * Math.min(1, t / 0.0006) * Math.exp(-t / 0.035) + roll[i] * 2.4 * rollEnv(t) * Math.min(1, t / 0.02);
    }
    out[c] = y;
  });
  const boom = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (36 + 14 * Math.exp(-t / 0.3))) / SR;
    boom[i] = Math.sin(ph) * smoothstep(t / 0.04) * Math.exp(-t / 0.7);
  }
  addMono(out, boom, 0, 0.5);
  const wet = freeverb(out, { room: 0.9, damp: 0.5 });
  filtStereo(wet, 'hp', 100, 0.7);
  addStereo(out, wet, 0, 0.35);
  return fadeOutRange(out, 2.15, dur);
}

// ------------------------------------------------------------ stone-thud.wav
// Heavy block on stone: low pitch-dropping thump, stony body modes, gritty
// click, a few gravel grains and a dusty low tail, in a small room.
export function sfxStoneThud({ seed = 651 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.5);
  const modes = modalHit(
    n,
    [
      [182, 0.55, 0.055],
      [263, 0.45, 0.045],
      [412, 0.32, 0.032],
      [617, 0.22, 0.022],
      [934, 0.14, 0.015],
      [1480, 0.08, 0.01],
    ],
    rng
  );
  const grit = filt(whiteNoise(n, rng), 'bp', 3500, 0.8);
  const dust = filt(whiteNoise(n, rng), 'lp', 400, 0.7);
  const grains = new Float64Array(n);
  for (let tg = 0.004; tg < 0.12; tg += rng.exp(120)) {
    const s0 = Math.round(tg * SR);
    const amp = rng.range(0.1, 0.35) * Math.exp(-tg / 0.05);
    const tau = rng.range(0.0008, 0.003);
    const f = rng.range(2000, 6000);
    const m = Math.min(n - s0, Math.ceil(tau * 6 * SR));
    for (let k = 0; k < m; k++) grains[s0 + k] += amp * Math.min(1, k / 6) * Math.exp(-k / SR / tau) * Math.sin((TAU * f * k) / SR);
  }
  const y = new Float64Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    ph += (TAU * (48 + 50 * Math.exp(-t / 0.03))) / SR;
    let v = Math.sin(ph) * Math.exp(-t / 0.09) + modes[i];
    v += grit[i] * 0.8 * Math.exp(-t / 0.004) + dust[i] * 0.5 * Math.exp(-t / 0.06);
    y[i] = sat(Math.min(1, t / 0.0006) * v, 1.8) + grains[i] * 0.6;
  }
  const out = monoToStereo(tailFade(y, 0.05));
  const wet = freeverb(out, { room: 0.45, damp: 0.6 });
  filtStereo(wet, 'hp', 180, 0.7);
  addStereo(out, wet, 0, 0.12);
  return fadeOutRange(out, 0.42, 0.5);
}

// ----------------------------------------------------------- stone-clack.wav
// Block clicking into place: crisp stony knock (hard modes + noise snap) and a
// tiny settle tap 38 ms later.
export function sfxStoneClack({ seed = 661 } = {}) {
  const rng = makeRng(seed);
  const n = samples(0.25);
  const y = new Float64Array(n);
  const modes = [
    [245, 0.5, 0.03],
    [760, 1.0, 0.02],
    [1190, 0.75, 0.015],
    [1840, 0.55, 0.011],
    [2690, 0.35, 0.008],
    [3900, 0.2, 0.005],
  ];
  const hit = (t0, amp, scale) => {
    const s0 = Math.round(t0 * SR);
    const m = n - s0;
    const body = modalHit(m, modes, rng, { attack: 0.0003, scale });
    const snap = filt(whiteNoise(m, rng), 'bp', 3200, 1.0);
    for (let k = 0; k < m; k++) {
      const t = k / SR;
      y[s0 + k] += amp * (body[k] + snap[k] * 1.2 * Math.min(1, t / 0.0003) * Math.exp(-t / 0.0015));
    }
  };
  hit(0, 1, 1);
  hit(0.038, 0.35, 1.04);
  const out = monoToStereo(tailFade(filt(y, 'hp', 120, 0.7), 0.02));
  const wet = freeverb(out, { room: 0.4, damp: 0.5 });
  filtStereo(wet, 'hp', 300, 0.7);
  addStereo(out, wet, 0, 0.08);
  return fadeOutRange(out, 0.2, 0.25);
}

// ----------------------------------------------------------------- paper.wav
// Sheet sliding (band-passed friction noise with flutter + crinkles, moving
// L -> R) that gets stuck: abrupt stop, a small crinkle cluster and a tiny tap.
export function sfxPaper({ seed = 671 } = {}) {
  const rng = makeRng(seed);
  const dur = 0.5;
  const stop = 0.34;
  const n = samples(dur);
  const friction = filt(filt(whiteNoise(n, rng), 'bp', (t) => 1800 + 2500 * clamp(t / stop, 0, 1), 0.7), 'hp', 900, 0.7);
  const flutter = normMono(filt(whiteNoise(n, rng), 'lp', 35, 0.7));
  const crk = new Float64Array(n);
  const addCrinkle = (t, amp) => {
    const s0 = Math.round(t * SR);
    const m = Math.min(n - s0, samples(rng.range(0.0003, 0.0012)));
    for (let k = 0; k < m; k++) crk[s0 + k] += amp * rng.bi() * (1 - k / m);
  };
  for (let t = 0.02 + rng.exp(250); t < stop; t += rng.exp(250)) addCrinkle(t, rng.range(0.15, 0.6) * smoothstep(t / 0.05));
  for (let k = 0; k < 8; k++) addCrinkle(stop + rng.range(0, 0.028), rng.range(0.4, 1));
  const crkF = filt(crk, 'bp', 4200, 0.9);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = t < 0.03 ? Math.sin((Math.PI / 2) * (t / 0.03)) ** 2 : t < stop ? 1 : Math.exp(-(t - stop) / 0.006);
    let v = friction[i] * env * (0.75 + 0.5 * flutter[i]) * 0.6 + crkF[i] * 0.7;
    if (t >= stop) {
      const u = t - stop;
      v += 0.35 * Math.sin(TAU * 190 * u) * Math.min(1, u / 0.0005) * Math.exp(-u / 0.012);
    }
    y[i] = v;
  }
  const out = stereoN(n);
  for (let i = 0; i < n; i++) {
    const [gl, gr] = panGains(lerp(-0.35, 0.15, smoothstep(i / SR / stop)));
    out.L[i] = y[i] * gl;
    out.R[i] = y[i] * gr;
  }
  return fadeOutRange(out, 0.44, dur);
}

// ------------------------------------------------------------------ rope.wav
// Rope creak: stick-slip impulse train (rate rising with the strain, jittered)
// exciting creak resonances, a low groan and some fibre rustle.
export function sfxRope({ seed = 681 } = {}) {
  const rng = makeRng(seed);
  const dur = 0.8;
  const n = samples(dur);
  const env = (t) => smoothstep(t / 0.12) * (1 - smoothstep((t - 0.55) / 0.23));
  const imp = new Float64Array(n);
  for (let t = 0.005; t < dur - 0.03; ) {
    imp[Math.round(t * SR)] += env(t) * (0.6 + 0.4 * rng.next()) * (rng.chance(0.1) ? 0.3 : 1);
    const rate = 38 + 55 * smoothstep(t / 0.6) + 10 * Math.sin(TAU * 2.3 * t);
    t += (1 / rate) * (1 + rng.range(-0.18, 0.18));
  }
  const y = new Float64Array(n);
  for (const [f, q, g] of [
    [480, 14, 1.0],
    [1060, 12, 0.7],
    [2250, 10, 0.4],
    [3500, 8, 0.2],
  ]) {
    const r = filt(imp, 'bp', f, q);
    for (let i = 0; i < n; i++) y[i] += g * r[i];
  }
  normMono(y);
  const groan = normMono(filt(imp, 'lp', 250, 2));
  const rustle = filt(filt(whiteNoise(n, rng), 'bp', 3000, 0.8), 'hp', 1500, 0.7);
  const out = stereoN(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const v = y[i] + 0.35 * groan[i] + 0.05 * rustle[i] * env(t);
    const [gl, gr] = panGains(0.25 * Math.sin(TAU * 0.9 * t));
    out.L[i] = v * gl;
    out.R[i] = v * gr;
  }
  fadeIn(out, 0.004);
  return fadeOutRange(out, 0.74, dur);
}

// --------------------------------------------------------------- sparkle.wav
// Magical shimmer: fast ascending high sine arpeggio (A minor pentatonic),
// alternating pan, faint glints and air, through a small reverb.
export function sfxSparkle({ seed = 511 } = {}) {
  const rng = makeRng(seed);
  const dur = 0.8;
  const n = samples(dur);
  const dry = stereoN(n);
  const notes = [93, 96, 98, 100, 103, 105, 108]; // A6 C7 D7 E7 G7 A7 C8
  notes.forEach((m, k) => {
    const f = mtof(m);
    const len = samples(0.36);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      y[i] = (Math.sin(TAU * f * t) + 0.3 * Math.sin(TAU * 2 * f * t + 1)) * Math.min(1, t / 0.001) * Math.exp(-t / 0.11);
    }
    addMono(dry, tailFade(y, 0.02), k * 0.036, 0.9 - k * 0.06, k % 2 ? 0.55 : -0.55);
  });
  for (let g = 0; g < 9; g++) {
    const t0 = rng.range(0.07, 0.45);
    const f = rng.range(5000, 9000);
    const len = samples(0.06);
    const y = new Float64Array(len);
    for (let i = 0; i < len; i++) y[i] = Math.sin((TAU * f * i) / SR) * Math.exp(-i / SR / 0.012);
    addMono(dry, tailFade(y, 0.01), t0, 0.18, rng.bi() * 0.8);
  }
  const hiss = filt(whiteNoise(n, rng), 'hp', 8000);
  for (let i = 0; i < n; i++) {
    const e = 0.05 * Math.sin(Math.PI * clamp(i / SR / 0.62, 0, 1));
    dry.L[i] += hiss[i] * e;
    dry.R[i] += hiss[(i + 97) % n] * e;
  }
  const wet = freeverb(dry, { room: 0.78, damp: 0.2 });
  const out = stereoN(n);
  addStereo(out, dry, 0, 1);
  addStereo(out, wet, 0, 0.45);
  return fadeOutRange(out, 0.62, dur);
}

// ------------------------------------------------------------- voice blips
// Animal-Crossing-style gibberish syllables: additive harmonic source whose
// harmonic amplitudes follow a moving 3-formant vowel envelope (consonant-ish
// start -> vowel), with a small speech-like pitch contour, 4 ms attack and a
// raised-cosine release. Band-limited by construction (no filter ringing).
const FORMANTS = {
  a: [800, 1250, 2700],
  e: [480, 2000, 2800],
  i: [320, 2500, 3200],
  o: [500, 900, 2600],
  u: [350, 800, 2400],
  b: [300, 900, 2300],
  d: [300, 1700, 2600],
  m: [280, 1000, 2400],
  y: [280, 2300, 3000],
  w: [300, 700, 2300],
  n: [300, 1500, 2600],
  p: [320, 1000, 2400],
};
export const VOICES = [
  { f0: 392.0, dur: 0.09, from: 'b', to: 'a', pitch: [0.6, -0.8] }, // G4 "ba"
  { f0: 440.0, dur: 0.075, from: 'd', to: 'i', pitch: [0.2, 0.9] }, // A4 "di"
  { f0: 493.9, dur: 0.1, from: 'm', to: 'o', pitch: [0.5, -1.2] }, // B4 "mo"
  { f0: 523.3, dur: 0.085, from: 'y', to: 'a', pitch: [-0.4, 0.6] }, // C5 "ya"
  { f0: 587.3, dur: 0.07, from: 'p', to: 'u', pitch: [0.8, -0.5] }, // D5 "pu"
  { f0: 659.3, dur: 0.08, from: 'n', to: 'e', pitch: [0.3, -0.9] }, // E5 "ne"
  { f0: 698.5, dur: 0.095, from: 'w', to: 'i', pitch: [-0.6, 0.7] }, // F5 "wi"
  { f0: 415.3, dur: 0.11, from: 'b', to: 'o', pitch: [0.9, -1.5] }, // G#4 "bo"
];
export function voiceBlip({ f0, dur, from, to, pitch }) {
  const n = samples(dur);
  const y = new Float64Array(n);
  const A = FORMANTS[from].map((f) => f * 1.12); // shorter "vocal tract" = cuter
  const B = FORMANTS[to].map((f) => f * 1.12);
  const bw = [90, 120, 170];
  const fg = [1.0, 0.6, 0.28];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const t = i / SR;
    const st = pitch[0] + (pitch[1] - pitch[0]) * smoothstep(u) + 0.35 * Math.sin(Math.PI * u);
    const f = f0 * Math.pow(2, st / 12);
    ph += f / SR;
    if (ph >= 1) ph -= 1;
    const w = smoothstep((u - 0.08) / 0.55);
    const F = [0, 1, 2].map((j) => A[j] + (B[j] - A[j]) * w);
    let v = 0;
    let pow = 0;
    for (let k = 1; k * f < 9500; k++) {
      const fk = k * f;
      let amp = 0.02;
      for (let j = 0; j < 3; j++) {
        const x = (fk - F[j]) / bw[j];
        amp += fg[j] / (1 + x * x);
      }
      amp /= Math.sqrt(k);
      pow += amp * amp;
      v += amp * Math.sin(TAU * k * ph + k * 0.3);
    }
    v /= Math.sqrt(pow); // constant power through the vowel sweep: even loudness across blips
    const att = t < 0.004 ? Math.sin((Math.PI / 2) * (t / 0.004)) ** 2 : 1;
    const rel = u > 0.55 ? Math.cos((Math.PI / 2) * ((u - 0.55) / 0.45)) ** 2 : 1;
    y[i] = v * att * rel * (1 - 0.25 * u);
  }
  return monoToStereo(y);
}
