// =============================================================================
// scripts/audio/arrangement.mjs - song description -> arrangement plan.
//
// A song is a list of sections (see scripts/song.json):
//
//   { "voiceMix": true,
//     "sections": [ { "role": "intro", "bars": 4 },
//                   { "role": "grooveA", "bars": 14, "start": "drop" }, ... ] }
//
// Every section is a whole number of bars (1 bar = 4 beats = 2 s at 120 BPM),
// so section boundaries always fall on bar lines and the song lasts exactly
// sum(bars) x 2 s. This module decides WHAT is played WHEN: chords per bar,
// which riff the flutes play, where the charango answers, which bars end with
// a fill, where the drops, the gaps, the final hit and the fade are.
// music.mjs decides HOW it sounds.
//
// Bar numbers are 0-based and absolute (bar b spans [2b, 2b + 2) seconds).
// =============================================================================

import { readFileSync } from 'node:fs';
import { SR } from './dsp.mjs';

export const BPM = 120;
export const BAR = 2; // seconds per bar
export const STEP = BAR / 16; // 16th note = 0.125 s
export const barStart = (b) => b * BAR;
export const at = (b, s) => b * BAR + s * STEP;

export const ROLES = ['intro', 'grooveA', 'grooveB', 'break', 'build', 'final'];
export const STARTS = ['drop', 'fill', 'none'];

// The structure rendered when no song file is given (and the one in scripts/song.json).
export const DEFAULT_SONG = {
  voiceMix: true,
  sections: [
    { role: 'intro', bars: 4 },
    { role: 'grooveA', bars: 14, start: 'drop' },
    { role: 'break', bars: 6 },
    { role: 'grooveB', bars: 12, start: 'drop' },
    { role: 'grooveB', bars: 10, start: 'fill' },
    { role: 'grooveB', bars: 11, start: 'fill' },
    { role: 'build', bars: 5 },
    { role: 'final', bars: 6, hitBar: 2 },
  ],
};

// Gate lengths (digital silence right before a downbeat, applied after the limiter).
export const GATE = {
  gap: { len: 0.06, fade: 0.008 }, // before a drop that follows the break build (as before drop 2)
  breath: { len: 0.022, fade: 0.006 }, // before any other drop / the final tag
  hit: { len: 0.018, fade: 0.006 }, // before the final hit
};

// ----------------------------------------------------------------------------
// Harmony. bass = MIDI root for the bass, pad/arp/strum = voicings,
// pcs = chord pitch classes (for the second flute).
// ----------------------------------------------------------------------------
export const CH = {
  Am: { bass: 33, pad: [57, 60, 64, 67], arp: [64, 69, 72, 76], strum: [69, 72, 76, 81], pcs: [9, 0, 4] },
  F: { bass: 29, pad: [53, 57, 60, 64], arp: [65, 69, 72, 77], strum: [69, 72, 77, 81], pcs: [5, 9, 0] },
  C: { bass: 36, pad: [55, 60, 64, 67], arp: [67, 72, 76, 79], strum: [67, 72, 76, 79], pcs: [0, 4, 7] },
  G: { bass: 31, pad: [55, 59, 62, 67], arp: [67, 71, 74, 79], strum: [67, 71, 74, 79], pcs: [7, 11, 2] },
  Dm: { bass: 38, pad: [53, 57, 62, 64], arp: [65, 69, 74, 77], strum: [69, 74, 77, 81], pcs: [2, 5, 9] },
  Esus: { bass: 28, pad: [52, 57, 59, 62], arp: [64, 69, 71, 74], strum: [69, 71, 76, 81], pcs: [4, 9, 11, 2] },
  E: { bass: 28, pad: [52, 56, 59, 62], arp: [64, 68, 71, 76], strum: [68, 71, 76, 80], pcs: [4, 8, 11, 2] },
};
const LOOP = ['Am', 'F', 'C', 'G']; // groove phrase: i - VI - III - VII
const INTRO_CH = { 1: ['Am'], 2: ['Am', 'G'], 3: ['Am', 'F', 'G'], 4: ['Am', 'F', 'C', 'G'] };

// ----------------------------------------------------------------------------
// Melody notation: "step:Note:len[flags]" per bar. Flags: ^ scoop, > accent.
// ----------------------------------------------------------------------------
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function nameToMidi(s) {
  const m = /^([A-G])(#|b)?(\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
function parseBar(b, str, vel = 0.9) {
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

// Main hook (tresillo 3-3-2 opening every bar), one bar per chord of Am - F - C - G.
const RIFF = {
  A: [
    '0:E5:3 3:A5:3^ 6:G5:2 8:E5:2 10:D5:1 11:E5:1 12:C5:2 14:D5:2',
    '0:C5:3 3:A4:3 6:C5:2 8:D5:6',
    '0:G5:3 3:C6:3^ 6:A5:2 8:G5:2 10:E5:1 11:G5:1 12:E5:2 14:D5:2',
    '0:D5:3 3:E5:3 6:D5:2 8:G5:6',
  ],
  B: [
    '0:A5:3^ 3:G5:3 6:E5:2 8:A5:2 10:G5:1 11:A5:1 12:C6:2 14:A5:2',
    '0:G5:3 3:E5:3 6:D5:2 8:C5:6',
    '0:E5:3 3:G5:3 6:A5:2 8:G5:2 10:E5:1 11:D5:1 12:C5:2 14:D5:2',
    '0:D5:3 3:C5:3 6:A4:2 8:G4:4 12:A4:1 13:C5:1 14:D5:2',
  ],
  C: [
    '0:A5:3^ 3:C6:3 6:A5:2 8:G5:2 10:E5:1 11:G5:1 12:A5:2 14:G5:2',
    '0:A5:3 3:G5:3 6:E5:2 8:C5:6',
    '0:E5:3 3:G5:3 6:C6:2^ 8:A5:2 10:G5:1 11:E5:1 12:G5:2 14:A5:2',
    '0:B5:3 3:A5:3 6:G5:2 8:D5:6', // (the 60 s version never reached this bar: it went to the build)
  ],
};
// Call and response phrases: a short flute call (bar 1), the charango answers
// with a tremolo melody (bars 2-3, flute resting), flute pickup (bar 4).
const ANSWER = {
  ANS1: {
    call: '0:E5:3 3:A5:3^ 6:G5:2 8:A5:7',
    charango: ['0:C5:2 2:A4:1 3:C5:2 5:A4:1 6:G4:2 8:A4:2 10:C5:2 12:D5:2 14:C5:2', '0:E5:3 3:D5:3 6:C5:2 8:A4:2 10:G4:2 12:A4:2 14:C5:2'],
    pickup: '8:D5:2 10:E5:2 12:G5:4',
  },
  ANS2: {
    call: '0:A5:3^ 3:C6:3 6:A5:2 8:E5:7',
    charango: ['0:A4:3 3:C5:3 6:F5:2 8:C5:2 10:A4:2 12:G4:2 14:A4:2', '0:G4:3 3:C5:3 6:E5:2 8:G5:2 10:E5:2 12:D5:2 14:C5:2'],
    pickup: '8:B4:2 10:D5:2 12:G5:4',
  },
};
// Phrase cycle for groove sections: a full riff, then a charango answer, and so
// on (A, B, C rotate; the two answers alternate). A drop restarts the cycle on
// the main hook; other sections continue it, so repeats are never back to back.
const PHRASES = ['A', 'ANS1', 'B', 'ANS2', 'C', 'ANS1', 'A', 'ANS2', 'B', 'ANS1', 'C', 'ANS2'];
const isAnswer = (type) => type in ANSWER;

// Intro call over the last intro bars (soft). The last bar carries the pickup
// run when the next section starts with a drop.
const INTRO_MEL = {
  call: '8:E5:4 12:A5:12^', // A5 held into the next bar
  answer: '12:G5:2 14:E5:10', // E5 held into the next bar
  third: '12:G5:2 14:D5:10', // D5 held into the next bar
  pickup: '12:G4:1 13:A4:1 14:C5:1 15:D5:1',
};
const INTRO_LINES = { 1: ['pickup'], 2: ['call', 'pickup'], 3: ['call', 'answer', 'pickup'], 4: ['call', 'answer', 'third', 'pickup'] };

// Break: long notes over Dm - F (pairs), then E. Second passes climb higher.
const BREAK_MEL = {
  dm: ['0:F5:12 12:E5:12', '0:A5:12 12:G5:12'], // second note held into the F bar
  dmShort: ['0:F5:8 8:E5:6', '0:A5:8 8:G5:6'], // Dm right before the E bar
  f: ['8:C5:8', '8:F5:8'],
  pickup: '0:D5:8 8:B4:5 13:C5:1 14:D5:2', // into the drop (E5 on the downbeat)
  end: '0:D5:8 8:B4:8',
};
const BUILD_TRILL = '0:G5:8 8:A5:1 9:G5:1 10:A5:1 11:G5:1 12:A5:1 13:G5:1 14:A5:1 15:G5:1';
// Final tag (F-G, resolving to the A5 of the hit). With two tag bars the second climbs higher.
const TAG_MEL = {
  main: '0:E5:3 3:A5:3^ 6:G5:2 8:E5:2 10:D5:1 11:E5:1 12:G5:4',
  high: '0:C6:3 3:A5:3^ 6:C6:2 8:B5:2 10:A5:1 11:G5:1 12:B5:4',
};
const HIT_MEL = '0:A5:14^';

// ----------------------------------------------------------------------------
// Song description: load + validate
// ----------------------------------------------------------------------------
const SECTION_KEYS = ['role', 'bars', 'start', 'hitBar', 'label'];
const isComment = (k) => k.startsWith('_') || k.startsWith('$') || k.startsWith('//');

export function loadSong(path) {
  let raw;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: ${e.message}`);
  }
  return normalizeSong(raw, path);
}

// Returns { voiceMix, sections: [{ role, bars, start, hitBar, label }], warnings }
// or throws with every problem found (unknown fields are errors, so typos such
// as "hitbar" cannot silently move the final hit).
export function normalizeSong(raw, where = 'song') {
  const errs = [];
  const warnings = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`${where}: expected a JSON object like { "sections": [ ... ] }`);
  for (const k of Object.keys(raw)) if (!['sections', 'voiceMix'].includes(k) && !isComment(k)) errs.push(`unknown field "${k}" (allowed: sections, voiceMix)`);
  if (raw.voiceMix !== undefined && typeof raw.voiceMix !== 'boolean') errs.push('"voiceMix" must be true or false');
  if (!Array.isArray(raw.sections) || raw.sections.length === 0) errs.push('"sections" must be a non-empty array');
  const list = Array.isArray(raw.sections) ? raw.sections : [];
  const sections = list.map((s, i) => {
    const w = `sections[${i}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      errs.push(`${w}: expected an object`);
      return null;
    }
    for (const k of Object.keys(s)) if (!SECTION_KEYS.includes(k) && !isComment(k)) errs.push(`${w}: unknown field "${k}" (allowed: ${SECTION_KEYS.join(', ')})`);
    if (!ROLES.includes(s.role)) errs.push(`${w}: "role" must be one of ${ROLES.join(', ')} (got ${JSON.stringify(s.role)})`);
    if (!Number.isInteger(s.bars) || s.bars < 1) errs.push(`${w}: "bars" must be a whole number >= 1 (got ${JSON.stringify(s.bars)})`);
    const start = s.start ?? 'none';
    if (!STARTS.includes(start)) errs.push(`${w}: "start" must be "drop", "fill" or "none" (got ${JSON.stringify(s.start)})`);
    let hitBar;
    if (s.role === 'final') {
      hitBar = s.hitBar ?? Math.min(2, s.bars - 1);
      if (!Number.isInteger(hitBar) || hitBar < 0 || (Number.isInteger(s.bars) && hitBar > s.bars - 1)) {
        errs.push(`${w}: "hitBar" must be a whole number from 0 to bars - 1 (got ${JSON.stringify(s.hitBar)})`);
      }
    } else if (s.hitBar !== undefined) errs.push(`${w}: "hitBar" only applies to the "final" role`);
    if (s.label !== undefined && typeof s.label !== 'string') errs.push(`${w}: "label" must be a string`);
    return { role: s.role, bars: s.bars, start, hitBar, label: s.label ?? '' };
  });
  sections.forEach((s, i) => {
    if (!s) return;
    if (s.role === 'final' && i !== sections.length - 1) errs.push(`sections[${i}]: "final" must be the last section (it ends the song)`);
    if (s.role === 'intro' && i !== 0) errs.push(`sections[${i}]: "intro" must be the first section`);
    if (i === 0 && s.start !== 'none') warnings.push(`sections[0]: "start": "${s.start}" on the first section only adds its downbeat accent (there is no previous bar)`);
  });
  if (sections.length && sections[sections.length - 1] && sections[sections.length - 1].role !== 'final') {
    warnings.push('the song does not end with a "final" section: it is faded out over its last bar');
  }
  if (errs.length) throw new Error(`${where}:\n  ${errs.join('\n  ')}`);
  return { voiceMix: raw.voiceMix ?? true, sections, warnings };
}

// ----------------------------------------------------------------------------
// Transitions between sections
// ----------------------------------------------------------------------------
// exit = what the LAST bar of a section does to lead into the next one.
function exitOf(s) {
  const nx = s.next;
  if (!nx || s.role === 'final') return null;
  if (s.role === 'build') return 'roll'; // the build always ends with its snare roll + riser
  if (nx.start === 'drop') {
    if (s.role === 'intro') return 'pickup'; // flute pickup run + riser + reverse cymbal
    if (s.role === 'break') return 'buildDrop'; // the E build bar + 60 ms of digital silence
    return 'fillRiser'; // groove straight into a drop: tom fill + short riser
  }
  if (nx.start === 'fill') return 'fill'; // tom/snare fill + cymbal swell (crash on the downbeat)
  if (nx.role === 'break') return 'lift'; // two toms into the break
  if (nx.role === 'final') return 'fill';
  return null;
}
// entry = accent on the FIRST downbeat of a section.
function entryOf(s) {
  if (s.start === 'drop') return s.prev && s.prev.role === 'intro' ? 'drop1' : 'drop2';
  if (s.role === 'break') return 'break'; // low boom + dark crash (also after a fill)
  if (s.start === 'fill') return 'crash';
  return null; // the final tag bar plays its own crash
}

// Loop positions (0..3 = Am F C G) for n bars, grouped in phrases: whole 4-bar
// phrases from the top, then a shorter phrase made of the END of the loop, so
// a groove section always starts on Am and always ends on G (leading to Am).
function phraseGroups(n) {
  const groups = [];
  const full = Math.floor(n / 4) * 4;
  for (let k0 = 0; k0 < full; k0 += 4) groups.push({ k0, qs: [0, 1, 2, 3] });
  const r = n - full;
  if (r) groups.push({ k0: full, qs: Array.from({ length: r }, (_, j) => 4 - r + j) });
  return groups;
}

// Outro chords, counted from the end: ... F, G, Am (last bar), earlier bars alternate.
function outroChords(m) {
  const fromEnd = (j) => (j === 0 ? 'Am' : j === 1 ? 'G' : j === 2 ? 'F' : j % 2 === 1 ? 'Am' : 'F');
  return Array.from({ length: m }, (_, k) => fromEnd(m - 1 - k));
}

// ----------------------------------------------------------------------------
// Section arrangers: fill plan.bars, plan.lead, plan.charango, plan.accents
// ----------------------------------------------------------------------------
function setBar(plan, s, k, info) {
  const b = s.b0 + k;
  plan.bars[b] = { b, sec: s, k, fillAfter: false, arpScale: 1, lift: 0, ...info };
}
function addLead(plan, b, str, vel, { harm = false } = {}) {
  for (const nt of parseBar(b, str, vel)) plan.lead.push({ ...nt, harm });
}
function grooveMelody(plan, b, type, q, B) {
  if (!isAnswer(type)) {
    addLead(plan, b, RIFF[type][q], B ? (type === 'C' ? 1.0 : 0.95) : 0.86, { harm: B });
    return;
  }
  const ans = ANSWER[type];
  if (q === 0) addLead(plan, b, ans.call, B ? 0.95 : 0.86, { harm: B });
  else if (q === 3) addLead(plan, b, ans.pickup, B ? 0.85 : 0.8);
  else plan.charango.push(...parseBar(b, ans.charango[q - 1], 1));
}
function grooveBars(plan, s, k0, n, B, counters, key) {
  for (const g of phraseGroups(n)) {
    const type = PHRASES[counters[key]++ % PHRASES.length];
    g.qs.forEach((q, j) => {
      const k = k0 + g.k0 + j;
      setBar(plan, s, k, { kind: 'groove', B, ch: [LOOP[q]], q, phrase: type, arpScale: isAnswer(type) && (q === 1 || q === 2) ? 0.6 : 1 });
      grooveMelody(plan, s.b0 + k, type, q, B);
    });
  }
}

function arrangeIntro(plan, s) {
  const n = s.bars;
  const pre = Math.max(0, n - 4); // long intros: plain loop bars first, the flute call in the last 4
  const tail = INTRO_CH[Math.min(n, 4)];
  for (let k = 0; k < n; k++) setBar(plan, s, k, { kind: 'intro', ch: [k < pre ? LOOP[k % 4] : tail[k - pre]] });
  INTRO_LINES[Math.min(n, 4)].forEach((name, j) => {
    const b = s.b0 + pre + j;
    if (name !== 'pickup') addLead(plan, b, INTRO_MEL[name], 0.55);
    else if (s.exit === 'pickup') addLead(plan, b, INTRO_MEL.pickup, 0.75);
  });
  if (s.exit === 'fill') plan.bars[s.b1 - 1].fillAfter = true;
}

function arrangeGroove(plan, s, counters) {
  const B = s.role === 'grooveB';
  if (s.start === 'drop') counters[s.role] = 0; // a drop always brings back the main hook
  grooveBars(plan, s, 0, s.bars, B, counters, s.role);
  // a small fill (+ light crash) at the end of every second full phrase
  const full = Math.floor(s.bars / 4) * 4;
  for (let k = 7; k < Math.min(full, s.bars - 1); k += 8) {
    plan.bars[s.b0 + k].fillAfter = true;
    plan.accents.push({ t: barStart(s.b0 + k + 1), type: 'crashSmall' });
  }
  if (s.exit === 'fill' || s.exit === 'fillRiser') plan.bars[s.b1 - 1].fillAfter = true;
}

function arrangeBreak(plan, s) {
  const n = s.bars;
  for (let k = 0; k < n - 1; k++) {
    const dm = k % 2 === 0;
    const pass = Math.floor(k / 2);
    setBar(plan, s, k, { kind: 'tension', ch: [dm ? 'Dm' : 'F'], pass, lift: n > 2 ? k / (n - 2) : 0 });
    const line = dm ? (k === n - 2 ? BREAK_MEL.dmShort : BREAK_MEL.dm)[pass % 2] : BREAK_MEL.f[pass % 2];
    addLead(plan, s.b0 + k, line, dm ? 0.58 : 0.62);
  }
  const drop = s.exit === 'buildDrop';
  setBar(plan, s, n - 1, { kind: drop ? 'breakBuild' : 'breakEnd', ch: ['Esus', 'E'], lift: 1 });
  addLead(plan, s.b1 - 1, drop ? BREAK_MEL.pickup : BREAK_MEL.end, drop ? 0.72 : 0.62);
  if (s.exit === 'fill') plan.bars[s.b1 - 1].fillAfter = true;
}

function arrangeBuild(plan, s) {
  const n = s.bars;
  for (const g of phraseGroups(n)) {
    g.qs.forEach((q, j) => {
      const k = g.k0 + j;
      if (k === n - 1) {
        // the build bar proper (always G: phrase groups end on the last loop chord)
        setBar(plan, s, k, { kind: 'buildBar', ch: ['G'], q, lift: 1 });
        addLead(plan, s.b0 + k, BUILD_TRILL, 0.95);
      } else {
        setBar(plan, s, k, { kind: 'groove', B: true, ch: [LOOP[q]], q, phrase: 'C', lift: (k + 1) / n });
        grooveMelody(plan, s.b0 + k, 'C', q, true); // the climbing riff
      }
    });
  }
}

function arrangeFinal(plan, s, counters) {
  const n = s.bars;
  const h = s.hitBar;
  const nTag = Math.min(h, 2);
  const nPre = h - nTag; // groove bars before the tag (only when hitBar > 2)
  const m = n - h - 1; // outro bars after the hit
  if (nPre > 0) {
    grooveBars(plan, s, 0, nPre, true, counters, 'grooveB');
    plan.bars[s.b0 + nPre - 1].fillAfter = true;
  }
  for (let j = 0; j < nTag; j++) {
    setBar(plan, s, nPre + j, { kind: 'tag', ch: ['F', 'G'], first: j === 0, last: j === nTag - 1 });
    addLead(plan, s.b0 + nPre + j, nTag === 2 && j === 1 ? TAG_MEL.high : TAG_MEL.main, 1.0, { harm: true });
  }
  const bh = s.b0 + h;
  setBar(plan, s, h, { kind: 'hit', ch: ['Am'] });
  addLead(plan, bh, HIT_MEL, 1.0, { harm: true });
  plan.hit = { t: barStart(bh), b: bh };
  const oc = outroChords(m);
  for (let j = 0; j < m; j++) setBar(plan, s, h + 1 + j, { kind: 'outro', ch: [oc[j]], j, m });
  // a last, soft flute call (the intro motif) over the outro, ending on E5 in the last bar
  if (m >= 2) {
    const b = bh + 1 + Math.max(0, m - 3);
    addLead(plan, b, INTRO_MEL.call, 0.5);
    if (m >= 3) addLead(plan, b + 1, INTRO_MEL.answer, 0.45);
  }
  // ring-out: digital silence in the last 0.12 s (0.15 s when the hit is the last bar)
  plan.fade = m >= 1 ? [s.t1 - 1.5, s.t1 - 0.12] : [plan.hit.t + 0.9, s.t1 - 0.15];
}

const ARRANGE = { intro: arrangeIntro, grooveA: arrangeGroove, grooveB: arrangeGroove, break: arrangeBreak, build: arrangeBuild, final: arrangeFinal };

// ----------------------------------------------------------------------------
// Second flute: diatonic thirds below (Andean style), snapped to a chord tone
// on strong beats / long notes.
// ----------------------------------------------------------------------------
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
function harmonyNotes(lead, chordAt) {
  return lead
    .filter((nt) => nt.harm)
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

// ----------------------------------------------------------------------------
// Plan
// ----------------------------------------------------------------------------
export function planSong(song) {
  const sections = [];
  let b0 = 0;
  song.sections.forEach((s, i) => {
    sections.push({ ...s, i, b0, b1: b0 + s.bars, t0: barStart(b0), t1: barStart(b0 + s.bars) });
    b0 += s.bars;
  });
  sections.forEach((s, i) => {
    s.prev = sections[i - 1] ?? null;
    s.next = sections[i + 1] ?? null;
  });
  for (const s of sections) {
    s.exit = exitOf(s);
    s.entry = entryOf(s);
  }
  const nBars = b0;
  const plan = {
    song,
    voiceMix: song.voiceMix,
    sections,
    nBars,
    sec: barStart(nBars),
    N: Math.round(barStart(nBars) * SR),
    bars: new Array(nBars),
    lead: [],
    charango: [],
    accents: [],
    gates: [],
    hit: null,
    fade: null,
  };
  const counters = { grooveA: 0, grooveB: 0 };
  for (const s of sections) ARRANGE[s.role](plan, s, counters);
  plan.chordAt = (b, step = 0) => {
    const c = plan.bars[b].ch;
    return c[step < 8 ? 0 : c.length - 1];
  };
  plan.harmony = harmonyNotes(plan.lead, plan.chordAt);

  // downbeat accents and the gates before them
  for (const s of sections) {
    if (s.entry) plan.accents.push({ t: s.t0, type: s.entry });
    if (!s.prev) continue;
    if (s.entry === 'drop1' || s.entry === 'drop2') {
      const kind = s.prev.exit === 'buildDrop' ? 'gap' : 'breath';
      plan.gates.push({ a: s.t0 - GATE[kind].len, b: s.t0, fade: GATE[kind].fade, kind, label: `before the ${s.role} drop` });
    } else if (s.role === 'final' && s.prev.role === 'build' && s.hitBar > 0) {
      plan.gates.push({ a: s.t0 - GATE.breath.len, b: s.t0, fade: GATE.breath.fade, kind: 'breath', label: 'before the final tag' });
    }
  }
  if (plan.hit && plan.hit.t > 0) {
    const same = plan.gates.find((g) => g.b === plan.hit.t);
    if (!same) plan.gates.push({ a: plan.hit.t - GATE.hit.len, b: plan.hit.t, fade: GATE.hit.fade, kind: 'hit', label: 'before the final hit' });
  }
  plan.accents.sort((x, y) => x.t - y.t);
  plan.gates.sort((x, y) => x.b - y.b);
  if (!plan.fade) plan.fade = [plan.sec - Math.min(1.9, plan.sec / 2), plan.sec - 0.12]; // no final section

  // loudness reference: the grooves (as before: groove A + groove B, not the build/final)
  const grooves = sections.filter((s) => s.role === 'grooveA' || s.role === 'grooveB');
  plan.grooveRanges = grooves.map((s) => [s.t0, s.t1]);
  plan.loudRanges = plan.grooveRanges.length ? plan.grooveRanges : [[0, plan.sec]];
  const gB = sections.filter((s) => s.role === 'grooveB');
  plan.grooveBRanges = gB.length ? gB.map((s) => [s.t0, s.t1]) : plan.loudRanges;
  return plan;
}

// Human-readable cue sheet (times in s, frames at 30 fps, bars 1-based).
export function describePlan(plan, fps = 30) {
  const f = (t) => Math.round(t * fps);
  const lines = [];
  lines.push(`song: ${plan.nBars} bars x ${BAR} s = ${plan.sec.toFixed(3)} s (${f(plan.sec)} frames @ ${fps} fps), ${BPM} BPM, A minor, voice mix ${plan.voiceMix ? 'ON' : 'off'}`);
  for (const s of plan.sections) {
    const chords = [];
    for (let b = s.b0; b < s.b1; b++) chords.push(plan.bars[b].ch.join('|'));
    const extra = [s.entry && `entry: ${s.entry}`, s.exit && `exit: ${s.exit}`, s.role === 'final' && `hit ${plan.hit.t.toFixed(3)} s (frame ${f(plan.hit.t)})`].filter(Boolean).join(', ');
    lines.push(
      `  ${String(s.i + 1).padStart(2)} ${s.role.padEnd(8)} ${String(s.bars).padStart(3)} bars  ${s.t0.toFixed(3).padStart(8)}-${s.t1.toFixed(3).padEnd(8)} s` +
        `  frames ${String(f(s.t0)).padStart(5)}-${String(f(s.t1)).padEnd(5)} bars ${s.b0 + 1}-${s.b1}${s.label ? `  "${s.label}"` : ''}${extra ? `  [${extra}]` : ''}`
    );
    lines.push(`       chords: ${chords.join(' ')}`);
    const phrases = [];
    for (let b = s.b0; b < s.b1; b++) if (plan.bars[b].phrase && (b === s.b0 || plan.bars[b - 1].phrase !== plan.bars[b].phrase || plan.bars[b].q === 0)) phrases.push(`${b + 1}:${plan.bars[b].phrase}`);
    if (phrases.length) lines.push(`       phrases (bar:type): ${phrases.join(' ')}`);
  }
  for (const g of plan.gates) lines.push(`  gate ${g.kind.padEnd(6)} ${g.a.toFixed(3)}-${g.b.toFixed(3)} s (${g.label})`);
  lines.push(`  fade ${plan.fade[0].toFixed(3)}-${plan.fade[1].toFixed(3)} s, digital silence after`);
  return lines.join('\n');
}
