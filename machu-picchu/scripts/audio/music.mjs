// =============================================================================
// scripts/audio/music.mjs - "Andean pop" explainer track, 120 BPM, A minor.
// Renders an arrangement plan (arrangement.mjs) natively: every event is
// synthesized at its own time into full-length stem buses, and the bus effects
// (reverb, echoes, chorus, ducking) run over the whole song, so instrument and
// reverb tails flow continuously across section boundaries (no splicing).
// Then bus processing, the optional voice-friendly mix, and mastering.
// =============================================================================

import {
  SR,
  clamp,
  dbToGain,
  gainToDb,
  samples,
  makeRng,
  stereoN,
  addMono,
  addStereo,
  scaleBuf,
  filt,
  filtStereo,
  eachCh,
  peakEq,
  highShelf,
  freeverb,
  pingPong,
  chorus,
  compressor,
  limiter,
  softClip,
  gateRange,
  fadeOutRange,
  rmsOf,
  dynBandCut,
} from './dsp.mjs';
import {
  kick,
  snare,
  clap,
  hat,
  shaker,
  tom,
  crash,
  reverseCymbal,
  impactBoom,
  riser,
  bassNote,
  charangoNote,
  padChord,
  fluteLine,
} from './instruments.mjs';
import { BAR, STEP, at, barStart, CH } from './arrangement.mjs';

// Stem buses. "hits" holds the accents that land exactly where a gate ends
// (drop / final-hit downbeats) so they keep their full attack (see gateTails).
export const STEMS = ['drums', 'perc', 'bass', 'pad', 'pluck', 'flute', 'fx', 'verb', 'hits'];
export const MIX = { drums: 1.0, perc: 3.1, bass: 0.75, pad: 0.8, pluck: 0.85, flute: 0.48, fx: 0.85, verb: 0.3, hits: 1.0 };
export const TARGET_RMS_DB = -14; // groove sections
export const CEILING_DB = -1.4; // true-peak limiter ceiling (4x oversampled)

// Voice-friendly mix (the narrator talks over the music the whole time).
export const VOICE = {
  flute: { f0: 2000, q: 0.65, ratio: 3, maxCutDb: 6, autoOffsetDb: -4.5 }, // dynamic cut of the flutes' 1-4 kHz band
  flute2Db: -1.5, // second flute a little lower overall
  dip: { f0: 2650, gainDb: -2.5, q: 0.8 }, // wide dip around 2-3.5 kHz on the music bus
  hatDb: -2, // shakers and closed hats
  openHatDb: -3,
  underDb: -1, // intro and break (pure narration beds) a touch lower, so the drops keep their lift
};
const UNDER_NARRATION = new Set(['intro', 'break']);

// Patterns (16th steps)
const BASS_PAT = [
  [0, 0, 2.5],
  [3, 0, 2.5],
  [6, 12, 1.5],
  [8, 0, 2.5],
  [11, 0, 2.5],
  [14, 12, 1.5],
]; // [step, semitone offset, length in steps] - double tresillo
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 2, 1];
const ARP_ACC = new Set([0, 3, 6, 8, 11, 14]);

// Per-note seeds: unique per voice kind, bar and step (no two notes share a noise sequence).
const SEED_KIND = { bass: 1, arp: 2, pad: 3, strum: 4, answer: 5, trem: 6, fill: 7, roll: 8, bar: 9, outro: 10, crash: 11 };
const sd = (kind, b, k = 0) => SEED_KIND[kind] * 1e6 + b * 1000 + k;

// ----------------------------------------------------------------------------
// Render context: buses, pre-rendered drum voices and small mixing helpers
// ----------------------------------------------------------------------------
function makeContext(plan, { voiceMix }) {
  const N = plan.N;
  const bus = Object.fromEntries(STEMS.map((k) => [k, stereoN(N)]));
  const kicks = [];
  const gateEnds = new Set(plan.gates.map((g) => Math.round(g.b * SR)));
  // drums / fx events starting exactly where a gate ends go to the "hits" bus
  const dest = (name, t) => (gateEnds.has(Math.round(t * SR)) && (name === 'drums' || name === 'fx') ? [bus.hits, MIX[name] / MIX.hits] : [bus[name], 1]);
  const put = (name, x, t, g = 1, pan = 0) => {
    const [d, k] = dest(name, t);
    addMono(d, x, t, g * k * ctx.gain, pan);
  };
  const putS = (name, x, t, g = 1) => {
    const [d, k] = dest(name, t);
    addStereo(d, x, t, g * k * ctx.gain);
  };

  // pre-rendered drum voices
  const V = {
    K: kick({ seed: 11 }),
    Kpulse: filt(kick({ f0: 110, f1: 47, decay: 0.22, click: 0, drive: 1.2, seed: 12 }), 'lp', 350),
    SN: snare({ tone: 200, seed: 21 }),
    CL: clap({ seed: 31 }),
    CL2: clap({ seed: 32, center: 1800, tail: 0.12 }),
    SHK: [0, 1, 2, 3, 4, 5].map((k) => shaker({ seed: 61 + k, tone: 0.95 + 0.02 * k, decay: 0.024 + 0.004 * (k % 3) })),
    HATC: [0, 1, 2, 3].map((k) => hat({ seed: 41 + k, tone: 1.05 + 0.01 * k, decay: 0.016 })),
    HATO: hat({ open: true, decay: 0.07, len: 0.26, seed: 48 }),
    TOM: {
      floor: tom({ f0: 100, f1: 62, decay: 0.4, len: 0.9, noiseAmt: 0.3, seed: 71 }),
      low: tom({ f0: 128, f1: 88, decay: 0.3, seed: 72 }),
      mid: tom({ f0: 165, f1: 120, decay: 0.25, seed: 73 }),
      high: tom({ f0: 215, f1: 160, decay: 0.2, seed: 74 }),
    },
  };
  const hatGain = voiceMix ? dbToGain(VOICE.hatDb) : 1;
  const openHatGain = voiceMix ? dbToGain(VOICE.openHatDb) : 1;

  const ctx = {
    plan,
    N,
    bus,
    kicks,
    V,
    voiceMix,
    gain: 1, // section trim, see renderMusic
    put,
    putS,
    hatGain,
    rngBar: (b) => makeRng(1450 + 7919 * b), // timing / velocity humanisation, one stream per bar
    kick(t, v = 1) {
      put('drums', V.K, t, 0.95 * v);
      kicks.push([t, v]);
    },
    clap(t, v = 1, big = false, verb = 0.12) {
      put('drums', V.CL, t, 0.62 * v, -0.06);
      put('drums', V.SN, t, 0.34 * v, 0.06);
      if (big) put('drums', V.CL2, t + 0.007, 0.3 * v, 0.2);
      put('verb', V.CL, t, verb * v);
      put('verb', V.SN, t, verb * 0.5 * v);
    },
    shaker(t, v, k) {
      const x = V.SHK[k % V.SHK.length];
      put('perc', x, t, 0.24 * v * hatGain, 0.35);
      put('perc', x, t + 0.011, 0.11 * v * hatGain, -0.5); // short Haas echo = width
    },
    openHat(t, g) {
      put('perc', V.HATO, t, g * openHatGain, -0.3);
    },
    closedHat(t, g, k) {
      put('perc', V.HATC[k % V.HATC.length], t, g * hatGain, 0.25);
    },
    tom(x, t, v, pan = 0, verb = 0.12) {
      put('drums', x, t, 0.62 * v, pan);
      put('verb', x, t, verb * v);
    },
    crash(t, g = 0.3, seed = 51, decay = 1.2) {
      putS('fx', crash({ seed, decay, len: 3 }), t, g);
    },
    strum(t, midis, { vel = 1, dur = 0.5, dir = 1, gap = 0.011, bright = 0.7, t60 = 1.0, octave = 0, gain = 1, seed = 900 } = {}) {
      const ord = dir > 0 ? midis : [...midis].reverse();
      ord.forEach((m, k) => {
        const x = charangoNote(m, dur, { vel: vel * (1 - 0.06 * k), bright, t60, spread: 0.55, octave, seed: seed + 3 * k });
        putS('pluck', x, t + k * gap, gain);
      });
    },
    // 8ths for the first half, 16ths for the next quarter, 32nds at the end
    snareRoll(t0, t1, v0, v1, seed) {
      const len = t1 - t0;
      let t = t0;
      let k = 0;
      while (t < t1 - 0.02) {
        const p = (t - t0) / len;
        const x = snare({ tone: 185 + 70 * p, noiseDecay: 0.07, len: 0.22, seed: seed + k });
        const v = v0 + (v1 - v0) * p;
        put('drums', x, t, 0.42 * v, k % 2 ? 0.08 : -0.08);
        put('verb', x, t, 0.1 * v);
        t += p < 0.5 ? STEP * 2 : p < 0.75 ? STEP : STEP / 2;
        k++;
      }
    },
  };
  return ctx;
}

// Humanised onset: +-2 ms, but never before the downbeat of a bar (a gate may end there).
const jitter = (rng, s) => {
  const j = rng.range(-0.002, 0.002);
  return s === 0 ? Math.abs(j) : j;
};

// ----------------------------------------------------------------------------
// Bars
// ----------------------------------------------------------------------------

// Groove bar (A = lighter first groove, B = full). fill = the last beat is left
// to a tom fill; lift (0..1) = build-up energy (shakers, open hats, pad filter).
function grooveBar(ctx, b, { B, fill = false, arpScale = 1, lift = 0 }) {
  const { V } = ctx;
  const rng = ctx.rngBar(b);
  const ch = CH[ctx.plan.chordAt(b)];
  for (const s of [0, 4, 8, 12]) if (!(fill && s === 12)) ctx.kick(at(b, s), s === 0 ? 1 : 0.93);
  ctx.clap(at(b, 4), 1, B);
  if (!fill) ctx.clap(at(b, 12), 1, B);
  for (let s = 0; s < 16; s++) {
    const v = (s % 4 === 2 ? 1 : s % 4 === 0 ? 0.72 : 0.5) * (1 + rng.range(-0.08, 0.08)) * (1 + 0.35 * lift);
    ctx.shaker(at(b, s) + jitter(rng, s), v, rng.int(0, 5));
  }
  if (B) for (const s of [2, 6, 10, 14]) ctx.openHat(at(b, s), 0.13 * (1 + 0.5 * lift));
  for (const [s, off, len] of BASS_PAT) {
    const x = bassNote(ch.bass + off, len * STEP - 0.012, s === 0 ? 1 : 0.9, { cutoff: B ? 440 : 380, env: B ? 1300 : 1000, seed: sd('bass', b, s) });
    ctx.put('bass', x, at(b, s), B ? 1 : 0.88);
  }
  ARP.forEach((idx, s) => {
    const acc = ARP_ACC.has(s);
    if (arpScale < 1 && s % 2 === 1) return; // thinner (8ths) under the charango answer
    const x = charangoNote(ch.arp[idx], STEP * 1.7, {
      vel: (acc ? 1 : 0.58) * arpScale * (B ? 1 : 0.9),
      bright: B ? 0.8 : 0.64,
      t60: 0.8,
      spread: 0.68,
      octave: B && acc ? 0.35 : 0,
      seed: sd('arp', b, 4 * s),
    });
    ctx.putS('pluck', x, at(b, s) + jitter(rng, s), 1);
  });
  const pad = padChord(ch.pad, BAR, { attack: 0.06, release: 0.3, cutoff: (B ? 2600 : 1900) + 1400 * lift, seed: sd('pad', b) });
  ctx.putS('pad', pad, barStart(b), B ? 0.55 : 0.4);
  if (B && !fill) {
    ctx.tom(V.TOM.floor, at(b, 6), 0.3, -0.2, 0.04); // bombo accents (Andean flavour)
    ctx.tom(V.TOM.floor, at(b, 14), 0.38, 0.2, 0.04);
  }
}

// Short fill in the last beat of bar b + reverse-cymbal swell into the next downbeat.
function fillInto(ctx, b) {
  const { V } = ctx;
  ctx.put('drums', V.SN, at(b, 12), 0.42);
  ctx.tom(V.TOM.high, at(b, 12), 0.75, 0.35);
  ctx.tom(V.TOM.high, at(b, 13), 0.7, 0.3);
  ctx.tom(V.TOM.mid, at(b, 14), 0.85, 0);
  ctx.tom(V.TOM.low, at(b, 15), 0.9, -0.3);
  ctx.put('drums', V.SN, at(b, 15) + STEP / 2, 0.3);
  ctx.putS('fx', reverseCymbal(1.25, 59 + (b % 7)), barStart(b + 1) - 1.25, 0.34);
}

// ----------------------------------------------------------------------------
// Sections
// ----------------------------------------------------------------------------

// INTRO: soft pad sweep, 8th-note bass, ticking hats, a low pulse every half bar.
function renderIntro(ctx, s) {
  const { V, plan } = ctx;
  const prog = (t) => clamp((t - s.t0) / (s.t1 - s.t0), 0, 1);
  for (let k = 0; k < s.bars; k++) {
    const b = s.b0 + k;
    const ch = CH[plan.chordAt(b)];
    const rng = ctx.rngBar(b);
    const pad = padChord(ch.pad, BAR, { attack: k === 0 ? 0.7 : 0.25, release: 0.45, cutoff: (t) => 450 + 1000 * prog(barStart(b) + t), detune: 12, seed: sd('pad', b) });
    ctx.putS('pad', pad, barStart(b), 1.0);
    for (let st = 0; st < 16; st += 2) {
      const t = at(b, st);
      const p = prog(t);
      const v = (st % 4 === 0 ? 0.95 : 0.72) * (0.72 + 0.28 * p);
      ctx.put('bass', bassNote(ch.bass, STEP * 1.5, v, { cutoff: 170 + 260 * p, env: 450 + 1000 * p, envTau: 0.05, seed: sd('bass', b, st) }), t, 0.62);
    }
    // ticking hats: 8ths (offbeats accented) in the first bar, 16ths creep in, full 16ths in the last bar
    const density = s.bars > 1 && k === s.bars - 1 ? 2 : k === 0 ? 0 : 1;
    for (let st = 0; st < 16; st++) {
      const on8 = st % 2 === 0;
      if (density === 0 && !on8) continue;
      if (density === 1 && !on8 && st % 4 !== 3) continue;
      const v = (st % 4 === 2 ? 1 : on8 ? 0.6 : 0.4) * (0.45 + 0.55 * prog(at(b, st)));
      ctx.closedHat(at(b, st), 0.2 * v, rng.int(0, 3));
    }
  }
  // subtle low pulse on every half note - no big hits
  for (let t = s.t0; t < s.t1 - 1e-9; t += BAR / 2) ctx.put('drums', V.Kpulse, t, 0.3 + 0.18 * prog(t));
  if (s.exit === 'pickup') {
    const t0 = Math.max(s.t0, s.t1 - 2 * BAR);
    const r = riser({ dur: s.t1 - 0.025 - t0, fStart: 250, fEnd: 9000, toneFrom: 110, toneTo: 880, toneAmt: 0.3, sawAmt: 0.6, curve: 2.4, seed: 71 });
    ctx.putS('fx', r, t0, 0.3);
    ctx.putS('fx', reverseCymbal(1.5, 58), s.t1 - 1.5, 0.28);
  }
}

// GROOVE A / B: 4-bar phrases over Am - F - C - G (fills and phrases come from the plan).
function renderGroove(ctx, s) {
  for (let b = s.b0; b < s.b1; b++) {
    const info = ctx.plan.bars[b];
    grooveBar(ctx, b, { B: info.B, fill: info.fillAfter, arpScale: info.arpScale, lift: info.lift });
  }
  if (s.exit === 'fillRiser') {
    const r = riser({ dur: BAR - 0.025, fStart: 300, fEnd: 10000, toneFrom: 110, toneTo: 880, toneAmt: 0.3, sawAmt: 0.6, curve: 2.2, seed: 74 });
    ctx.putS('fx', r, barStart(s.b1 - 1), 0.3);
  }
}

// BREAK: half-time tension over Dm - F (repeated / varied), then E: either the
// rising build into a drop (ending in digital silence) or a calmer E bar.
function tensionBar(ctx, b, info, chords = [info.ch[0]]) {
  const { V } = ctx;
  const lift = info.lift ?? 0;
  ctx.kick(at(b, 0), 0.85);
  ctx.kick(at(b, 10), 0.45);
  ctx.clap(at(b, 8), 0.75, true, 0.3); // half-time backbeat, big room
  ctx.tom(V.TOM.floor, at(b, 3), 0.45, -0.15, 0.2);
  ctx.tom(V.TOM.floor, at(b, 6), 0.5, 0.15, 0.2);
  ctx.tom(V.TOM.low, at(b, 11), 0.4, -0.25, 0.2);
  if (!info.fillAfter) ctx.tom(V.TOM.floor, at(b, 14), 0.48, 0.1, 0.2);
  // second and later passes: a soft shaker pulse keeps long breaks moving
  if (info.pass >= 1 || (info.kind === 'breakEnd' && info.sec.bars >= 3)) for (let st = 2; st < 16; st += 4) ctx.shaker(at(b, st), 0.35 + 0.25 * lift, st + b);
  const half = BAR / chords.length;
  chords.forEach((name, j) => {
    const ch = CH[name];
    const t = barStart(b) + j * half;
    ctx.put('bass', bassNote(ch.bass, half - 0.03, 0.95, { cutoff: 260, env: 500, envTau: 0.2, sawAmt: 0.4, seed: sd('bass', b, j) }), t, 0.45);
    const wob = 700 + 250 * lift;
    const pad = padChord(ch.pad, half, { attack: 0.5, release: 0.5, cutoff: (x) => wob + 250 * Math.sin((Math.PI * x) / half), detune: 14, seed: sd('pad', b, j) });
    ctx.putS('pad', pad, t, 0.85);
    ctx.strum(t, ch.strum, { vel: 0.55, dur: 1.6 * (half / BAR), bright: 0.5 + 0.12 * lift, t60: 2.2, gain: 0.8, seed: sd('strum', b, 20 * j) });
  });
}

function breakBuildBar(ctx, b, info, gapStart) {
  const { V, plan } = ctx;
  // kick on every beat, snare roll, riser, swell, charango tremolo
  for (const s of [0, 4, 8, 12]) ctx.kick(at(b, s), 0.5 + 0.08 * (s / 4));
  ctx.snareRoll(barStart(b), gapStart, 0.2, 0.8, sd('roll', b));
  ctx.tom(V.TOM.floor, at(b, 0), 0.9, 0);
  // (one bar only: a longer riser would sit higher on its swell right before the gap and flatten the drop)
  ctx.putS('fx', riser({ dur: gapStart - barStart(b), fStart: 220, fEnd: 11000, toneFrom: 82.4, toneTo: 659, toneAmt: 0.4, curve: 2.0, seed: 72 }), barStart(b), 0.32);
  ctx.putS('fx', reverseCymbal(1.6, 57), gapStart - 1.6, 0.25);
  for (let s = 0; s < 16; s += 2) {
    const p = s / 16;
    const root = CH[plan.chordAt(b, s)].bass;
    ctx.put('bass', bassNote(root, STEP * 1.6, 0.5 + 0.35 * p, { cutoff: 220 + 500 * p, env: 800 + 900 * p, seed: sd('bass', b, s) }), at(b, s), 0.8);
  }
  ctx.putS('pad', padChord(CH.Esus.pad, BAR / 2, { attack: 0.2, release: 0.15, cutoff: 900, detune: 14, seed: sd('pad', b) }), barStart(b), 0.9);
  ctx.putS('pad', padChord(CH.E.pad, BAR / 2 - 0.08, { attack: 0.1, release: 0.05, cutoff: (t) => 900 + 2200 * (t / 1), detune: 14, seed: sd('pad', b, 1) }), at(b, 8), 0.9);
  // charango tremolo (32nds) on the top of the chord, crescendo
  for (let k = 0; k < 31; k++) {
    const t = barStart(b) + k * (STEP / 2);
    const ch = CH[plan.chordAt(b, Math.floor(k / 2))];
    const x = charangoNote(ch.strum[2 + (k % 2)], STEP / 2, { vel: 0.2 + 0.5 * (k / 30), bright: 0.7, t60: 0.6, spread: 0.6, seed: sd('trem', b, 3 * k) });
    ctx.putS('pluck', x, t, 0.7);
  }
}

function renderBreak(ctx, s) {
  const { plan } = ctx;
  for (let b = s.b0; b < s.b1; b++) {
    const info = plan.bars[b];
    if (info.kind === 'tension') tensionBar(ctx, b, info);
    else if (info.kind === 'breakEnd') tensionBar(ctx, b, info, info.ch);
    else breakBuildBar(ctx, b, info, plan.gates.find((g) => g.b === s.t1).a);
  }
}

// BUILD: groove energy rising into a snare roll + riser (last 2 bars) and the
// G build bar (kick 4-on-the-floor + 8ths, octave-up arpeggio, opening pad).
function renderBuild(ctx, s) {
  const { plan } = ctx;
  const last = s.b1 - 1;
  for (let b = s.b0; b < last; b++) grooveBar(ctx, b, { B: true, lift: plan.bars[b].lift });
  const b = last;
  const ch = CH.G;
  for (const st of [0, 4, 8, 10, 12, 14]) ctx.kick(at(b, st), 0.85 + 0.15 * (st / 14));
  for (let st = 0; st < 16; st++) ctx.shaker(at(b, st), (st % 2 ? 0.6 : 0.9) * (0.7 + 0.5 * (st / 15)), st);
  for (let st = 0; st < 16; st += 2) {
    const p = st / 16;
    ctx.put('bass', bassNote(ch.bass, STEP * 1.6, 0.8 + 0.2 * p, { cutoff: 300 + 700 * p, env: 1200 + 1000 * p, seed: sd('bass', b, st) }), at(b, st), 1);
  }
  ARP.forEach((idx, st) => {
    const x = charangoNote(ch.arp[idx] + (st >= 8 ? 12 : 0), STEP * 1.5, { vel: 0.45 + 0.5 * (st / 15), bright: 0.85, t60: 0.7, spread: 0.55, seed: sd('arp', b, 4 * st) });
    ctx.putS('pluck', x, at(b, st), 0.9);
  });
  ctx.putS('pad', padChord(ch.pad, BAR - 0.05, { attack: 0.3, release: 0.05, cutoff: (t) => 900 + 4000 * (t / 2) ** 2, detune: 14, seed: sd('pad', b) }), barStart(b), 0.9);
  // snare roll + riser over the last two bars (one when the build is a single bar); the
  // two-bar riser swells later (steeper curve, a little lower) so its last second matches
  const tEnd = s.t1 - 0.03;
  const two = s.bars >= 2;
  const r0 = barStart(two ? last - 1 : last);
  ctx.snareRoll(r0, tEnd, two ? 0.22 : 0.3, 1.05, sd('roll', b));
  ctx.putS('fx', riser({ dur: tEnd - r0, fStart: 300, fEnd: 11000, toneFrom: 98, toneTo: 784, toneAmt: 0.4, curve: two ? 3.0 : 2.0, seed: 73 }), r0, two ? 0.38 : 0.42);
  ctx.putS('fx', reverseCymbal(1.5, 62), tEnd - 1.5, 0.3);
}

// FINAL: (groove bars,) F-G tag bars, the final hit, then a soft outro bed
// under the narrator's closing words, ringing out into digital silence.
function tagBar(ctx, b, info) {
  const { V, plan } = ctx;
  const v0 = info.last ? 1 : 0.92;
  const hits = [
    [0, 1.0],
    [3, 0.8],
    [6, 0.85],
    [8, 1.0],
    [11, 0.8],
    [14, 0.85],
  ];
  hits.forEach(([s, v], k) => {
    const ch = CH[plan.chordAt(b, s)];
    const next = k + 1 < hits.length ? hits[k + 1][0] : 16;
    const dur = (next - s) * STEP - 0.015;
    ctx.kick(at(b, s), v * v0);
    ctx.strum(at(b, s), ch.strum, { vel: v * v0, dur, bright: 0.85, t60: 1.2, octave: 0.4, gain: 1.1, seed: sd('strum', b, 20 * s) });
    ctx.put('bass', bassNote(ch.bass, dur, v, { cutoff: 520, env: 1800, seed: sd('bass', b, s) }), at(b, s), 1);
    ctx.putS('pad', padChord(ch.pad, dur, { attack: 0.01, release: 0.08, cutoff: 3200, seed: sd('pad', b, s) }), at(b, s), 0.75 * v);
  });
  ctx.crash(at(b, 0), info.first ? 0.34 : 0.26, 57, 1.2);
  if (info.last) ctx.crash(at(b, 8), 0.22, 58, 0.9);
  ctx.clap(at(b, 4), 1, true);
  ctx.clap(at(b, 12), 1, true);
  for (let s = 0; s < 16; s++) ctx.shaker(at(b, s), s % 4 === 2 ? 1 : 0.6, s + 3);
  if (info.last) {
    for (const [s, v] of [
      [12, 0.45],
      [13, 0.55],
      [14, 0.7],
      [15, 0.85],
    ])
      ctx.put('drums', V.SN, at(b, s), 0.42 * v);
    ctx.tom(V.TOM.mid, at(b, 14), 0.6, 0.2);
    ctx.tom(V.TOM.low, at(b, 15), 0.7, -0.2);
  } else {
    ctx.tom(V.TOM.mid, at(b, 14), 0.45, 0.2); // lighter turnaround into the second tag
    ctx.tom(V.TOM.low, at(b, 15), 0.5, -0.2);
  }
}

function finalHit(ctx, t) {
  ctx.kick(t, 1.1);
  ctx.putS('fx', impactBoom({ f0: 75, f1: 28, decay: 0.7, len: 1.9, noiseAmt: 0.5, noiseDecay: 0.12, drive: 1.7, seed: 66 }), t, 0.7);
  ctx.crash(t, 0.36, 59, 1.6);
  ctx.crash(t, 0.14, 60, 0.6);
  ctx.clap(t, 0.8, true, 0.25);
  ctx.strum(t, [57, ...CH.Am.strum], { vel: 1, dur: 1.9, bright: 0.85, t60: 1.8, octave: 0.5, gain: 1.2, gap: 0.014, seed: 9500 });
  ctx.put('bass', bassNote(33, 1.8, 1, { cutoff: 480, env: 1600, envTau: 0.12, release: 0.1, seed: 9600 }), t, 1);
  ctx.putS('pad', padChord([45, ...CH.Am.pad, 72], 1.5, { attack: 0.01, release: 0.4, cutoff: (x) => 3400 - 2000 * Math.min(1, x / 1.5), seed: 499 }), t, 1.0);
}

// Outro bed: soft pad, sub-ish bass, a light 8th-note charango and offbeat
// shaker, gently receding; the last bar is a single soft strum over the pad.
function outroBar(ctx, b, info) {
  const ch = CH[ctx.plan.chordAt(b)];
  const last = info.j === info.m - 1;
  const soft = 1 - 0.25 * (info.j / Math.max(1, info.m - 1));
  const rng = ctx.rngBar(b);
  ctx.putS('pad', padChord(ch.pad, last ? 1.1 : BAR, { attack: info.j === 0 ? 0.7 : 0.4, release: last ? 0.7 : 0.5, cutoff: 1500, detune: 12, seed: sd('pad', b) }), barStart(b), 0.62 * soft);
  ctx.put('bass', bassNote(ch.bass, last ? 1.0 : BAR - 0.06, 0.55, { cutoff: 180, env: 150, envTau: 0.2, sawAmt: 0.25, release: 0.3, seed: sd('bass', b) }), barStart(b), 0.5 * soft);
  if (last) {
    ctx.strum(barStart(b), ch.strum, { vel: 0.5, dur: 1.5, bright: 0.5, t60: 2.0, gain: 0.75, gap: 0.03, seed: sd('outro', b) });
    return;
  }
  for (let st = 0; st < 16; st += 2) {
    const x = charangoNote(ch.arp[ARP[st]], STEP * 3, { vel: (ARP_ACC.has(st) ? 0.55 : 0.38) * soft, bright: 0.55, t60: 1.1, spread: 0.6, seed: sd('outro', b, 4 * st) });
    ctx.putS('pluck', x, at(b, st) + jitter(rng, st), 0.9);
  }
  for (const st of [2, 6, 10, 14]) ctx.shaker(at(b, st), 0.5 * soft, st + b);
}

function renderFinal(ctx, s) {
  const { plan } = ctx;
  for (let b = s.b0; b < s.b1; b++) {
    const info = plan.bars[b];
    if (info.kind === 'groove') grooveBar(ctx, b, { B: true, fill: info.fillAfter, arpScale: info.arpScale });
    else if (info.kind === 'tag') tagBar(ctx, b, info);
    else if (info.kind === 'hit') finalHit(ctx, barStart(b));
    else outroBar(ctx, b, info);
  }
}

const RENDER = { intro: renderIntro, grooveA: renderGroove, grooveB: renderGroove, break: renderBreak, build: renderBuild, final: renderFinal };

// Downbeat accents of the sections (and the light crash after internal fills).
function renderAccent(ctx, { t, type }, k) {
  const seed = 50 + (k % 11);
  if (type === 'drop1') {
    ctx.crash(t, 0.32, 51, 1.3);
    ctx.putS('fx', impactBoom({ f0: 65, f1: 32, decay: 0.45, len: 1.2, noiseAmt: 0.35, seed: 62 }), t, 0.45);
  } else if (type === 'drop2') {
    ctx.crash(t, 0.4, 52, 1.5);
    ctx.crash(t, 0.14, 54, 0.5);
    ctx.putS('fx', impactBoom({ f0: 80, f1: 28, decay: 0.8, len: 2.0, noiseAmt: 0.55, noiseDecay: 0.13, drive: 1.8, seed: 63 }), t, 0.9);
    ctx.putS('verb', impactBoom({ seed: 65 }), t, 0.04);
  } else if (type === 'break') {
    ctx.putS('fx', impactBoom({ f0: 58, f1: 29, decay: 0.8, len: 2.2, noiseAmt: 0.3, seed: 64 }), t, 0.42);
    ctx.putS('fx', filtStereo(crash({ seed: 55, decay: 1.6, len: 3 }), 'lp', 5500), t, 0.2);
  } else if (type === 'crash') {
    ctx.crash(t, 0.26, seed, 1.1);
  } else if (type === 'crashSmall') {
    ctx.crash(t, 0.18, seed, 0.9);
  }
}

// ----------------------------------------------------------------------------
// Render: returns { stems (processed buses, not yet mastered), report }
// ----------------------------------------------------------------------------
export function renderMusic(plan, { voiceMix = plan.voiceMix } = {}) {
  const ctx = makeContext(plan, { voiceMix });
  const { bus, V, N } = ctx;
  const report = {};

  const trim = (s) => (voiceMix && UNDER_NARRATION.has(s.role) ? dbToGain(VOICE.underDb) : 1);
  for (const s of plan.sections) {
    ctx.gain = trim(s);
    RENDER[s.role](ctx, s);
  }
  ctx.gain = 1;
  for (const info of plan.bars) if (info.fillAfter) fillInto(ctx, info.b);
  for (const s of plan.sections) {
    if (s.exit === 'lift') {
      // two toms lifting into the break
      ctx.tom(V.TOM.mid, at(s.b1 - 1, 12), 0.6, 0.2);
      ctx.tom(V.TOM.low, at(s.b1 - 1, 14), 0.7, -0.2);
    }
  }
  plan.accents.forEach((a, k) => renderAccent(ctx, a, k));

  // charango answers - tremolo re-plucks every 16th, octave string for sparkle
  for (const nt of plan.charango) {
    const hits = Math.max(1, Math.round(nt.dur / STEP));
    for (let h = 0; h < hits; h++) {
      const x = charangoNote(nt.midi, STEP * 1.5, { vel: h === 0 ? 1 : 0.62, bright: 0.85, t60: 0.9, spread: 0.3, octave: 0.5, seed: sd('answer', nt.bar, 16 * nt.step + 3 * h) });
      ctx.putS('pluck', x, nt.t + h * STEP, 1.25);
    }
  }

  // =========================================================== FLUTES
  const fl = stereoN(N);
  if (plan.lead.length) {
    const lead = plan.lead.map((nt) => ({ ...nt, vel: nt.vel * trim(plan.bars[nt.bar].sec) }));
    const L1 = fluteLine(lead, { breath: 1, vibDepth: 0.22, vibRate: 5.4, tone: 1, seed: 301 });
    addMono(fl, L1.y, L1.t0, 1.0, 0);
  }
  if (plan.harmony.length) {
    const L2 = fluteLine(plan.harmony, { breath: 0.8, vibDepth: 0.16, vibRate: 5.0, tone: 0.8, seed: 302 });
    const g2 = voiceMix ? dbToGain(VOICE.flute2Db) : 1;
    addMono(fl, L2.y, L2.t0, 0.5 * g2, 0.4);
    addMono(fl, L2.y, L2.t0 + 0.012, 0.16 * g2, -0.5); // tiny Haas spread for the second flute
  }
  eachCh(fl, (x) => filt(x, 'hp', 240, 0.7));
  eachCh(fl, (x) => peakEq(x, 3000, -4.5, 0.9)); // tame 2-4 kHz
  eachCh(fl, (x) => peakEq(x, 900, 1.5, 0.8));
  eachCh(fl, (x) => filt(x, 'lp', 9500, 0.7));
  // voice mix: pull both flutes down in the speech band (1-4 kHz) whenever they have energy there
  if (voiceMix) report.fluteCut = dynBandCut(fl, VOICE.flute);
  const flEcho = pingPong(fl, { time: 3 * STEP, feedback: 0.3, lp: 3500, hp: 450 });
  addStereo(bus.flute, fl, 0, 1);
  addStereo(bus.flute, flEcho, 0, 0.16);
  addStereo(bus.verb, fl, 0, 0.3);

  // =========================================================== BUS PROCESSING
  // Sidechain-style ducking from every kick
  const duck = new Float64Array(N);
  for (const [tk, v] of ctx.kicks) {
    const s0 = Math.round(tk * SR);
    const m = Math.min(N - s0, samples(0.4));
    for (let i = 0; i < m; i++) {
      const t = i / SR;
      duck[s0 + i] = Math.max(duck[s0 + i], Math.min(1, v) * Math.min(1, t / 0.003) * Math.exp(-t / 0.09));
    }
  }
  const applyDuck = (buf, depth) => {
    for (let i = 0; i < N; i++) {
      const g = 1 - depth * duck[i];
      buf.L[i] *= g;
      buf.R[i] *= g;
    }
  };
  applyDuck(bus.bass, 0.55);
  applyDuck(bus.pad, 0.45);
  applyDuck(bus.pluck, 0.18);
  filtStereo(bus.bass, 'hp', 30, 0.7);
  filtStereo(bus.bass, 'lp', 2400, 0.7);

  // Plucks: body resonance + sparkle, a little dotted-8th echo
  filtStereo(bus.pluck, 'hp', 170, 0.7);
  eachCh(bus.pluck, (x) => peakEq(x, 650, 2.5, 0.9));
  eachCh(bus.pluck, (x) => highShelf(x, 7000, 1.5));
  const plEcho = pingPong(bus.pluck, { time: 3 * STEP, feedback: 0.22, lp: 4000, hp: 500 });
  addStereo(bus.pluck, plEcho, 0, 0.12);
  addStereo(bus.verb, bus.pluck, 0, 0.12);

  // Pad: chorus for width
  bus.pad = chorus(bus.pad, { mix: 0.4, rate: 0.35 });
  filtStereo(bus.pad, 'hp', 140, 0.7);
  addStereo(bus.verb, bus.pad, 0, 0.22);

  // Percussion: keep it airy
  filtStereo(bus.perc, 'hp', 2500, 0.7);

  // Shared reverb
  const verb = freeverb(bus.verb, { room: 0.86, damp: 0.35 });
  filtStereo(verb, 'hp', 220, 0.7);
  filtStereo(verb, 'lp', 7500, 0.7);
  bus.verb = verb;

  gateTails(bus, plan.gates);
  return { stems: bus, report };
}

// Everything that keeps sounding through a gate (reverb, echoes, pads, the
// flute...) resumes after it with a 3 ms fade-in instead of a hard step; the
// accents on the "hits" bus start exactly on the downbeat, untouched.
function gateTails(bus, gates, fadeSec = 0.003) {
  const f = samples(fadeSec);
  for (const g of gates) {
    const i0 = Math.round(g.b * SR);
    for (const k of STEMS) {
      if (k === 'hits') continue;
      const { L, R } = bus[k];
      for (let i = i0; i < Math.min(L.length, i0 + f); i++) {
        const w = 0.5 - 0.5 * Math.cos((Math.PI * (i - i0)) / f);
        L[i] *= w;
        R[i] *= w;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Master: stems -> HP 25 Hz -> (voice mix: wide 2.65 kHz dip) -> glue
// compressor -> air shelf -> soft clip -> look-ahead true-peak limiter
// (ceiling -1.4 dBTP) -> loudness targeting (iterated) -> gates before the
// drops / tag / final hit -> ring-out fade into digital silence.
// ----------------------------------------------------------------------------
export function sumStems(stems, gains = MIX) {
  const N = stems.drums.L.length;
  const mix = stereoN(N);
  for (const [k, g] of Object.entries(gains)) addStereo(mix, stems[k], 0, g);
  return mix;
}

export function master(stems, plan, { voiceMix = plan.voiceMix } = {}) {
  const mix = sumStems(stems);
  const N = mix.L.length;
  filtStereo(mix, 'hp', 25, 0.7);
  if (voiceMix) eachCh(mix, (x) => peakEq(x, VOICE.dip.f0, VOICE.dip.gainDb, VOICE.dip.q));
  // pre-level so the compressor threshold is meaningful
  scaleBuf(mix, dbToGain(-17) / rmsOf(mix, plan.loudRanges));
  const comp = compressor(mix, { thresholdDb: -15, ratio: 2, kneeDb: 6, attack: 0.02, release: 0.22 });
  eachCh(mix, (x) => highShelf(x, 9000, 1.0));
  let pre = 1;
  let result = null;
  for (let iter = 0; iter < 8; iter++) {
    const out = stereoN(N);
    for (let i = 0; i < N; i++) {
      out.L[i] = softClip(mix.L[i] * pre, 0.75);
      out.R[i] = softClip(mix.R[i] * pre, 0.75);
    }
    const { maxReductionDb } = limiter(out, { ceilingDb: CEILING_DB, truePeak: true });
    for (const g of plan.gates) gateRange(out, g.a, g.b, g.fade);
    fadeOutRange(out, plan.fade[0], plan.fade[1]);
    const rmsDb = gainToDb(rmsOf(out, plan.loudRanges));
    result = { out, preDb: gainToDb(pre), maxReductionDb, rmsDb, comp, iterations: iter + 1 };
    if (Math.abs(rmsDb - TARGET_RMS_DB) < 0.05) break;
    pre *= dbToGain(TARGET_RMS_DB - rmsDb);
  }
  return result;
}
