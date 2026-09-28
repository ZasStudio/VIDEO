// Timeline driven by Clawd's narration: every scene is as long as its lines need, plus
// breathing room, rounded up to whole music bars (2 s) so cuts land on the beat.
// src/voice-timing.json is produced by scripts/voice_timing.py from the voice clips.
import narration from './narration.json';
import timing from './voice-timing.json';
import {FPS} from './theme';

export type SceneKey = 'hook' | 'intro' | 'datos' | 'inca' | 'reto' | 'piedras' | 'sismos' | 'subsuelo' | 'mita' | 'final';
export type LineId = string;

type LineTiming = {duration: number; words: [number, number][]; env: number[]; accents: number[]};
const T = (timing as unknown as {lines: Record<string, LineTiming>}).lines;

export const BAR = 2 * FPS; // 60 frames

type PlanScene = {scene: SceneKey; pre: number; lines: [LineId, number][]; post: number};

// Seconds of silence before the first line, before each following line, and after the last one.
const PLAN: PlanScene[] = [
  {scene: 'hook', pre: 1.4, lines: [['L01', 0]], post: 0.6},
  {scene: 'intro', pre: 1.5, lines: [['L02', 0]], post: 0.5},
  {scene: 'datos', pre: 1.1, lines: [['L03', 0], ['L04', 0.9]], post: 0.6},
  {scene: 'inca', pre: 0.6, lines: [['L05', 0]], post: 1.0},
  {scene: 'reto', pre: 0.9, lines: [['L06', 0], ['L07', 0.4], ['L08', 1.5]], post: 0.8},
  {scene: 'piedras', pre: 0.3, lines: [['L09', 0], ['L10', 0.7], ['L11', 0.9], ['L12', 0.8]], post: 0.9},
  {scene: 'sismos', pre: 0.3, lines: [['L13', 0], ['L14', 0.7], ['L15', 0.8]], post: 1.0},
  {scene: 'subsuelo', pre: 0.3, lines: [['L16', 0], ['L17', 1.0], ['L18', 0.8], ['L19', 0.8]], post: 1.0},
  {scene: 'mita', pre: 0.7, lines: [['L20', 0], ['L21', 0.6]], post: 0.9},
  {scene: 'final', pre: 0.8, lines: [['L22', 0], ['L23', 0.9]], post: 1.6},
];

const lineStartMap: Record<LineId, number> = {};
export const SCENES = {} as Record<SceneKey, {from: number; duration: number}>;
/** Bar (0-based, within the final scene) where "¡sigue en pie!" and the music's final hit land. */
export let FINAL_HIT_BAR = 0;

let cursor = 0;
for (const s of PLAN) {
  let pre = s.pre;
  if (s.scene === 'final') {
    // Push the first line so the word "sigue" falls exactly on a bar line.
    const sigue = T.L22.words[7][0];
    const bars = Math.ceil(((pre + sigue) * FPS) / BAR);
    FINAL_HIT_BAR = bars;
    pre = (bars * BAR) / FPS - sigue;
  }
  let t = Math.round(pre * FPS);
  s.lines.forEach(([id, gap], k) => {
    if (k > 0) t += Math.round(gap * FPS);
    lineStartMap[id] = cursor + t;
    t += Math.ceil(T[id].duration * FPS);
  });
  t += Math.round(s.post * FPS);
  const duration = Math.ceil(t / BAR) * BAR;
  SCENES[s.scene] = {from: cursor, duration};
  cursor += duration;
}

export const DURATION = cursor;

export const lineStart = (id: LineId) => lineStartMap[id];
export const lineEnd = (id: LineId) => lineStartMap[id] + Math.ceil(T[id].duration * FPS);
/** Global frame where word `i` of line `id` starts (negative i counts from the end). */
export const wordAt = (id: LineId, i: number) => {
  const w = T[id].words;
  return lineStartMap[id] + Math.round(w[i < 0 ? w.length + i : i][0] * FPS);
};
export const wordEnd = (id: LineId, i: number) => {
  const w = T[id].words;
  return lineStartMap[id] + Math.round(w[i < 0 ? w.length + i : i][1] * FPS);
};

// ---------------------------------------------------------------------------- voice level
const LEVEL = new Float32Array(DURATION + 1);
const ACCENTS: number[] = [];
for (const id of Object.keys(lineStartMap)) {
  const start = lineStartMap[id];
  T[id].env.forEach((v, k) => {
    if (start + k <= DURATION) LEVEL[start + k] = Math.max(LEVEL[start + k], v);
  });
  for (const a of T[id].accents) ACCENTS.push(start + a);
}
ACCENTS.sort((a, b) => a - b);

/** Loudness of Clawd's voice at frame g (0..1). */
export const voiceLevel = (g: number) => (g >= 0 && g <= DURATION ? LEVEL[Math.floor(g)] : 0);

/** Smoothed "is talking" amount (fast attack, slow release) for ducking and idle blending. */
const ACTIVE = new Float32Array(DURATION + 1);
{
  let v = 0;
  for (let f = 0; f <= DURATION; f++) {
    const target = LEVEL[f] > 0.08 ? 1 : 0;
    v += (target - v) * (target > v ? 0.5 : 0.08);
    ACTIVE[f] = v;
  }
}
export const talking = (g: number) => (g >= 0 && g <= DURATION ? ACTIVE[Math.floor(g)] : 0);

/** Decaying pulse after each syllable accent (0..1). */
export const voiceAccent = (g: number, decay = 4) => {
  let lo = 0;
  let hi = ACCENTS.length - 1;
  let last = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ACCENTS[mid] <= g) {
      last = ACCENTS[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (last < 0) return 0;
  const d = g - last;
  return d > decay * 4 ? 0 : Math.exp(-d / decay);
};

/** Index of the accent at or before g (to alternate gestures between arms). */
export const accentIndex = (g: number) => {
  let n = 0;
  for (const a of ACCENTS) {
    if (a <= g) n++;
    else break;
  }
  return n;
};

// ---------------------------------------------------------------------------- captions
export type Word = {text: string; at: number; color?: string};
export type Chunk = {from: number; to: number; words: Word[]};

export const HIGHLIGHT: Record<string, string> = {
  y: '#FFD60A',
  o: '#FF8A3D',
  g: '#4DFF7C',
  r: '#FF4B3E',
  c: '#4FE3FF',
};

const buildCaptions = (): Chunk[] => {
  const chunks: Chunk[] = [];
  for (const line of narration.lines) {
    if (!line.captions) continue;
    let wordIdx = 0;
    const lineChunks: Chunk[] = [];
    for (const part of line.captions.split(' / ')) {
      const words: Word[] = [];
      for (const raw of part.split(' ')) {
        let tok = raw;
        const hidden = tok.startsWith('~');
        if (hidden) tok = tok.slice(1);
        const span = /\{(\d+)\}/.exec(tok);
        tok = tok.replace(/\{\d+\}/, '');
        const col = /\^([a-z])$/.exec(tok);
        if (col) tok = tok.slice(0, -2);
        if (!hidden) words.push({text: tok.replace(/_/g, ' '), at: wordAt(line.id, wordIdx), color: col ? HIGHLIGHT[col[1]] : undefined});
        wordIdx += span ? Number(span[1]) : 1;
      }
      if (words.length) lineChunks.push({from: words[0].at, to: 0, words});
    }
    lineChunks.forEach((c, k) => {
      c.to = k + 1 < lineChunks.length ? lineChunks[k + 1].from : lineEnd(line.id) + 10;
    });
    chunks.push(...lineChunks);
  }
  // Never overlap the next line's first chunk.
  chunks.sort((a, b) => a.from - b.from);
  chunks.forEach((c, k) => {
    if (k + 1 < chunks.length) c.to = Math.min(c.to, chunks[k + 1].from);
  });
  return chunks;
};

export const CAPTIONS: Chunk[] = buildCaptions();

export const LINES = narration.lines.map((l) => ({id: l.id, scene: l.scene as SceneKey, start: lineStartMap[l.id], end: lineEnd(l.id)}));

/** Song structure for scripts/generate-audio.mjs --song (bars per scene). */
export const songSections = () => {
  const bars = (k: SceneKey) => SCENES[k].duration / BAR;
  return [
    {role: 'intro', bars: bars('hook')},
    {role: 'grooveA', bars: bars('intro') + bars('datos') + bars('inca'), start: 'drop'},
    {role: 'break', bars: bars('reto')},
    {role: 'grooveB', bars: bars('piedras'), start: 'drop'},
    {role: 'grooveB', bars: bars('sismos'), start: 'fill'},
    {role: 'grooveB', bars: bars('subsuelo'), start: 'fill'},
    {role: 'build', bars: bars('mita')},
    {role: 'final', bars: bars('final'), hitBar: FINAL_HIT_BAR},
  ];
};
