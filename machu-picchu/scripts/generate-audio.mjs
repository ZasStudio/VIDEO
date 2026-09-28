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
//   node scripts/generate-audio.mjs                           music (scripts/song.json) + SFX
//   node scripts/generate-audio.mjs --song scripts/song.json  music from a song description + SFX
//   node scripts/generate-audio.mjs --music-only              skip the SFX
//
// Options: --song <file.json>   song description (default: scripts/song.json,
//                                or the built-in default structure if missing)
//          --music-only         only write music.wav
//          --voice-mix / --no-voice-mix   override the song's "voiceMix"
//          --out <file.wav>     music output (default: public/audio/music.wav)
//
// Writes public/audio/*.wav (48 kHz, stereo, 16-bit PCM) and prints a
// verification report computed by re-reading every file from disk.
// Modules: scripts/audio/{dsp,instruments,arrangement,music,sfx,verify}.mjs
// =============================================================================

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SR, samples, fitLength, filtStereo, fadeOutRange, normalizePeak, writeWav, gainToDb, rmsOf } from './audio/dsp.mjs';
import { DEFAULT_SONG, loadSong, normalizeSong, planSong, describePlan } from './audio/arrangement.mjs';
import { renderMusic, master, sumStems, MIX, TARGET_RMS_DB, CEILING_DB } from './audio/music.mjs';
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
const DEFAULT_SONG_PATH = join(HERE, 'song.json');

const USAGE = `usage: node scripts/generate-audio.mjs [--song <file.json>] [--music-only] [--voice-mix | --no-voice-mix] [--out <file.wav>]

  --song <file>     song description, e.g. scripts/song.json (default: scripts/song.json,
                    or the built-in default structure when that file does not exist)
  --music-only      write only the music (skip the SFX)
  --voice-mix       make room for a narrator (flutes pulled down in 1-4 kHz, wide 2-3.5 kHz dip, calmer hats)
  --no-voice-mix    plain mix (default: the song's "voiceMix", true when omitted)
  --out <file>      music output path (default: public/audio/music.wav)

song file: { "voiceMix": true, "sections": [ { "role": "intro", "bars": 4 }, ... ] }
  role   intro | grooveA | grooveB | break | build | final     bars   whole number >= 1 (1 bar = 2 s)
  start  "drop" | "fill" | "none" (optional)                    hitBar final only, 0-based bar of the final hit
  label  optional free text (printed in the report)`;

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

function parseArgs(argv) {
  const o = { song: null, musicOnly: false, voiceMix: null, out: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      if (i + 1 >= argv.length || argv[i + 1].startsWith('--')) throw new Error(`${a} needs a value (try --help)`);
      return argv[++i];
    };
    if (a === '--song') o.song = value();
    else if (a.startsWith('--song=')) o.song = a.slice('--song='.length);
    else if (a === '--out') o.out = value();
    else if (a.startsWith('--out=')) o.out = a.slice('--out='.length);
    else if (a === '--music-only') o.musicOnly = true;
    else if (a === '--voice-mix') o.voiceMix = true;
    else if (a === '--no-voice-mix') o.voiceMix = false;
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error(`unknown argument "${a}" (try --help)`);
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const t0 = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  // ------------------------------------------------------------------ song
  let song;
  let from;
  if (args.song) {
    song = loadSong(resolve(args.song));
    from = args.song;
  } else if (existsSync(DEFAULT_SONG_PATH)) {
    song = loadSong(DEFAULT_SONG_PATH);
    from = 'scripts/song.json (default)';
  } else {
    song = normalizeSong(DEFAULT_SONG, 'built-in default song');
    from = 'the built-in default structure (scripts/song.json not found)';
  }
  if (args.voiceMix !== null) song.voiceMix = args.voiceMix;
  for (const w of song.warnings) console.warn(`warning: ${w}`);
  const plan = planSong(song);
  console.log(`Song from ${from}:`);
  console.log(describePlan(plan));

  // ------------------------------------------------------------------ music
  const musicPath = args.out ? resolve(args.out) : join(OUT_DIR, 'music.wav');
  mkdirSync(dirname(musicPath), { recursive: true });
  const { stems, report } = renderMusic(plan);
  const m = master(stems, plan);
  writeWav(musicPath, m.out);
  console.log(
    `\n${musicPath}: glue comp max ${m.comp.maxGrDb.toFixed(2)} dB (mean ${m.comp.meanGrDb.toFixed(2)} dB), final gain ${m.preDb.toFixed(2)} dB,` +
      ` true-peak limiter max reduction ${m.maxReductionDb.toFixed(2)} dB (ceiling ${CEILING_DB} dBTP), groove RMS ${m.rmsDb.toFixed(2)} dBFS (target ${TARGET_RMS_DB}, ${m.iterations} passes)`
  );
  if (report.fluteCut) {
    const c = report.fluteCut;
    console.log(
      `voice mix: flutes' 1-4 kHz band cut ${c.meanCutDb.toFixed(2)} dB on average while playing (max ${c.maxCutDb.toFixed(2)} dB, threshold ${c.thresholdDb.toFixed(1)} dB, ${c.activeSec.toFixed(1)} s active);` +
        ' second flute -1.5 dB; hats -2 dB (open -3 dB); music bus -2.5 dB at 2.65 kHz (Q 0.8)'
    );
  }
  const sum = sumStems(stems);
  const mixK = rmsOf(kWeight(sum), plan.grooveBRanges);
  console.log(
    'stem loudness in groove B (K-weighted, dB relative to the full mix): ' +
      Object.keys(MIX)
        .map((k) => `${k} ${fmtDb(gainToDb((MIX[k] * rmsOf(kWeight(stems[k]), plan.grooveBRanges)) / mixK))}`)
        .join(', ')
  );

  // -------------------------------------------------------------------- SFX
  const sfx = args.musicOnly ? [] : SFX;
  for (const [name, len, gen, peakDb] of sfx) {
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
  for (const [name, len, , peakDb] of [['music.wav', plan.sec, null, null], ...sfx]) {
    const path = name === 'music.wav' ? musicPath : join(OUT_DIR, name);
    const s = fileStats(path);
    const { w } = s;
    printRow(name, s);
    if (w.sampleRate !== SR || w.channels !== 2 || w.bits !== 16) problems.push(`${name}: wrong format`);
    if (s.bad) problems.push(`${name}: non-finite samples`);
    if (s.dcPct > 0.5) problems.push(`${name}: DC offset ${s.dcPct.toFixed(3)}%`);
    if (Math.abs(w.duration - len) > 0.001) problems.push(`${name}: duration ${w.duration} != ${len}`);
    if (s.firstDb > -40) problems.push(`${name}: first sample ${fmtDb(s.firstDb)} dBFS (click risk)`);
    if (s.lastDb > -60) problems.push(`${name}: last sample ${fmtDb(s.lastDb)} dBFS (click risk)`);
    if (name === 'music.wav') {
      if (s.peakDb > -1.2) problems.push('music.wav: sample peak above -1.2 dBFS');
    } else if (Math.abs(s.peakDb - peakDb) > 0.1) {
      problems.push(`${name}: peak ${fmtDb(s.peakDb)} != ${peakDb} dBFS`);
    }
    if (name.startsWith('voice-') && (w.duration < 0.07 - 1e-6 || w.duration > 0.11 + 1e-6)) problems.push(`${name}: duration outside 0.07-0.11 s`);
  }
  problems.push(...verifyMusic(musicPath, plan));
  console.log(problems.length ? `\nPROBLEMS:\n  ${problems.join('\n  ')}` : '\nAll format / length / peak / DC / edge / timing / click checks passed.');
  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${args.musicOnly ? musicPath : OUT_DIR}`);
  if (problems.length) process.exitCode = 1;
}

try {
  main();
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exitCode = 2;
}
