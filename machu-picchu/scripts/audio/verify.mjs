// =============================================================================
// scripts/audio/verify.mjs - checks computed on files re-read from disk.
// =============================================================================

import { SR, clamp, gainToDb, readWav, rmsOf, biquad, filt } from './dsp.mjs';

export const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(2) : '-inf');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);

// ITU-R BS.1770 K-weighting (its two 48 kHz biquads) for loudness-style numbers.
export function kWeight(buf) {
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
export const loudnessOf = (kbuf, ranges) => -0.691 + 10 * Math.log10(2 * rmsOf(kbuf, ranges) ** 2 + 1e-20);

export function fileStats(path) {
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
  const edge = (i) => Math.max(Math.abs(L[i]), Math.abs(R[i]));
  let head = 0; // largest |sample| in the first 0.1 ms (5 samples)
  for (let i = 0; i < Math.min(5, w.frames); i++) head = Math.max(head, edge(i));
  return {
    w,
    peakDb: gainToDb(peak),
    rmsDb: gainToDb(Math.sqrt(sq / (2 * w.frames))),
    dcPct: (Math.max(Math.abs(sumL), Math.abs(sumR)) / w.frames) * 100,
    bad,
    firstDb: gainToDb(edge(0)),
    headDb: gainToDb(head),
    lastDb: gainToDb(edge(w.frames - 1)),
  };
}

export function printTableHeader() {
  console.log(
    pad('file', 17) +
      padL('dur (s)', 9) +
      padL('rate', 7) +
      padL('ch', 3) +
      padL('bits', 5) +
      padL('peak dBFS', 11) +
      padL('RMS dBFS', 10) +
      padL('DC %', 7) +
      padL('NaN', 4) +
      padL('first', 8) +
      padL('0.1ms', 8) +
      padL('last', 8)
  );
}
export function printRow(name, s) {
  const { w } = s;
  console.log(
    pad(name, 17) +
      padL(w.duration.toFixed(4), 9) +
      padL(w.sampleRate, 7) +
      padL(w.channels, 3) +
      padL(w.bits, 5) +
      padL(fmtDb(s.peakDb), 11) +
      padL(fmtDb(s.rmsDb), 10) +
      padL(s.dcPct.toFixed(3), 7) +
      padL(s.bad, 4) +
      padL(fmtDb(s.firstDb), 8) +
      padL(fmtDb(s.headDb), 8) +
      padL(fmtDb(s.lastDb), 8)
  );
}

// 4x-oversampled true-peak estimate (windowed-sinc interpolation around loud samples).
export function truePeakDb(ch) {
  const OS = 4;
  const HALF = 16;
  const taps = [];
  for (let p = 1; p < OS; p++) {
    const h = [];
    for (let k = -HALF + 1; k <= HALF; k++) {
      const x = k - p / OS;
      h.push((Math.sin(Math.PI * x) / (Math.PI * x)) * (0.5 + 0.5 * Math.cos((Math.PI * x) / HALF)));
    }
    taps.push(h);
  }
  let tp = 0;
  for (const x of ch) {
    for (let i = 0; i < x.length; i++) {
      tp = Math.max(tp, Math.abs(x[i]));
      if (Math.abs(x[i]) < 0.5) continue;
      for (const h of taps) {
        let s = 0;
        for (let k = 0; k < h.length; k++) {
          const j = i + k - HALF + 1;
          if (j >= 0 && j < x.length) s += x[j] * h[k];
        }
        tp = Math.max(tp, Math.abs(s));
      }
    }
  }
  return gainToDb(tp);
}

// Music-specific report. Returns a list of problems (empty = all good).
export function verifyMusic(path, { SONG_SEC, T, GAP, GROOVE_RANGES, BAR }) {
  const problems = [];
  const { w } = fileStats(path);
  const [L, R] = w.ch;
  const buf = { L, R };
  const n = w.frames;
  const P = new Float64Array(n + 1); // prefix sums of per-frame mean square
  for (let i = 0; i < n; i++) P[i + 1] = P[i] + (L[i] * L[i] + R[i] * R[i]) / 2;
  const win = (a, b) => {
    const i0 = clamp(Math.round(a * SR), 0, n);
    const i1 = clamp(Math.round(b * SR), 0, n);
    return i1 > i0 ? Math.sqrt((P[i1] - P[i0]) / (i1 - i0)) : 0;
  };
  const kbuf = kWeight(buf);

  console.log('\nmusic.wav - sections:');
  const sections = [
    ['hook/tension', 0, 6],
    ['groove A', 6, 18],
    ['break', 18, 24],
    ['groove B', 24, 56],
    ['final + tail', 56, 60],
  ];
  for (const [name, a, b] of sections) {
    let pk = 0;
    for (let i = Math.round(a * SR); i < Math.min(n, Math.round(b * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    console.log(
      `  ${pad(name, 13)} ${padL(a.toFixed(1), 5)}-${pad(b.toFixed(1), 5)} RMS ${padL(fmtDb(gainToDb(win(a, b))), 7)} dBFS` +
        `   peak ${padL(fmtDb(gainToDb(pk)), 7)} dBFS   ~${fmtDb(loudnessOf(kbuf, [[a, b]]))} LUFS (ungated)`
    );
  }
  const tpDb = truePeakDb([L, R]);
  console.log(`  true peak (4x oversampled): ${fmtDb(tpDb)} dBTP`);
  if (tpDb > -1.0) problems.push(`music.wav: true peak ${fmtDb(tpDb)} dBTP above -1.0`);
  const grooveDb = gainToDb(rmsOf(buf, GROOVE_RANGES));
  console.log(`  groove RMS (6-18 + 24-54 s): ${fmtDb(grooveDb)} dBFS, ~${fmtDb(loudnessOf(kbuf, GROOVE_RANGES))} LUFS`);
  if (grooveDb < -15 || grooveDb > -13) problems.push(`music.wav: groove RMS ${fmtDb(grooveDb)} outside -15..-13 dBFS`);

  console.log('\nTransitions (RMS 1 s before -> 1 s after; onset = 50 ms after vs 150 ms before):');
  for (const [label, t] of [
    ['drop 1', T.DROP1],
    ['break', T.BREAK],
    ['drop 2', T.DROP2],
    ['scene 34 s', T.FILL1],
    ['scene 42 s', T.FILL2],
    ['final tag', T.FINAL],
    ['final hit', T.FINAL_HIT],
  ]) {
    const before = gainToDb(win(t - 1, t));
    const after = gainToDb(win(t, t + 1));
    const onset = gainToDb(win(t, t + 0.05) / Math.max(1e-9, win(t - 0.15, t)));
    console.log(
      `  ${pad(label, 11)} t=${t.toFixed(3)} s  ${padL(fmtDb(before), 7)} -> ${padL(fmtDb(after), 7)} dBFS (${padL((after - before >= 0 ? '+' : '') + (after - before).toFixed(1), 5)} dB)` +
        `   onset ${padL(Number.isFinite(onset) ? '+' + onset.toFixed(1) : '+inf', 6)} dB`
    );
    if ((label === 'drop 1' || label === 'drop 2') && !(after - before > 2)) problems.push(`music.wav: weak energy jump at ${t} s`);
  }
  // dip before drop 2
  let firstAfterGap = Math.round(GAP[0] * SR);
  while (firstAfterGap < n && L[firstAfterGap] === 0 && R[firstAfterGap] === 0) firstAfterGap++;
  let gapPk = 0;
  for (let i = Math.round(GAP[0] * SR); i < Math.round(GAP[1] * SR); i++) gapPk = Math.max(gapPk, Math.abs(L[i]), Math.abs(R[i]));
  console.log(
    `  dip ${GAP[0].toFixed(3)}-${GAP[1].toFixed(3)} s: peak ${gapPk === 0 ? 'digital silence' : fmtDb(gainToDb(gapPk)) + ' dBFS'}` +
      ` | 23.0-23.94 s RMS ${fmtDb(gainToDb(win(23, GAP[0])))} dBFS | first non-zero sample after the dip: ${firstAfterGap} (${(firstAfterGap / SR).toFixed(5)} s)`
  );
  if (gapPk !== 0) problems.push('music.wav: dip before 24.0 s is not silent');

  let tailNZ = 0;
  for (let i = Math.round((SONG_SEC - 0.1) * SR); i < n; i++) if (L[i] !== 0 || R[i] !== 0) tailNZ++;
  let lastSound = 0;
  for (let i = n - 1; i >= 0; i--)
    if (L[i] !== 0 || R[i] !== 0) {
      lastSound = (i + 1) / SR;
      break;
    }
  console.log(`  last 0.1 s (${(SONG_SEC - 0.1).toFixed(1)}-${SONG_SEC.toFixed(1)} s): ${tailNZ === 0 ? 'digital silence' : tailNZ + ' non-zero samples'}; last non-zero sample at ${lastSound.toFixed(4)} s`);
  if (tailNZ) problems.push('music.wav: last 0.1 s not silent');

  const bars = [];
  for (let b = 0; b < SONG_SEC / BAR; b++) bars.push(fmtDb(gainToDb(win(b * BAR, (b + 1) * BAR))));
  console.log('  RMS per bar (dBFS): ' + bars.map((v, k) => `${k + 1}:${v}`).join(' '));

  // spectral balance of groove B (mid channel, 4th-order band splits)
  {
    const i0 = Math.round(T.DROP2 * SR);
    const i1 = Math.round(T.BUILD * SR);
    const mid = new Float64Array(i1 - i0);
    for (let i = i0; i < i1; i++) mid[i - i0] = (L[i] + R[i]) / 2;
    const ms = (x) => x.reduce((s, v) => s + v * v, 0) / x.length;
    const total = ms(mid);
    const bands = [
      [20, 60, 'sub'],
      [60, 150, 'bass'],
      [150, 500, 'low-mid'],
      [500, 2000, 'mid'],
      [2000, 4000, '2-4k'],
      [4000, 8000, '4-8k'],
      [8000, 20000, 'air'],
    ];
    const parts = bands.map(([lo, hi, label]) => {
      const b = filt(filt(filt(filt(mid, 'hp', lo), 'hp', lo), 'lp', hi), 'lp', hi);
      return `${label} ${fmtDb(10 * Math.log10(ms(b) / total))}`;
    });
    console.log(`  groove B band energy (dB rel. total): ${parts.join(', ')}`);
    let m2 = 0;
    let s2 = 0;
    for (let i = i0; i < i1; i++) {
      m2 += ((L[i] + R[i]) / 2) ** 2;
      s2 += ((L[i] - R[i]) / 2) ** 2;
    }
    console.log(`  groove B stereo width: side/mid = ${fmtDb(10 * Math.log10(s2 / m2))} dB`);
  }
  return problems;
}
