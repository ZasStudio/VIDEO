// Sound design: every sound was synthesized in code (scripts/generate-audio.mjs).
import { WORD_FRAMES } from "./script";

export type Sfx =
  | "impact"
  | "whoosh"
  | "whoosh-short"
  | "pop"
  | "ding"
  | "tick"
  | "riser"
  | "rumble"
  | "rain"
  | "thunder"
  | "stone-thud"
  | "stone-clack"
  | "paper"
  | "rope"
  | "sparkle";

/** [global frame, sound, volume, optional max length in frames] */
export type Cue = [number, Sfx, number, number?];

const ticks = (from: number, to: number, every: number, vol: number): Cue[] => {
  const list: Cue[] = [];
  for (let f = from; f < to; f += every) list.push([f, "tick", vol]);
  return list;
};

// Wall blocks in "Secreto #1" land every ~4.6 frames from frame 762 (16 blocks, see Piedras.tsx).
const BLOCK_LANDINGS = Array.from(
  { length: 16 },
  (_, k) => 762 + Math.round(k * 4.6),
);

export const CUES: Cue[] = [
  // Hook: out of the clouds, three slams and the big question.
  [0, "whoosh", 0.75],
  [24, "whoosh-short", 0.45],
  [30, "impact", 0.75],
  [35, "pop", 0.5],
  [54, "whoosh-short", 0.45],
  [60, "impact", 0.75],
  [65, "pop", 0.5],
  [84, "whoosh-short", 0.45],
  [90, "impact", 0.75],
  [95, "pop", 0.5],
  [114, "whoosh", 0.5],
  [120, "impact", 0.75],
  [122, "riser", 0.4],
  [171, "whoosh", 0.6],
  // Intro
  [180, "impact", 0.45], // the music drops here too
  [186, "whoosh-short", 0.4],
  [192, "stone-thud", 0.55],
  [209, "pop", 0.45],
  [214, "whoosh-short", 0.3],
  [220, "pop", 0.65],
  [285, "sparkle", 0.35],
  // Datos
  [300, "whoosh", 0.55],
  [326, "stone-thud", 0.55],
  [327, "pop", 0.45],
  [346, "pop", 0.45],
  ...ticks(348, 376, 2, 0.22),
  [376, "ding", 0.5],
  [404, "whoosh", 0.45],
  [410, "whoosh-short", 0.4],
  ...ticks(412, 440, 2, 0.25),
  [440, "ding", 0.7],
  [440, "impact", 0.45],
  [452, "whoosh-short", 0.45],
  // Inca
  [460, "whoosh", 0.55],
  [464, "sparkle", 0.45],
  [486, "pop", 0.45],
  [506, "impact", 0.65],
  [507, "sparkle", 0.45],
  [533, "whoosh-short", 0.45],
  // El reto
  [540, "rain", 0.42, 174],
  [548, "thunder", 0.75],
  [588, "pop", 0.45],
  [596, "thunder", 0.65],
  [640, "rumble", 0.9, 70],
  [670, "whoosh-short", 0.4],
  [680, "impact", 0.85],
  // Secreto 1 (drop at 24.0 s, silence just before it comes from the music)
  [720, "impact", 0.55], // music drop
  [735, "pop", 0.45],
  [753, "whoosh-short", 0.35],
  ...BLOCK_LANDINGS.map((f, i): Cue => [f, "stone-clack", i % 2 ? 0.32 : 0.42]),
  [804, "pop", 0.4],
  [856, "pop", 0.55],
  [858, "pop", 0.45],
  [870, "whoosh", 0.45],
  [876, "paper", 0.55],
  [884, "pop", 0.35],
  [893, "paper", 0.6],
  [900, "stone-thud", 0.5],
  [901, "pop", 0.5],
  [929, "whoosh", 0.45],
  [950, "stone-thud", 0.75],
  [950, "stone-clack", 0.6],
  [966, "stone-thud", 0.75],
  [966, "stone-clack", 0.6],
  [976, "pop", 0.45],
  [1000, "sparkle", 0.55],
  [1002, "pop", 0.45],
  [1013, "whoosh-short", 0.45],
  // Secreto 2
  [1020, "impact", 0.55], // music fill
  [1035, "pop", 0.45],
  [1052, "whoosh-short", 0.35],
  [1090, "sparkle", 0.35],
  [1098, "pop", 0.4],
  [1122, "whoosh-short", 0.3],
  [1130, "pop", 0.4],
  [1133, "pop", 0.35],
  [1166, "rumble", 1.0, 52],
  [1170, "pop", 0.45],
  ...[1172, 1180, 1188, 1196, 1204, 1210].map(
    (f): Cue => [f, "stone-clack", 0.3],
  ),
  [1216, "stone-thud", 0.85],
  [1216, "stone-clack", 0.7],
  [1219, "ding", 0.7],
  [1220, "sparkle", 0.45],
  [1253, "whoosh-short", 0.45],
  // Secreto 3
  [1260, "impact", 0.45], // music fill
  [1275, "pop", 0.45],
  [1291, "whoosh-short", 0.35],
  [1300, "stone-thud", 0.65],
  [1306, "stone-thud", 0.55],
  [1312, "stone-thud", 0.5],
  [1318, "stone-thud", 0.5],
  [1324, "pop", 0.4],
  [1334, "pop", 0.42],
  [1342, "pop", 0.42],
  [1350, "pop", 0.42],
  [1361, "pop", 0.42],
  [1370, "rain", 0.3, 104],
  [1416, "impact", 0.6],
  ...ticks(1414, 1428, 2, 0.22),
  [1428, "ding", 0.5],
  [1478, "whoosh", 0.45],
  [1490, "impact", 0.55],
  ...ticks(1488, 1506, 2, 0.22),
  [1506, "ding", 0.5],
  [1512, "pop", 0.4],
  [1512, "rain", 0.3, 48],
  [1540, "sparkle", 0.45],
  [1553, "whoosh-short", 0.45],
  // Mit'a
  [1560, "impact", 0.6],
  [1566, "rope", 0.5],
  [1590, "rope", 0.45],
  [1596, "pop", 0.3],
  [1601, "pop", 0.3],
  [1606, "pop", 0.3],
  [1614, "rope", 0.45],
  [1620, "riser", 0.55],
  [1622, "pop", 0.45],
  [1638, "rope", 0.4],
  [1658, "impact", 0.6],
  [1673, "whoosh", 0.55],
  // Final
  [1680, "impact", 0.38],
  [1682, "whoosh", 0.35],
  [1740, "impact", 0.32], // final hit of the music
  [1741, "sparkle", 0.4],
  [1756, "pop", 0.55],
  [1757, "ding", 0.55],
];

// voice-8 (G#4) is left out: it is the only blip outside A minor.
const VOICE_ORDER = [3, 7, 1, 5, 2, 4, 6, 1, 3, 6, 2, 7, 5, 4];

/** Clawd's voice: one short synthesized blip per spoken word. */
export const VOICE_CUES: [number, number][] = WORD_FRAMES.map((f, i) => [
  f,
  VOICE_ORDER[i % VOICE_ORDER.length],
]);
