// Sound design for Nubi's short: the same synthesized effects as the Machu Picchu video,
// anchored to the words of the narration.
import type { Bed, Cue } from "../sfx";
import { NUBI } from "./timeline";

const { SCENES, wordAt, hitFrame } = NUBI;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

const hook = (): Cue[] => {
  const LAND = SCENES.hook.from + 12;
  const PEAK = wordAt("L01", 9);
  return [
    [0, "impact", 0.4],
    [0, "whoosh", 0.45],
    [LAND - 6, "whoosh-short", 0.3],
    [LAND, "stone-thud", 0.45],
    [LAND + 4, "pop", 0.38],
    [PEAK - 1, "pop", 0.34],
    [PEAK, "impact", 0.32],
    [end("hook") - 8, "whoosh-short", 0.4],
  ];
};

const piedras = (): Cue[] => {
  const FIRST = wordAt("L02", 1);
  const LAST = wordAt("L02", 5) + 6;
  const n = 18;
  const lands: Cue[] = [];
  // Roughly one clack per landing block (the wall has about this many).
  for (let k = 0; k < n; k++) {
    const f = Math.round(FIRST + 4 + (k * (LAST - FIRST - 4)) / (n - 1));
    lands.push([f, "stone-clack", k % 2 ? 0.16 : 0.21]);
  }
  return [
    ...lands,
    [wordAt("L02", 5) + 4, "sparkle", 0.35],
    [wordAt("L02", 6), "pop", 0.42],
    [end("piedras") - 8, "whoosh-short", 0.4],
  ];
};

const sismo = (): Cue[] => {
  const QUAKE_IN = wordAt("L03", 2);
  const SETTLE = wordAt("L03", 5);
  const OK = wordAt("L03", 8);
  const clacks: Cue[] = [];
  for (let f = QUAKE_IN + 4, i = 0; f < SETTLE - 3; f += 8, i++) clacks.push([f, "stone-clack", i % 2 ? 0.12 : 0.16]);
  return [
    ...clacks,
    [SETTLE, "stone-thud", 0.5],
    [SETTLE, "stone-clack", 0.35],
    [OK, "ding", 0.45],
    [OK + 1, "sparkle", 0.35],
    [end("sismo") - 8, "whoosh-short", 0.4],
  ];
};

const final = (): Cue[] => [
  [SCENES.final.from, "whoosh", 0.35],
  [wordAt("L04", 0) + 2, "pop", 0.35],
  [hitFrame, "impact", 0.28], // the music's final hit lands here too
  [hitFrame + 1, "sparkle", 0.4],
];

export const NUBI_CUES: Cue[] = [...hook(), ...piedras(), ...sismo(), ...final()].filter(([f]) => f >= 0).sort((a, b) => a[0] - b[0]);

export const NUBI_BEDS: Bed[] = [
  [0, end("hook") - 4, "rumble", 0.4],
  [wordAt("L03", 2), wordAt("L03", 5) + 4, "rumble", 0.55],
];
