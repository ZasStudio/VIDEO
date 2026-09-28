// =============================================================================
// scripts/audio/music.mjs - "Andean pop" explainer track, 120 BPM, A minor,
// 30 bars = 60.000 s. Arrangement, bus processing and mastering.
// =============================================================================

import {
  SR,
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

// ----------------------------------------------------------------------------
// Song map (bar numbers are 1-based; 1 bar = 2 s)
// ----------------------------------------------------------------------------
export const BAR = 2;
export const STEP = BAR / 16; // 16th note = 0.125 s
export const SONG_SEC = 60;
export const T = {
  DROP1: 6, // bar 4 downbeat
  BREAK: 18, // bar 10
  DROP2: 24, // bar 13 downbeat
  FILL1: 34, // bar 18 downbeat (fill + swell at the end of bar 17)
  FILL2: 42, // bar 22 downbeat (fill + swell at the end of bar 21)
  BUILD: 54, // bar 28
  FINAL: 56, // bar 29
  FINAL_HIT: 58, // bar 30 downbeat
};
export const GAP = [23.94, 24.0]; // digital silence before drop 2
export const FADE = [58.9, 59.85]; // ring-out fade, digital silence afterwards
export const GROOVE_RANGES = [
  [6, 18],
  [24, 54],
];

const barStart = (b) => (b - 1) * BAR;
const at = (b, s) => barStart(b) + s * STEP;

// Chords. bass = MIDI root for the bass, pad/arp/strum = voicings, pcs = chord pitch classes.
const CH = {
  Am: { bass: 33, pad: [57, 60, 64, 67], arp: [64, 69, 72, 76], strum: [69, 72, 76, 81], pcs: [9, 0, 4] },
  F: { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 77], strum: [69, 72, 77, 81], pcs: [5, 9, 0] },
  C: { bass: 36, pad: [55, 60, 64, 67], arp: [67, 72, 76, 79], strum: [67, 72, 76, 79], pcs: [0, 4, 7] },
  G: { bass: 31, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79], strum: [67, 71, 74, 79], pcs: [7, 11, 2] },
  Dm: { bass: 38, pad: [53, 57, 62, 64], arp: [65, 69, 74, 77], strum: [69, 74, 77, 81], pcs: [2, 5, 9] },
  Esus: { bass: 28, pad: [52, 57, 59, 62], arp: [64, 69, 71, 74], strum: [69, 71, 76, 81], pcs: [4, 9, 11, 2] },
  E: { bass: 28, pad: [52, 56, 59, 62], arp: [64, 68, 71, 76], strum: [68, 71, 76, 80], pcs: [4, 8, 11, 2] },
};
const LOOP = ['Am', 'F', 'C', 'G'];
function chordAt(bar, step = 0) {
  if (bar <= 3) return ['Am', 'F', 'G'][bar - 1]; // intro
  if (bar <= 9) return LOOP[(bar - 4) % 4]; // groove A
  if (bar === 10) return 'Dm'; // break: iv - bVI - V
  if (bar === 11) return 'F';
  if (bar === 12) return step < 8 ? 'Esus' : 'E';
  if (bar <= 28) return LOOP[(bar - 13) % 4]; // groove B + build (bar 28 = G)
  if (bar === 29) return step < 8 ? 'F' : 'G'; // tag: bVI - bVII - i
  return 'Am';
}

// ----------------------------------------------------------------------------
// Melody notation: "step:Note:len[flags]" per bar. Flags: ^ scoop, > accent.
// ----------------------------------------------------------------------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nameToMidi(s) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function bar(b, str, vel = 0.9) {
  return str
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [st, name, lenF] = tok.split(':');
      const len = parseFloat(lenF);
      const s = Number(st);
      return {
        t: at(b, s),
        dur: len * STEP,
        midi: nameToMidi(name),
        vel: vel * (lenF.includes('>') ? 1.1 : 1) * (s % 4 === 0 ? 1 : len <= 1 ? 0.88 : 0.95),
        scoop: lenF.includes('^') ? 1.6 : 0,
        step: s,
        bar: b,
      };
    });
}
const bars = (first, list, vel) => list.flatMap((str, k) => bar(first + k, str, vel));

// Main hook (tresillo 3-3-2 opening every bar), over Am - F - C - G.
const RIFF_A = [
  '0:E5:3 3:A5:3^ 6:G5:2 8:E5:2 10:D5:1 11:E5:1 12:C5:2 14:D5:2',
  '0:C5:3 3:A4:3 6:C5:2 8:D5:6',
  '0:G5:3 3:C6:3^ 6:A5:2 8:G5:2 10:E5:1 11:G5:1 12:E5:2 14:D5:2',
  '0:D5:3 3:E5:3 6:D5:2 8:G5:6',
];
const RIFF_B = [
  '0:A5:3^ 3:G5:3 6:E5:2 8:A5:2 10:G5:1 11:A5:1 12:C6:2 14:A5:2',
  '0:G5:3 3:E5:3 6:D5:2 8:C5:6',
  '0:E5:3 3:G5:3 6:A5:2 8:G5:2 10:E5:1 11:D5:1 12:C5:2 14:D5:2',
  '0:D5:3 3:C5:3 6:A4:2 8:G4:4 12:A4:1 13:C5:1 14:D5:2',
];
const RIFF_C = [
  '0:A5:3^ 3:C6:3 6:A5:2 8:G5:2 10:E5:1 11:G5:1 12:A5:2 14:G5:2',
  '0:A5:3 3:G5:3 6:E5:2 8:C5:6',
  '0:E5:3 3:G5:3 6:C6:2^ 8:A5:2 10:G5:1 11:E5:1 12:G5:2 14:A5:2',
];

function leadNotes() {
  return [
    // intro call (soft) + pickup run into drop 1
    ...bar(1, '8:E5:4 12:A5:12^', 0.55),
    ...bar(2, '12:G5:2 14:E5:10', 0.55),
    ...bar(3, '12:G4:1 13:A4:1 14:C5:1 15:D5:1', 0.75),
    // groove A
    ...bars(4, RIFF_A, 0.86),
    ...bars(8, RIFF_A.slice(0, 2), 0.86),
    // break: long notes F5 - E5 - C5 - D5 - B4, pickup into drop 2
    ...bar(10, '0:F5:12 12:E5:12', 0.58),
    ...bar(11, '8:C5:8', 0.62),
    ...bar(12, '0:D5:8 8:B4:5 13:C5:1 14:D5:2', 0.72),
    // groove B
    ...bars(13, RIFF_A, 0.95),
    ...bars(17, RIFF_B, 0.95),
    ...bar(21, '0:E5:3 3:A5:3^ 6:G5:2 8:A5:7', 0.95),
    // (flute rests in bars 22-23, 42-46 s: the charango answers)
    ...bar(24, '8:D5:2 10:E5:2 12:G5:4', 0.85),
    ...bars(25, RIFF_C, 1.0),
    ...bar(28, '0:G5:8 8:A5:1 9:G5:1 10:A5:1 11:G5:1 12:A5:1 13:G5:1 14:A5:1 15:G5:1', 0.95),
    // final tag: main riff resolving on A
    ...bar(29, '0:E5:3 3:A5:3^ 6:G5:2 8:E5:2 10:D5:1 11:E5:1 12:G5:4', 1.0),
    ...bar(30, '0:A5:14^', 1.0),
  ];
}

// Second flute: diatonic thirds below (Andean style), snapped to a chord tone
// on strong beats / long notes.
const SCALE = [9, 11, 0, 2, 4, 5, 7]; // A natural minor
const pc = (m) => ((m % 12) + 12) % 12;
function diatonicBelow(m, steps) {
  let x = m;
  for (let k = 0; k < steps; ) {
    x--;
    if (SCALE.includes(pc(x))) k++;
  }
  return x;
}
function harmonyNotes(lead) {
  const inB = (b) => (b >= 13 && b <= 21) || (b >= 25 && b <= 27) || b >= 29;
  return lead
    .filter((nt) => inB(nt.bar))
    .map((nt) => {
      const pcs = CH[chordAt(nt.bar, nt.step)].pcs;
      let h = diatonicBelow(nt.midi, 2);
      const avoid = pcs.includes(pc(h - 1)); // a half step above a chord tone (b6 / sus4 clash)
      if ((nt.step % 4 === 0 || nt.dur >= 0.3 || avoid) && !pcs.includes(pc(h))) {
        for (let x = nt.midi - 3; x >= nt.midi - 9; x--) {
          if (pcs.includes(pc(x))) {
            h = x;
            break;
          }
        }
      }
      return { ...nt, midi: h, vel: nt.vel * 0.85, scoop: nt.scoop ? 1.2 : 0 };
    });
}

// Charango answer phrase in bars 22-23 (tremolo re-plucks every 16th).
const CHARANGO_LEAD = [
  ...bar(22, '0:C5:2 2:A4:1 3:C5:2 5:A4:1 6:G4:2 8:A4:2 10:C5:2 12:D5:2 14:C5:2', 1),
  ...bar(23, '0:E5:3 3:D5:3 6:C5:2 8:A4:2 10:G4:2 12:A4:2 14:C5:2', 1),
];

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

// ----------------------------------------------------------------------------
// Render: returns the processed stem buses (not yet mastered)
// ----------------------------------------------------------------------------
export function renderMusic() {
  const N = samples(SONG_SEC);
  const names = ['drums', 'perc', 'bass', 'pad', 'pluck', 'flute', 'fx', 'verb'];
  const bus = Object.fromEntries(names.map((k) => [k, stereoN(N)]));
  const rng = makeRng(1450);
  const kicks = [];

  // ---- pre-rendered drum voices
  const K = kick({ seed: 11 });
  const Kpulse = filt(kick({ f0: 110, f1: 47, decay: 0.22, click: 0, drive: 1.2, seed: 12 }), 'lp', 350);
  const SN = snare({ tone: 200, seed: 21 });
  const CL = clap({ seed: 31 });
  const CL2 = clap({ seed: 32, center: 1800, tail: 0.12 });
  const SHK = [0, 1, 2, 3, 4, 5].map((k) => shaker({ seed: 61 + k, tone: 0.95 + 0.02 * k, decay: 0.024 + 0.004 * (k % 3) }));
  const HATC = [0, 1, 2, 3].map((k) => hat({ seed: 41 + k, tone: 1.05 + 0.01 * k, decay: 0.016 }));
  const HATO = hat({ open: true, decay: 0.07, len: 0.26, seed: 48 });
  const TOM = {
    floor: tom({ f0: 100, f1: 62, decay: 0.4, len: 0.9, noiseAmt: 0.3, seed: 71 }),
    low: tom({ f0: 128, f1: 88, decay: 0.3, seed: 72 }),
    mid: tom({ f0: 165, f1: 120, decay: 0.25, seed: 73 }),
    high: tom({ f0: 215, f1: 160, decay: 0.2, seed: 74 }),
  };

  const addKick = (t, v = 1) => {
    addMono(bus.drums, K, t, 0.95 * v);
    kicks.push([t, v]);
  };
  const addClap = (t, v = 1, big = false, verb = 0.12) => {
    addMono(bus.drums, CL, t, 0.62 * v, -0.06);
    addMono(bus.drums, SN, t, 0.34 * v, 0.06);
    if (big) addMono(bus.drums, CL2, t + 0.007, 0.3 * v, 0.2);
    addMono(bus.verb, CL, t, verb * v);
    addMono(bus.verb, SN, t, verb * 0.5 * v);
  };
  const addShaker = (t, v, k) => {
    const x = SHK[k % SHK.length];
    addMono(bus.perc, x, t, 0.24 * v, 0.35);
    addMono(bus.perc, x, t + 0.011, 0.11 * v, -0.5); // short Haas echo = width
  };
  const addTom = (x, t, v, pan = 0, verb = 0.12) => {
    addMono(bus.drums, x, t, 0.62 * v, pan);
    addMono(bus.verb, x, t, verb * v);
  };
  const addCrash = (t, g = 0.3, seed = 51, decay = 1.2) => addStereo(bus.fx, crash({ seed, decay, len: 3 }), t, g);
  const addStrum = (t, midis, { vel = 1, dur = 0.5, dir = 1, gap = 0.011, bright = 0.7, t60 = 1.0, octave = 0, gain = 1, seed = 900 } = {}) => {
    const ord = dir > 0 ? midis : [...midis].reverse();
    ord.forEach((m, k) => {
      const x = charangoNote(m, dur, { vel: vel * (1 - 0.06 * k), bright, t60, spread: 0.55, octave, seed: seed + 3 * k });
      addStereo(bus.pluck, x, t + k * gap, gain);
    });
  };
  const snareRoll = (t0, t1, v0, v1, seed) => {
    // 8ths for the first half, 16ths for the next quarter, 32nds at the end
    const len = t1 - t0;
    let t = t0;
    let k = 0;
    while (t < t1 - 0.02) {
      const p = (t - t0) / len;
      const x = snare({ tone: 185 + 70 * p, noiseDecay: 0.07, len: 0.22, seed: seed + k });
      const v = v0 + (v1 - v0) * p;
      addMono(bus.drums, x, t, 0.42 * v, k % 2 ? 0.08 : -0.08);
      addMono(bus.verb, x, t, 0.1 * v);
      t += p < 0.5 ? STEP * 2 : p < 0.75 ? STEP : STEP / 2;
      k++;
    }
  };

  // ---- groove bar (A or B)
  function grooveBar(b, { B, fill = false, arpScale = 1 }) {
    const name = chordAt(b);
    const ch = CH[name];
    for (const s of [0, 4, 8, 12]) if (!(fill && s === 12)) addKick(at(b, s), s === 0 ? 1 : 0.93);
    addClap(at(b, 4), 1, B);
    if (!fill) addClap(at(b, 12), 1, B);
    for (let s = 0; s < 16; s++) {
      const v = (s % 4 === 2 ? 1 : s % 4 === 0 ? 0.72 : 0.5) * (1 + rng.range(-0.08, 0.08));
      addShaker(at(b, s) + rng.range(-0.002, 0.002), v, rng.int(0, 5));
    }
    if (B) for (const s of [2, 6, 10, 14]) addMono(bus.perc, HATO, at(b, s), 0.13, -0.3);
    for (const [s, off, len] of BASS_PAT) {
      const x = bassNote(ch.bass + off, len * STEP - 0.012, s === 0 ? 1 : 0.9, { cutoff: B ? 440 : 380, env: B ? 1300 : 1000, seed: 8000 + b * 16 + s });
      addMono(bus.bass, x, at(b, s), B ? 1 : 0.88);
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
        seed: 5000 + b * 32 + s,
      });
      addStereo(bus.pluck, x, at(b, s) + rng.range(-0.002, 0.002), 1);
    });
    addStereo(bus.pad, padChord(ch.pad, BAR, { attack: 0.06, release: 0.3, cutoff: B ? 2600 : 1900, seed: 430 + b }), barStart(b), B ? 0.55 : 0.4);
    if (B && !fill) {
      addTom(TOM.floor, at(b, 6), 0.3, -0.2, 0.04); // bombo accents (Andean flavour)
      addTom(TOM.floor, at(b, 14), 0.38, 0.2, 0.04);
    }
  }

  // ---- short fill in the last beat of `b` + reverse-cymbal swell into the next downbeat
  function fillInto(b, seed) {
    addMono(bus.drums, SN, at(b, 12), 0.42);
    addTom(TOM.high, at(b, 12), 0.75, 0.35);
    addTom(TOM.high, at(b, 13), 0.7, 0.3);
    addTom(TOM.mid, at(b, 14), 0.85, 0);
    addTom(TOM.low, at(b, 15), 0.9, -0.3);
    addMono(bus.drums, SN, at(b, 15) + STEP / 2, 0.3);
    const rc = reverseCymbal(1.25, seed);
    addStereo(bus.fx, rc, barStart(b + 1) - 1.25, 0.34);
  }

  // =========================================================== INTRO 0-6 s
  for (let b = 1; b <= 3; b++) {
    const ch = CH[chordAt(b)];
    const pad = padChord(ch.pad, BAR, { attack: b === 1 ? 0.7 : 0.25, release: 0.45, cutoff: (t) => 450 + 1000 * ((barStart(b) + t) / 6), detune: 12, seed: 410 + b });
    addStereo(bus.pad, pad, barStart(b), 1.0);
    for (let s = 0; s < 16; s += 2) {
      const t = at(b, s);
      const p = t / 6;
      const v = (s % 4 === 0 ? 0.95 : 0.72) * (0.72 + 0.28 * p);
      addMono(bus.bass, bassNote(ch.bass, STEP * 1.5, v, { cutoff: 170 + 260 * p, env: 450 + 1000 * p, envTau: 0.05, seed: 800 + b * 16 + s }), t, 0.62);
    }
    // ticking hats: 8ths (offbeats accented), 16ths creep in during bar 2, full 16ths in bar 3
    for (let s = 0; s < 16; s++) {
      const on8 = s % 2 === 0;
      if (b === 1 && !on8) continue;
      if (b === 2 && !on8 && s % 4 !== 3) continue;
      const p = at(b, s) / 6;
      const v = (s % 4 === 2 ? 1 : on8 ? 0.6 : 0.4) * (0.45 + 0.55 * p);
      addMono(bus.perc, HATC[rng.int(0, 3)], at(b, s), 0.2 * v, 0.25);
    }
  }
  // subtle low pulse on every half note (0, 1, 2, 3, 4, 5 s) - no big hits
  for (let t = 0; t < 6; t += 1) addMono(bus.drums, Kpulse, t, 0.3 + 0.03 * t);
  addStereo(bus.fx, riser({ dur: 3.975, fStart: 250, fEnd: 9000, toneFrom: 110, toneTo: 880, toneAmt: 0.3, sawAmt: 0.6, curve: 2.4, seed: 71 }), 2.0, 0.3);
  addStereo(bus.fx, reverseCymbal(1.5, 58), T.DROP1 - 1.5, 0.28);

  // =========================================================== DROP 1 / GROOVE A 6-18 s
  addCrash(T.DROP1, 0.32, 51, 1.3);
  addStereo(bus.fx, impactBoom({ f0: 65, f1: 32, decay: 0.45, len: 1.2, noiseAmt: 0.35, seed: 62 }), T.DROP1, 0.45);
  for (let b = 4; b <= 9; b++) grooveBar(b, { B: false, fill: b === 7 });
  // small tom fill at the end of bar 7 (into bar 8, 14.0 s), and a lift into the break
  fillInto(7, 59);
  addCrash(at(8, 0), 0.18, 50, 0.9);
  addTom(TOM.mid, at(9, 12), 0.6, 0.2);
  addTom(TOM.low, at(9, 14), 0.7, -0.2);

  // =========================================================== BREAK 18-24 s
  addStereo(bus.fx, impactBoom({ f0: 58, f1: 29, decay: 0.8, len: 2.2, noiseAmt: 0.3, seed: 64 }), T.BREAK, 0.42);
  addStereo(bus.fx, filtStereo(crash({ seed: 55, decay: 1.6, len: 3 }), 'lp', 5500), T.BREAK, 0.2);
  for (const b of [10, 11]) {
    const ch = CH[chordAt(b)];
    addKick(at(b, 0), 0.85);
    addKick(at(b, 10), 0.45);
    addClap(at(b, 8), 0.75, true, 0.3); // half-time backbeat, big room
    addTom(TOM.floor, at(b, 3), 0.45, -0.15, 0.2);
    addTom(TOM.floor, at(b, 6), 0.5, 0.15, 0.2);
    addTom(TOM.low, at(b, 11), 0.4, -0.25, 0.2);
    addTom(TOM.floor, at(b, 14), 0.48, 0.1, 0.2);
    addMono(bus.bass, bassNote(ch.bass, BAR - 0.03, 0.95, { cutoff: 260, env: 500, envTau: 0.2, sawAmt: 0.4, seed: 870 + b }), barStart(b), 0.45);
    addStereo(bus.pad, padChord(ch.pad, BAR, { attack: 0.5, release: 0.5, cutoff: (t) => 700 + 250 * Math.sin((Math.PI * t) / BAR), detune: 14, seed: 460 + b }), barStart(b), 0.85);
    addStrum(barStart(b), ch.strum, { vel: 0.55, dur: 1.6, bright: 0.5, t60: 2.2, gain: 0.8, seed: 950 + b * 10 });
  }
  {
    // bar 12: build - kick on every beat, snare roll, riser, swell, charango tremolo
    const b = 12;
    for (const s of [0, 4, 8, 12]) addKick(at(b, s), 0.5 + 0.08 * (s / 4));
    snareRoll(barStart(b), GAP[0], 0.2, 0.8, 3100);
    addTom(TOM.floor, at(b, 0), 0.9, 0);
    addStereo(bus.fx, riser({ dur: GAP[0] - barStart(b), fStart: 220, fEnd: 11000, toneFrom: 82.4, toneTo: 659, toneAmt: 0.4, curve: 2.0, seed: 72 }), barStart(b), 0.32);
    addStereo(bus.fx, reverseCymbal(1.6, 57), GAP[0] - 1.6, 0.25);
    for (let s = 0; s < 16; s += 2) {
      const p = s / 16;
      const root = CH[chordAt(b, s)].bass;
      addMono(bus.bass, bassNote(root, STEP * 1.6, 0.5 + 0.35 * p, { cutoff: 220 + 500 * p, env: 800 + 900 * p, seed: 890 + s }), at(b, s), 0.8);
    }
    addStereo(bus.pad, padChord(CH.Esus.pad, BAR / 2, { attack: 0.2, release: 0.15, cutoff: 900, detune: 14, seed: 471 }), barStart(b), 0.9);
    addStereo(bus.pad, padChord(CH.E.pad, BAR / 2 - 0.08, { attack: 0.1, release: 0.05, cutoff: (t) => 900 + 2200 * (t / 1), detune: 14, seed: 472 }), at(b, 8), 0.9);
    // charango tremolo (32nds) on the top of the chord, crescendo
    for (let k = 0; k < 31; k++) {
      const t = barStart(b) + k * (STEP / 2);
      const ch = CH[chordAt(b, Math.floor(k / 2))];
      const m = ch.strum[2 + (k % 2)];
      const x = charangoNote(m, STEP / 2, { vel: 0.2 + 0.5 * (k / 30), bright: 0.7, t60: 0.6, spread: 0.6, seed: 7000 + k * 3 });
      addStereo(bus.pluck, x, t, 0.7);
    }
  }

  // =========================================================== DROP 2 / GROOVE B 24-54 s
  addCrash(T.DROP2, 0.4, 52, 1.5);
  addCrash(T.DROP2, 0.14, 54, 0.5);
  addStereo(bus.fx, impactBoom({ f0: 80, f1: 28, decay: 0.8, len: 2.0, noiseAmt: 0.55, noiseDecay: 0.13, drive: 1.8, seed: 63 }), T.DROP2, 0.9);
  addStereo(bus.verb, impactBoom({ seed: 65 }), T.DROP2, 0.04);
  for (let b = 13; b <= 27; b++) grooveBar(b, { B: true, fill: b === 17 || b === 21, arpScale: b === 22 || b === 23 ? 0.6 : 1 });
  fillInto(17, 60);
  fillInto(21, 61);
  addCrash(T.FILL1, 0.26, 56, 1.1);
  addCrash(T.FILL2, 0.26, 53, 1.1);
  // charango answer (bars 22-23) - tremolo re-plucks every 16th, octave string for sparkle
  for (const nt of CHARANGO_LEAD) {
    const hits = Math.max(1, Math.round(nt.dur / STEP));
    for (let h = 0; h < hits; h++) {
      const x = charangoNote(nt.midi, STEP * 1.5, { vel: h === 0 ? 1 : 0.62, bright: 0.85, t60: 0.9, spread: 0.3, octave: 0.5, seed: 7500 + Math.round(nt.t * 100) + h });
      addStereo(bus.pluck, x, nt.t + h * STEP, 1.25);
    }
  }

  // =========================================================== BUILD (bar 28) 54-56 s
  {
    const b = 28;
    const ch = CH.G;
    for (const s of [0, 4, 8, 10, 12, 14]) addKick(at(b, s), 0.85 + 0.15 * (s / 14));
    snareRoll(barStart(b), T.FINAL - 0.03, 0.3, 1.05, 3300);
    for (let s = 0; s < 16; s++) addShaker(at(b, s), (s % 2 ? 0.6 : 0.9) * (0.7 + 0.5 * (s / 15)), s);
    for (let s = 0; s < 16; s += 2) {
      const p = s / 16;
      addMono(bus.bass, bassNote(ch.bass, STEP * 1.6, 0.8 + 0.2 * p, { cutoff: 300 + 700 * p, env: 1200 + 1000 * p, seed: 990 + s }), at(b, s), 1);
    }
    ARP.forEach((idx, s) => {
      const x = charangoNote(ch.arp[idx] + (s >= 8 ? 12 : 0), STEP * 1.5, { vel: 0.45 + 0.5 * (s / 15), bright: 0.85, t60: 0.7, spread: 0.55, seed: 9100 + s });
      addStereo(bus.pluck, x, at(b, s), 0.9);
    });
    addStereo(bus.pad, padChord(ch.pad, BAR - 0.05, { attack: 0.3, release: 0.05, cutoff: (t) => 900 + 4000 * (t / 2) ** 2, detune: 14, seed: 480 }), barStart(b), 0.9);
    addStereo(bus.fx, riser({ dur: 1.97, fStart: 300, fEnd: 11000, toneFrom: 98, toneTo: 784, toneAmt: 0.4, curve: 2.0, seed: 73 }), barStart(b), 0.42);
    addStereo(bus.fx, reverseCymbal(1.5, 62), T.FINAL - 0.03 - 1.5, 0.3);
  }

  // =========================================================== FINAL TAG (bars 29-30) 56-60 s
  {
    const b = 29;
    const hits = [
      [0, 1.0],
      [3, 0.8],
      [6, 0.85],
      [8, 1.0],
      [11, 0.8],
      [14, 0.85],
    ];
    hits.forEach(([s, v], k) => {
      const ch = CH[chordAt(b, s)];
      const next = k + 1 < hits.length ? hits[k + 1][0] : 16;
      const dur = (next - s) * STEP - 0.015;
      addKick(at(b, s), v);
      addStrum(at(b, s), ch.strum, { vel: v, dur, bright: 0.85, t60: 1.2, octave: 0.4, gain: 1.1, seed: 9300 + s * 10 });
      addMono(bus.bass, bassNote(ch.bass, dur, v, { cutoff: 520, env: 1800, seed: 9400 + s }), at(b, s), 1);
      addStereo(bus.pad, padChord(ch.pad, dur, { attack: 0.01, release: 0.08, cutoff: 3200, seed: 490 + s }), at(b, s), 0.75 * v);
    });
    addCrash(at(b, 0), 0.34, 57, 1.2);
    addCrash(at(b, 8), 0.22, 58, 0.9);
    addClap(at(b, 4), 1, true);
    addClap(at(b, 12), 1, true);
    for (let s = 0; s < 16; s++) addShaker(at(b, s), s % 4 === 2 ? 1 : 0.6, s + 3);
    for (const [s, v] of [
      [12, 0.45],
      [13, 0.55],
      [14, 0.7],
      [15, 0.85],
    ])
      addMono(bus.drums, SN, at(b, s), 0.42 * v);
    addTom(TOM.mid, at(b, 14), 0.6, 0.2);
    addTom(TOM.low, at(b, 15), 0.7, -0.2);

    // bar 30 downbeat: the final big hit, then everything rings out
    const t = T.FINAL_HIT;
    addKick(t, 1.1);
    addStereo(bus.fx, impactBoom({ f0: 75, f1: 28, decay: 0.7, len: 1.9, noiseAmt: 0.5, noiseDecay: 0.12, drive: 1.7, seed: 66 }), t, 0.7);
    addCrash(t, 0.36, 59, 1.6);
    addCrash(t, 0.14, 60, 0.6);
    addClap(t, 0.8, true, 0.25);
    addStrum(t, [57, ...CH.Am.strum], { vel: 1, dur: 1.9, bright: 0.85, t60: 1.8, octave: 0.5, gain: 1.2, gap: 0.014, seed: 9500 });
    addMono(bus.bass, bassNote(33, 1.8, 1, { cutoff: 480, env: 1600, envTau: 0.12, release: 0.1, seed: 9600 }), t, 1);
    addStereo(bus.pad, padChord([45, ...CH.Am.pad, 72], 1.5, { attack: 0.01, release: 0.4, cutoff: (x) => 3400 - 2000 * Math.min(1, x / 1.5), seed: 499 }), t, 1.0);
  }

  // =========================================================== FLUTES
  const lead = leadNotes();
  const L1 = fluteLine(lead, { breath: 1, vibDepth: 0.22, vibRate: 5.4, tone: 1, seed: 301 });
  const L2 = fluteLine(harmonyNotes(lead), { breath: 0.8, vibDepth: 0.16, vibRate: 5.0, tone: 0.8, seed: 302 });
  const fl = stereoN(N);
  addMono(fl, L1.y, L1.t0, 1.0, 0);
  addMono(fl, L2.y, L2.t0, 0.5, 0.4);
  addMono(fl, L2.y, L2.t0 + 0.012, 0.16, -0.5); // tiny Haas spread for the second flute
  eachCh(fl, (x) => filt(x, 'hp', 240, 0.7));
  eachCh(fl, (x) => peakEq(x, 3000, -4.5, 0.9)); // tame 2-4 kHz
  eachCh(fl, (x) => peakEq(x, 900, 1.5, 0.8));
  eachCh(fl, (x) => filt(x, 'lp', 9500, 0.7));
  const flEcho = pingPong(fl, { time: 3 * STEP, feedback: 0.3, lp: 3500, hp: 450 });
  addStereo(bus.flute, fl, 0, 1);
  addStereo(bus.flute, flEcho, 0, 0.16);
  addStereo(bus.verb, fl, 0, 0.3);

  // =========================================================== BUS PROCESSING
  // Sidechain-style ducking from every kick
  const duck = new Float64Array(N);
  for (const [tk, v] of kicks) {
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
  return bus;
}

// ----------------------------------------------------------------------------
// Master: stems -> HP 25 Hz -> glue compressor -> air shelf -> soft clip ->
// look-ahead limiter (ceiling -1.2 dBFS) -> loudness targeting (iterated) ->
// silence gap before drop 2, short breaths before the other hits, end fade.
// ----------------------------------------------------------------------------
export const MIX = { drums: 1.0, perc: 3.1, bass: 0.75, pad: 0.8, pluck: 0.85, flute: 0.48, fx: 0.85, verb: 0.3 };
export const TARGET_RMS_DB = -14;
export const CEILING_DB = -1.4; // sample peak; keeps the 4x-oversampled true peak under -1 dBTP

export function sumStems(stems, gains = MIX) {
  const N = stems.drums.L.length;
  const mix = stereoN(N);
  for (const [k, g] of Object.entries(gains)) addStereo(mix, stems[k], 0, g);
  return mix;
}

export function master(stems) {
  const mix = sumStems(stems);
  const N = mix.L.length;
  filtStereo(mix, 'hp', 25, 0.7);
  // pre-level so the compressor threshold is meaningful
  scaleBuf(mix, dbToGain(-17) / rmsOf(mix, GROOVE_RANGES));
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
    const { maxReductionDb } = limiter(out, { ceilingDb: CEILING_DB });
    gateRange(out, 5.978, 6.0, 0.006); // tiny breath before drop 1
    gateRange(out, GAP[0], GAP[1], 0.008); // 60 ms of silence before drop 2
    gateRange(out, 55.978, 56.0, 0.006); // breath before the final tag
    gateRange(out, 57.982, 58.0, 0.006); // breath before the final hit
    fadeOutRange(out, FADE[0], FADE[1]);
    const rmsDb = gainToDb(rmsOf(out, GROOVE_RANGES));
    result = { out, preDb: gainToDb(pre), maxReductionDb, rmsDb, comp };
    if (Math.abs(rmsDb - TARGET_RMS_DB) < 0.05) break;
    pre *= dbToGain(TARGET_RMS_DB - rmsDb);
  }
  return result;
}

// Exposed for analysis / tests.
export { CH, chordAt, leadNotes, harmonyNotes };
