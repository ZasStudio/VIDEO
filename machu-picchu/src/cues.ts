// Sound design: every effect was synthesized in code (scripts/generate-audio.mjs) and is
// anchored to the same narration cues the scenes use (see timeline.ts), so the mix follows
// the voice whatever its exact timing.
import { landingFrames } from "./scenes/Piedras";
import { SCENES, lineStart, wordAt, wordEnd } from "./timeline";

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
/** Looping ambience: [from, to, sound, volume]. */
export type Bed = [number, number, Sfx, number];

const RISER_LEN = 60;

const ticks = (from: number, to: number, every: number, vol: number): Cue[] => {
  const list: Cue[] = [];
  for (let f = from; f < to; f += every) list.push([Math.round(f), "tick", vol]);
  return list;
};

const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

const hook = (): Cue[] => {
  const HITS = [wordAt("L01", 0) + 3, wordAt("L01", 2) + 3, wordAt("L01", 5) + 3];
  const Q = wordAt("L01", 7) + 3;
  return [
    [0, "whoosh", 0.7],
    ...HITS.flatMap((h): Cue[] => [
      [h - 6, "whoosh-short", 0.35],
      [h, "impact", 0.55],
      [h + 8, "pop", 0.4],
    ]),
    [Q - 6, "whoosh", 0.4],
    [Q, "impact", 0.65],
    [end("hook") - RISER_LEN, "riser", 0.35],
    [end("hook") - 10, "whoosh", 0.5],
  ];
};

const intro = (): Cue[] => {
  const F = SCENES.intro.from;
  const HAT = F + 28;
  return [
    [F, "impact", 0.45], // the music drops here too
    [F + 4, "whoosh-short", 0.35],
    [F + 14, "stone-thud", 0.5],
    [HAT, "whoosh-short", 0.22],
    [HAT + 7, "pop", 0.5],
    [wordAt("L02", 2), "pop", 0.4],
    [wordAt("L02", 12), "sparkle", 0.35],
  ];
};

const datos = (): Cue[] => {
  const S = SCENES.datos;
  const PIN_LAND = wordAt("L03", 4) + 2;
  const GAUGE = wordAt("L03", 6) - 6;
  const RW = wordAt("L04", 4) - 6;
  const ROLL0 = wordAt("L04", 7) - 4;
  const LANDY = wordEnd("L04", 9);
  return [
    [S.from, "whoosh", 0.45],
    [PIN_LAND - 12, "whoosh-short", 0.3],
    [PIN_LAND, "stone-thud", 0.5],
    [PIN_LAND + 2, "pop", 0.4],
    [GAUGE, "pop", 0.4],
    ...ticks(wordAt("L03", 7), wordAt("L03", 11), 3, 0.16),
    [wordAt("L03", 11), "ding", 0.42],
    [RW, "whoosh", 0.45],
    [wordAt("L04", 6) - 4, "whoosh-short", 0.3],
    ...ticks(ROLL0, LANDY, 3, 0.18),
    [LANDY, "ding", 0.55],
    [LANDY, "impact", 0.35],
    [end("datos") - 14, "whoosh-short", 0.4],
  ];
};

const inca = (): Cue[] => {
  const S = SCENES.inca;
  const NAME = wordAt("L05", 3) + 3;
  return [
    [S.from, "whoosh", 0.45],
    [S.from + 4, "sparkle", 0.4],
    [S.from + 12, "pop", 0.4],
    [NAME, "impact", 0.55],
    [NAME + 1, "sparkle", 0.4],
    [wordAt("L05", 4) - 2, "pop", 0.4],
    [end("inca") - 14, "whoosh-short", 0.4],
  ];
};

const reto = (): Cue[] => {
  const S = SCENES.reto;
  const TITLE = wordAt("L08", 0) + 3;
  return [
    [S.from + 10, "thunder", 0.6],
    [wordAt("L06", 7), "thunder", 0.5],
    [wordAt("L06", 9) - 2, "pop", 0.4],
    [TITLE - 6, "whoosh-short", 0.35],
    [TITLE, "impact", 0.75],
    [end("reto") - 14, "whoosh-short", 0.4],
  ];
};

const piedras = (): Cue[] => {
  const S = SCENES.piedras;
  const T2 = wordAt("L09", 3) + 3;
  const HIT1 = wordAt("L12", 4);
  const HIT2 = HIT1 + 16;
  const BRONZE = wordAt("L12", 13);
  return [
    [S.from, "impact", 0.5], // music drop
    [wordAt("L09", 0) + 3, "pop", 0.4],
    [T2, "whoosh-short", 0.35],
    [wordAt("L10", 2), "whoosh-short", 0.3],
    ...landingFrames(16).map((f, i): Cue => [f, "stone-clack", i % 2 ? 0.26 : 0.34]),
    [wordAt("L10", 6) - 2, "pop", 0.38],
    [wordAt("L10", 15), "pop", 0.45],
    [wordAt("L11", 0), "whoosh-short", 0.3],
    [wordAt("L11", 0) + 6, "pop", 0.35],
    [wordAt("L11", 5), "paper", 0.45],
    [wordAt("L11", 10), "paper", 0.5],
    [wordAt("L11", 11), "pop", 0.45],
    [HIT1 - 9, "whoosh-short", 0.25],
    [HIT1, "stone-thud", 0.65],
    [HIT1, "stone-clack", 0.45],
    [HIT2 - 9, "whoosh-short", 0.25],
    [HIT2, "stone-thud", 0.65],
    [HIT2, "stone-clack", 0.45],
    [wordAt("L12", 6), "pop", 0.38],
    [BRONZE, "pop", 0.4],
    [wordAt("L12", 15), "sparkle", 0.45],
    [wordAt("L12", 15) + 1, "pop", 0.4],
    [end("piedras") - 14, "whoosh-short", 0.4],
  ];
};

const sismos = (): Cue[] => {
  const S = SCENES.sismos;
  const QUAKE_IN = wordAt("L15", 2);
  const SETTLE = wordAt("L15", 7);
  const ARROWS = wordAt("L14", 15);
  return [
    [S.from, "impact", 0.45], // music fill
    [wordAt("L13", 0) + 3, "pop", 0.4],
    [wordAt("L13", 4) + 2, "whoosh-short", 0.35],
    [wordAt("L14", 5), "sparkle", 0.28],
    [wordAt("L14", 7), "pop", 0.38],
    [wordAt("L14", 10) - 20, "whoosh", 0.3],
    [wordAt("L14", 12), "pop", 0.35],
    [ARROWS, "pop", 0.32],
    [ARROWS + 4, "pop", 0.28],
    ...ticks(QUAKE_IN + 4, SETTLE - 4, 9, 0).map(
      ([f], i): Cue => [f, "stone-clack", i % 2 ? 0.2 : 0.26],
    ),
    [SETTLE, "stone-thud", 0.75],
    [SETTLE, "stone-clack", 0.55],
    [SETTLE + 4, "ding", 0.55],
    [SETTLE + 5, "sparkle", 0.4],
    [end("sismos") - 14, "whoosh-short", 0.4],
  ];
};

const subsuelo = (): Cue[] => {
  const S = SCENES.subsuelo;
  const CAPAS = wordAt("L17", 4);
  const drops: [number, number][] = [
    [wordAt("L17", 6) + 6, 0.6],
    [wordAt("L17", 8) + 6, 0.5],
    [wordAt("L17", 9) + 6, 0.45],
    [wordAt("L17", 11) + 6, 0.45],
  ];
  const P60 = wordAt("L19", 4);
  const C129 = wordAt("L19", 14);
  return [
    [S.from, "impact", 0.45], // music fill
    [wordAt("L16", 0) + 3, "pop", 0.4],
    [wordAt("L16", 3) + 2, "whoosh-short", 0.35],
    [lineStart("L17") - 6, "whoosh-short", 0.22],
    ...[0, 1, 2].map((i): Cue => [CAPAS + i * 6, "tick", 0.3]),
    ...drops.flatMap(([f, v]): Cue[] => [
      [f - 10, "whoosh-short", 0.18],
      [f, "stone-thud", v],
      [f + 2, "pop", 0.3],
    ]),
    [wordAt("L17", 11) + 20, "pop", 0.35],
    [wordAt("L18", 5), "whoosh-short", 0.25],
    [wordAt("L18", 5) + 2, "pop", 0.4],
    [wordAt("L18", 11), "pop", 0.4],
    [P60, "impact", 0.45],
    ...ticks(P60, wordAt("L19", 6) + 4, 3, 0.16),
    [wordAt("L19", 6) + 4, "ding", 0.42],
    [wordAt("L19", 11), "whoosh-short", 0.28],
    [wordAt("L19", 12), "whoosh", 0.35],
    [C129, "impact", 0.45],
    ...ticks(C129, wordAt("L19", 15) + 6, 3, 0.16),
    [wordAt("L19", 15) + 6, "ding", 0.42],
    [wordAt("L19", 16), "sparkle", 0.42],
    [end("subsuelo") - 14, "whoosh-short", 0.4],
  ];
};

const mita = (): Cue[] => {
  const S = SCENES.mita;
  const CROWD = wordAt("L20", 5);
  const MITA = wordAt("L21", 4) + 2;
  const ropes: Cue[] = [];
  for (let f = S.from + 8, i = 0; f < end("mita") - 20; f += 30, i++)
    ropes.push([f, "rope", i % 2 ? 0.3 : 0.36]);
  return [
    [S.from, "impact", 0.45],
    ...ropes,
    ...[0, 3, 6, 9, 12].map((i): Cue => [Math.round(CROWD + i * 2.4), "pop", 0.22]),
    [wordAt("L20", 9) - 4, "pop", 0.42],
    [MITA - RISER_LEN, "riser", 0.3],
    [MITA, "impact", 0.6],
    [MITA + 1, "sparkle", 0.4],
    [end("mita") - 12, "whoosh", 0.5],
  ];
};

const final = (): Cue[] => {
  const S = SCENES.final;
  const HIT = wordAt("L22", 7);
  return [
    [S.from, "impact", 0.35],
    [S.from + 2, "whoosh", 0.35],
    [wordAt("L22", 2), "pop", 0.42],
    [HIT, "impact", 0.3], // the music's final hit lands here too
    [HIT + 1, "sparkle", 0.4],
    [wordAt("L23", 6), "pop", 0.5],
    [wordAt("L23", 6) + 1, "ding", 0.45],
    [wordAt("L23", 9) - 4, "sparkle", 0.28],
  ];
};

export const CUES: Cue[] = [
  ...hook(),
  ...intro(),
  ...datos(),
  ...inca(),
  ...reto(),
  ...piedras(),
  ...sismos(),
  ...subsuelo(),
  ...mita(),
  ...final(),
]
  .filter(([f]) => f >= 0)
  .sort((a, b) => a[0] - b[0]);

export const BEDS: Bed[] = [
  [SCENES.reto.from, end("reto"), "rain", 0.36],
  [wordAt("L07", 3), lineStart("L08") - 6, "rumble", 0.8],
  [wordAt("L15", 2), wordAt("L15", 7) + 4, "rumble", 0.85],
  [wordAt("L18", 2) - 4, end("subsuelo"), "rain", 0.26],
];

/** Length in frames of the looping beds (their files). */
export const BED_FRAMES: Partial<Record<Sfx, number>> = { rain: 180, rumble: 90 };
