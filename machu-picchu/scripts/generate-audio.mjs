#!/usr/bin/env node
// =============================================================================
// scripts/generate-audio.mjs
//
// Procedural audio for "How Machu Picchu was built" (Remotion project).
// Every sound is synthesized from plain math (oscillators, noise, envelopes,
// filters, delays, Karplus-Strong strings). No samples, no downloads, no
// external services, zero npm deps. Deterministic: all randomness comes from
// seeded PRNGs (never Math.random), so every run writes identical files.
//
//   node scripts/generate-audio.mjs
//
// Writes public/audio/*.wav (48 kHz, stereo, 16-bit PCM) and prints a
// verification report computed by re-reading every file from disk.
// Modules: scripts/audio/{dsp,instruments,music,sfx,verify}.mjs
// =============================================================================

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SR, samples, fitLength, filtStereo, fadeOutRange, normalizePeak, writeWav, gainToDb, rmsOf } from './audio/dsp.mjs';
import { renderMusic, master, sumStems, MIX, SONG_SEC, T, GAP, GROOVE_RANGES, BAR, TARGET_RMS_DB } from './audio/music.mjs';
import {
  sfxImpact,
  sfxWhoosh,
  sfxPop,
  sfxDing,
  sfxTick,
  sfxRiser,
  sfxRumble,
  sfxRain,
  sfxThunder,
  sfxStoneThud,
  sfxStoneClack,
  sfxPaper,
  sfxRope,
  sfxSparkle,
  voiceBlip,
  VOICES,
} from './audio/sfx.mjs';
import { fileStats, printTableHeader, printRow, verifyMusic, kWeight, fmtDb } from './audio/verify.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'audio');

// [file, length (s), generator, peak dBFS]
const SFX = [
  ['impact.wav', 1.6, () => sfxImpact(), -3],
  ['whoosh.wav', 0.6, () => sfxWhoosh(), -3],
  ['whoosh-short.wav', 0.35, () => sfxWhoosh({ dur: 0.35, fLo: 800, fPeak: 7000, fEnd: 2000, peakAt: 0.45, q: 1.3, panFrom: -0.6, panTo: 0.7, seed: 502 }), -3],
  ['pop.wav', 0.15, () => sfxPop(), -3],
  ['ding.wav', 0.9, () => sfxDing(), -3],
  ['tick.wav', 0.05, () => sfxTick(), -3],
  ['riser.wav', 2.0, () => sfxRiser(), -3],
  ['rumble.wav', 3.0, () => sfxRumble(), -3],
  ['rain.wav', 6.0, () => sfxRain(), -3],
  ['thunder.wav', 2.5, () => sfxThunder(), -3],
  ['stone-thud.wav', 0.5, () => sfxStoneThud(), -3],
  ['stone-clack.wav', 0.25, () => sfxStoneClack(), -3],
  ['paper.wav', 0.5, () => sfxPaper(), -3],
  ['rope.wav', 0.8, () => sfxRope(), -3],
  ['sparkle.wav', 0.8, () => sfxSparkle(), -3],
  ...VOICES.map((v, k) => [`voice-${k + 1}.wav`, v.dur, () => voiceBlip(v), -6]),
];

function main() {
  const t0 = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  // ------------------------------------------------------------------ music
  const stems = renderMusic();
  const m = master(stems);
  writeWav(join(OUT_DIR, 'music.wav'), m.out);
  console.log(
    `music.wav: glue comp max ${m.comp.maxGrDb.toFixed(2)} dB (mean ${m.comp.meanGrDb.toFixed(2)} dB), final gain ${m.preDb.toFixed(2)} dB,` +
      ` limiter max reduction ${m.maxReductionDb.toFixed(2)} dB, groove RMS ${m.rmsDb.toFixed(2)} dBFS (target ${TARGET_RMS_DB})`
  );
  const sum = sumStems(stems);
  const mixK = rmsOf(kWeight(sum), [[T.DROP2, T.BUILD]]);
  console.log(
    'stem loudness in groove B (K-weighted, dB relative to the full mix): ' +
      Object.keys(MIX)
        .map((k) => `${k} ${fmtDb(gainToDb((MIX[k] * rmsOf(kWeight(stems[k]), [[T.DROP2, T.BUILD]])) / mixK))}`)
        .join(', ')
  );

  // -------------------------------------------------------------------- SFX
  for (const [name, len, gen, peakDb] of SFX) {
    const buf = fitLength(gen(), samples(len));
    filtStereo(buf, 'hp', 20, 0.7); // DC / infrasonic guard
    // declick after the filter; the riser keeps its peak at the very end (1.5 ms cut only)
    fadeOutRange(buf, len - (name === 'riser.wav' ? 0.0015 : 0.003), len);
    normalizePeak(buf, peakDb);
    writeWav(join(OUT_DIR, name), buf);
  }

  // ----------------------------------------------------------- verification
  console.log('\nVerification (every file re-read from disk; first/0.1ms/last = |sample| in dBFS at the file edges):');
  printTableHeader();
  const problems = [];
  for (const [name, len, , peakDb] of [['music.wav', SONG_SEC, null, null], ...SFX]) {
    const s = fileStats(join(OUT_DIR, name));
    const { w } = s;
    printRow(name, s);
    if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16) problems.push(`${name}: wrong format`);
    if (s.bad) problems.push(`${name}: non-finite samples`);
    if (s.dcPct > 0.5) problems.push(`${name}: DC offset ${s.dcPct.toFixed(3)}%`);
    if (Math.abs(w.duration - len) > 0.001) problems.push(`${name}: duration ${w.duration} != ${len}`);
    if (s.firstDb > -40) problems.push(`${name}: first sample ${fmtDb(s.firstDb)} dBFS (click risk)`);
    if (s.lastDb > -60) problems.push(`${name}: last sample ${fmtDb(s.lastDb)} dBFS (click risk)`);
    if (name === 'music.wav') {
      if (s.peakDb > -1.0) problems.push('music.wav: peak above -1 dBFS');
    } else if (Math.abs(s.peakDb - peakDb) > 0.1) {
      problems.push(`${name}: peak ${fmtDb(s.peakDb)} != ${peakDb} dBFS`);
    }
    if (name.startsWith('voice-') && (w.duration < 0.07 - 1e-6 || w.duration > 0.11 + 1e-6)) problems.push(`${name}: duration outside 0.07-0.11 s`);
  }
  problems.push(...verifyMusic(join(OUT_DIR, 'music.wav'), { SONG_SEC, T, GAP, GROOVE_RANGES, BAR }));
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / DC / edge / timing checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${OUT_DIR}`);
  if (problems.length) process.exitCode = 1;
}

main();
