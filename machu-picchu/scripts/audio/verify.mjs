// =============================================================================
// scripts/audio/verify.mjs - checks computed on files re-read from disk.
// =============================================================================

import { SR, clamp, gainToDb, readWav, rmsOf, biquad, filt, interSamplePeak } from './dsp.mjs';
import { BAR } from './arrangement.mjs';

export const fmtDb = (db) => (Number.isFinite(db) ? db.toFixed(2) : '-inf');
const pad = (s, w) => String(s).padEnd(w);
const padL = (s, w) => String(s).padStart(w);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

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
      padL('dur (s)', 10) +
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
      padL(w.duration.toFixed(4), 10) +
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

// 4x-oversampled true-peak estimate (same windowed-sinc interpolation as the
// limiter), checked between every pair of samples where either one is >= 0.25.
export function truePeakDb(ch) {
  let tp = 0;
  for (const x of ch) {
    for (let i = 0; i < x.length; i++) {
      const a = Math.abs(x[i]);
      if (a > tp) tp = a;
      if (a < 0.25 && (i + 1 >= x.length || Math.abs(x[i + 1]) < 0.25)) continue;
      tp = Math.max(tp, interSamplePeak(x, i));
    }
  }
  return gainToDb(tp);
}

// Radix-2 FFT magnitude of a real frame (length = power of two).
function fftMag(frame) {
  const n = frame.length;
  const re = Float64Array.from(frame);
  const im = new Float64Array(n);
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
    const h = len >> 1;
    const wr = Math.cos((-2 * Math.PI) / len);
    const wi = Math.sin((-2 * Math.PI) / len);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < h; k++) {
        const br = re[i + k + h] * cr - im[i + k + h] * ci;
        const bi = re[i + k + h] * ci + im[i + k + h] * cr;
        re[i + k + h] = re[i + k] - br;
        im[i + k + h] = im[i + k] - bi;
        re[i + k] += br;
        im[i + k] += bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
  const mag = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
  return mag;
}

// Click score: a short-block linear-prediction residual (AR(12) fitted per
// 25 ms block, Levinson-Durbin), each sample compared with the mean residual
// level around it (+-64 samples, leaving out +-2). A discontinuity (hard cut,
// missing fade, dropout) is a lone outlier and scores far above everything
// else; drums, noise and plucks spread their residual over many samples. The
// Karplus-Strong charango attack itself (the noise burst handing over to the
// string loop) scores up to ~35, so the limit sits above that. Clicks that
// coincide with a downbeat hit are masked by it, in this score and to the ear.
export const CLICK_LIMIT = 50;
const AR_P = 12;
const AR_BLOCK = 1200;
const AR_HALF = 64;
const AR_SKIP = 2; // the +-2 samples next to the tested one are left out of its reference level
const AR_FLOOR = 1e-4; // residual floor (-80 dBFS): a click in silence still scores high
function levinson(r, p) {
  const a = new Float64Array(p + 1);
  a[0] = 1;
  let err = r[0];
  if (!(err > 0)) return null;
  for (let i = 1; i <= p; i++) {
    let acc = r[i];
    for (let j = 1; j < i; j++) acc += a[j] * r[i - j];
    const k = -acc / err;
    const prev = a.slice();
    for (let j = 1; j < i; j++) a[j] = prev[j] + k * prev[i - j];
    a[i] = k;
    err *= 1 - k * k;
    if (!(err > 0)) break;
  }
  return a;
}
export function clickScores(x) {
  const n = x.length;
  const e = new Float64Array(n);
  const r = new Float64Array(AR_P + 1);
  for (let b0 = 0; b0 < n; b0 += AR_BLOCK) {
    const b1 = Math.min(n, b0 + AR_BLOCK);
    const s0 = Math.max(0, b0 - 2 * AR_HALF);
    const len = b1 - s0;
    const tw = (k) => 0.5 - 0.5 * Math.cos((2 * Math.PI * (k + 0.5)) / len); // taper for the autocorrelation
    for (let lag = 0; lag <= AR_P; lag++) {
      let acc = 0;
      for (let i = s0 + lag; i < b1; i++) acc += x[i] * tw(i - s0) * x[i - lag] * tw(i - lag - s0);
      r[lag] = acc;
    }
    r[0] = r[0] * (1 + 1e-9) + 1e-12;
    const a = levinson(r, AR_P);
    for (let i = b0; i < b1; i++) {
      let v = x[i];
      if (a) for (let k = 1; k <= AR_P && i - k >= 0; k++) v += a[k] * x[i - k];
      e[i] = Math.abs(v);
    }
  }
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + e[i];
  const score = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a0 = Math.max(0, i - AR_HALF);
    const a1 = Math.min(n, i + AR_HALF + 1);
    const c0 = Math.max(0, i - AR_SKIP);
    const c1 = Math.min(n, i + AR_SKIP + 1);
    const m = (pre[a1] - pre[a0] - (pre[c1] - pre[c0])) / Math.max(1, a1 - a0 - (c1 - c0));
    score[i] = e[i] / Math.max(m, AR_FLOOR);
  }
  return score;
}

// Around one position (+-win samples, both channels):
//   jump  = largest sample-to-sample step,
//   click = largest click score (see above),
//   flux  = largest spectral flux (1024-pt Hann frames, hop 256, mid channel)
//           of the frames centred within the window.
const FFT_N = 1024;
const HANN = Float64Array.from({ length: FFT_N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FFT_N));
function boundaryMetrics(L, R, score, i0, win) {
  const n = L.length;
  let jump = 0;
  let click = 0;
  for (let i = Math.max(1, i0 - win); i < Math.min(n, i0 + win); i++) {
    jump = Math.max(jump, Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1]));
    if (score[i] > click) click = score[i];
  }
  let flux = 0;
  let prev = null;
  for (let c = i0 - win - 256; c <= i0 + win; c += 256) {
    const f0 = c - FFT_N / 2;
    const frame = new Float64Array(FFT_N);
    for (let k = 0; k < FFT_N; k++) {
      const j = f0 + k;
      frame[k] = j >= 0 && j < n ? 0.5 * (L[j] + R[j]) * HANN[k] : 0;
    }
    const mag = fftMag(frame);
    if (prev && c >= i0 - win) {
      let acc = 0;
      for (let k = 0; k < mag.length; k++) acc += Math.max(0, mag[k] - prev[k]);
      flux = Math.max(flux, acc);
    }
    prev = mag;
  }
  return { jump, click, flux };
}

// Synthesized hits ramp up from zero (kick 0.2 ms, crash 1.5 ms), so the first
// non-zero 16-bit sample of an onset is a sample or two after its downbeat.
const ONSET_TOL = Math.round(0.001 * SR); // an onset counts as "on the downbeat" within 1 ms

// Music report driven by the arrangement plan. Returns a list of problems (empty = all good).
export function verifyMusic(path, plan) {
  const problems = [];
  const w = readWav(path);
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
  const peakIn = (a, b) => {
    let pk = 0;
    for (let i = Math.max(0, Math.round(a * SR)); i < Math.min(n, Math.round(b * SR)); i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    return pk;
  };
  const firstNonZero = (i) => {
    while (i < n && L[i] === 0 && R[i] === 0) i++;
    return i;
  };
  const kbuf = kWeight(buf);
  const ok = (cond) => (cond ? 'ok' : 'FAIL');

  // ------------------------------------------------------------ sections
  console.log(`\nmusic.wav - sections (voice mix ${plan.voiceMix ? 'ON' : 'off'}):`);
  const rowOf = (label, a, b) =>
    `  ${pad(label, 22)} ${padL(a.toFixed(3), 8)}-${pad(b.toFixed(3), 8)} RMS ${padL(fmtDb(gainToDb(win(a, b))), 7)} dBFS` +
    `   peak ${padL(fmtDb(gainToDb(peakIn(a, b))), 7)} dBFS   ~${padL(fmtDb(loudnessOf(kbuf, [[a, b]])), 7)} LUFS (ungated)`;
  for (const s of plan.sections) {
    console.log(rowOf(`${s.i + 1} ${s.role} (${s.bars} bars)${s.label ? ' ' + s.label : ''}`, s.t0, s.t1));
    if (s.role === 'final') {
      const th = plan.hit.t;
      if (th > s.t0) console.log(rowOf('    tag', s.t0, th));
      console.log(rowOf('    hit bar', th, th + BAR));
      if (th + BAR < s.t1) console.log(rowOf('    outro bed', th + BAR, s.t1));
    }
  }

  // ------------------------------------------------------------ duration + level
  console.log('\nChecks:');
  const want = Math.round(plan.nBars * BAR * SR);
  const durOk = n === want && w.duration === plan.nBars * BAR;
  console.log(`  duration: ${n} frames = ${w.duration.toFixed(6)} s; sum(bars) x 2 s = ${plan.nBars} x ${BAR} = ${(plan.nBars * BAR).toFixed(6)} s (${want} frames) -> ${ok(durOk)}`);
  if (!durOk) problems.push(`music.wav: ${n} frames, expected ${want}`);
  const tpDb = truePeakDb([L, R]);
  console.log(`  true peak (4x oversampled): ${fmtDb(tpDb)} dBTP (limit -1.20) -> ${ok(tpDb <= -1.2)}`);
  if (tpDb > -1.2) problems.push(`music.wav: true peak ${fmtDb(tpDb)} dBTP above -1.2`);
  const grooveDb = gainToDb(rmsOf(buf, plan.loudRanges));
  console.log(`  groove RMS: ${fmtDb(grooveDb)} dBFS, ~${fmtDb(loudnessOf(kbuf, plan.loudRanges))} LUFS (target -14 dBFS RMS)`);
  if (grooveDb < -15 || grooveDb > -13) problems.push(`music.wav: groove RMS ${fmtDb(grooveDb)} outside -15..-13 dBFS`);

  // ------------------------------------------------------------ transitions
  console.log('\n  Section starts (RMS 1 s before -> 1 s after; onset = 50 ms after vs 150 ms before the downbeat):');
  for (const s of plan.sections.slice(1)) {
    const t = s.t0;
    const before = gainToDb(win(t - 1, t));
    const after = gainToDb(win(t, t + 1));
    const onset = gainToDb(win(t, t + 0.05) / Math.max(1e-9, win(t - 0.15, t)));
    console.log(
      `    ${pad(`${s.role} [${s.entry ?? 'plain'}]`, 22)} t=${padL(t.toFixed(3), 8)} s  ${padL(fmtDb(before), 7)} -> ${padL(fmtDb(after), 7)} dBFS` +
        ` (${padL((after - before >= 0 ? '+' : '') + (after - before).toFixed(1), 5)} dB)   onset ${padL(Number.isFinite(onset) ? (onset >= 0 ? '+' : '') + onset.toFixed(1) : '+inf', 6)} dB`
    );
    if ((s.entry === 'drop1' || s.entry === 'drop2') && ['intro', 'break'].includes(s.prev.role) && !(after - before > 2)) problems.push(`music.wav: weak energy jump into the drop at ${t} s`);
  }

  // ------------------------------------------------------------ gates
  console.log('\n  Gates (digital silence right before a downbeat):');
  for (const g of plan.gates) {
    const pk = peakIn(g.a, g.b);
    const first = firstNonZero(Math.round(g.a * SR));
    const bi = Math.round(g.b * SR);
    const onDownbeat = first >= bi && first < bi + ONSET_TOL;
    console.log(
      `    ${pad(g.kind, 6)} ${g.a.toFixed(3)}-${g.b.toFixed(3)} s (${Math.round((g.b - g.a) * 1000)} ms, ${g.label}): ${pk === 0 ? 'digital silence' : 'NOT silent, peak ' + fmtDb(gainToDb(pk)) + ' dBFS'}` +
        `; sound resumes at sample ${first} = downbeat ${first - bi >= 0 ? '+' : ''}${first - bi} -> ${ok(pk === 0 && onDownbeat)}`
    );
    if (pk !== 0) problems.push(`music.wav: gate ${g.a}-${g.b} s is not silent`);
    if (!onDownbeat) problems.push(`music.wav: sound resumes at sample ${first}, not on the downbeat ${bi}`);
  }

  // ------------------------------------------------------------ final hit
  if (plan.hit) {
    const t = plan.hit.t;
    const hi = Math.round(t * SR);
    const gate = plan.gates.find((g) => g.b === t);
    const first = firstNonZero(Math.max(0, Math.round((gate ? gate.a : t - 0.018) * SR)));
    const rms10 = gainToDb(win(t, t + 0.01));
    const onset = gainToDb(win(t, t + 0.05) / Math.max(1e-9, win(t - 0.15, t)));
    const hitOk = first >= hi && first < hi + ONSET_TOL && rms10 > -30;
    console.log(
      `\n  Final hit at ${t.toFixed(3)} s (sample ${hi}): silent before it, first non-zero sample ${first} (downbeat +${first - hi}), first 10 ms RMS ${fmtDb(rms10)} dBFS,` +
        ` onset +${onset.toFixed(1)} dB -> ${ok(hitOk)}`
    );
    if (!hitOk) problems.push(`music.wav: final hit onset at sample ${first}, expected ${hi}`);
  }

  // ------------------------------------------------------------ ending
  let tailNZ = 0;
  for (let i = Math.round((plan.sec - 0.1) * SR); i < n; i++) if (L[i] !== 0 || R[i] !== 0) tailNZ++;
  let lastSound = 0;
  for (let i = n - 1; i >= 0; i--)
    if (L[i] !== 0 || R[i] !== 0) {
      lastSound = (i + 1) / SR;
      break;
    }
  console.log(
    `  Ending: last 0.1 s (${(plan.sec - 0.1).toFixed(3)}-${plan.sec.toFixed(3)} s) ${tailNZ === 0 ? 'digital silence' : tailNZ + ' non-zero samples'};` +
      ` last non-zero sample at ${lastSound.toFixed(4)} s; fade ${plan.fade[0].toFixed(3)}-${plan.fade[1].toFixed(3)} s -> ${ok(tailNZ === 0)}`
  );
  if (tailNZ) problems.push('music.wav: last 0.1 s not silent');

  // ------------------------------------------------------------ clicks at bar lines
  // Every bar line (+-25 ms): jump / flux relative to the median of all bar
  // lines (section starts with planned accents - drops, crashes, the hit - are
  // expected to be higher), plus the click score, also scanned over the whole file.
  const W = Math.round(0.025 * SR);
  const sL = clickScores(L);
  const sR = clickScores(R);
  const score = Float32Array.from(sL, (v, i) => Math.max(v, sR[i]));
  const accentAt = new Map();
  for (const s of plan.sections.slice(1)) accentAt.set(s.b0, `${s.role} ${s.entry ?? 'start'}`);
  for (const a of plan.accents) if (!accentAt.has(a.t / BAR)) accentAt.set(a.t / BAR, a.type);
  if (plan.hit) accentAt.set(plan.hit.b, 'final hit');
  const rows = [];
  for (let b = 1; b < plan.nBars; b++) rows.push({ b, ...boundaryMetrics(L, R, score, Math.round(b * BAR * SR), W), label: accentAt.get(b) ?? '' });
  const med = { jump: median(rows.map((r) => r.jump)), flux: median(rows.map((r) => r.flux)), click: median(rows.map((r) => r.click)) };
  console.log(`\n  Bar lines (${rows.length}, +-25 ms): median max-jump ${med.jump.toFixed(4)}, median flux ${med.flux.toFixed(1)}, median click score ${med.click.toFixed(1)} (limit ${CLICK_LIMIT})`);
  console.log('    bar  time (s)   jump  x med    flux  x med  click  planned');
  const showRow = (r) =>
    console.log(
      `    ${padL(r.b + 1, 3)} ${padL((r.b * BAR).toFixed(3), 9)} ${padL(r.jump.toFixed(4), 7)} ${padL((r.jump / med.jump).toFixed(2), 6)}` +
        ` ${padL(r.flux.toFixed(1), 7)} ${padL((r.flux / med.flux).toFixed(2), 6)} ${padL(r.click.toFixed(1), 6)}  ${r.label}`
    );
  rows.filter((r) => r.label).forEach(showRow);
  const plain = rows.filter((r) => !r.label);
  console.log('    ... the 5 most eventful plain bar lines (nothing planned on them):');
  [...plain].sort((x, y) => y.jump / med.jump + y.flux / med.flux - (x.jump / med.jump + x.flux / med.flux)).slice(0, 5).forEach(showRow);
  const maxJ = Math.max(0, ...plain.map((r) => r.jump / med.jump));
  const maxF = Math.max(0, ...plain.map((r) => r.flux / med.flux));
  console.log(`    plain bar lines: max jump x${maxJ.toFixed(2)}, max flux x${maxF.toFixed(2)} of the median (limits x3, x4) -> ${ok(maxJ <= 3 && maxF <= 4)}`);
  for (const r of plain) {
    if (r.jump > 3 * med.jump || r.flux > 4 * med.flux) problems.push(`music.wav: unexpected spike at the plain bar line ${(r.b * BAR).toFixed(3)} s (jump x${(r.jump / med.jump).toFixed(1)}, flux x${(r.flux / med.flux).toFixed(1)})`);
  }
  const top = [];
  for (let i0 = 0; i0 < n; i0 += AR_BLOCK) {
    let m = 0;
    let at = i0;
    for (let i = i0; i < Math.min(n, i0 + AR_BLOCK); i++) if (score[i] > m) (m = score[i]), (at = i);
    top.push([m, at]);
  }
  top.sort((x, y) => y[0] - x[0]);
  console.log(
    `    click score, whole file: max ${top[0][0].toFixed(1)} at ${(top[0][1] / SR).toFixed(4)} s; next ${top
      .slice(1, 4)
      .map(([m, at]) => `${m.toFixed(1)} @ ${(at / SR).toFixed(3)} s`)
      .join(', ')} -> ${ok(top[0][0] <= CLICK_LIMIT)}`
  );
  for (const [m, at] of top) if (m > CLICK_LIMIT) problems.push(`music.wav: possible click at ${(at / SR).toFixed(4)} s (click score ${m.toFixed(1)} > ${CLICK_LIMIT})`);

  // ------------------------------------------------------------ per bar
  const bars = [];
  for (let b = 0; b < plan.nBars; b++) bars.push(`${b + 1}:${fmtDb(gainToDb(win(b * BAR, (b + 1) * BAR)))}`);
  console.log('\n  RMS per bar (dBFS, bars 1-based):');
  for (let k = 0; k < bars.length; k += 12) console.log('    ' + bars.slice(k, k + 12).join(' '));

  // ------------------------------------------------------------ spectral balance
  {
    const ranges = plan.grooveBRanges;
    const idx = [];
    for (const [a, b] of ranges) idx.push([Math.round(a * SR), Math.round(b * SR)]);
    const len = idx.reduce((s, [a, b]) => s + b - a, 0);
    const mid = new Float64Array(len);
    let o = 0;
    let m2 = 0;
    let s2 = 0;
    for (const [a, b] of idx)
      for (let i = a; i < b; i++) {
        mid[o++] = (L[i] + R[i]) / 2;
        m2 += ((L[i] + R[i]) / 2) ** 2;
        s2 += ((L[i] - R[i]) / 2) ** 2;
      }
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
      [1000, 4000, '| speech band 1-4k'],
    ];
    const parts = bands.map(([lo, hi, label]) => {
      const b = filt(filt(filt(filt(mid, 'hp', lo), 'hp', lo), 'lp', hi), 'lp', hi);
      return `${label} ${fmtDb(10 * Math.log10(ms(b) / total))}`;
    });
    console.log(`  groove B band energy (dB rel. total): ${parts.join(', ')}`);
    console.log(`  groove B stereo width: side/mid = ${fmtDb(10 * Math.log10(s2 / m2))} dB`);
  }
  return problems;
}
