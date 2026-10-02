// Sound design of the water short: the Magnific effects ("agua/<name>", plus a tape rewind and a
// slow-motion hit cut from the score) and the synthesized ones, anchored to the beats.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { ANTES, FINAL, GIRO, HOOK, PELIGRO, PROBLEMA, SOLUCION } from "./beats";
import { AGUA } from "./timeline";

const FPS = 30;
/** The score (120 BPM, a bar every 2 s from 0.07 s): a sneaky intro, a playful groove, the chase from 32 s. */
const bar = (n: number) => Math.round((0.07 + 2 * n) * FPS);

/**
 * The score is cut to the story instead of running under it: the hook lands the chase drop on
 * the first street shot, a record scratch stops it on the freeze frame, the groove comes back
 * after the rewind, the seller whispers over the sneaky intro, the street goes silent when
 * everyone turns, the chase comes back at full tilt, and the dream ends on a calm morning.
 */
export const MUSIC_PARTS: MusicPart[] = [
  [HOOK.START, HOOK.FREEZE, bar(16) - HOOK.L02, 1, 2],
  [ANTES.CARD_OUT - 4, SOLUCION.PSST + 2, bar(4), 10, 10],
  [SOLUCION.PSST + 10, PELIGRO.SILENCE, bar(0), 20, 2],
  [PELIGRO.CHASE - 2, GIRO.START + 10, bar(24), 1, 12],
  [GIRO.TRAIL, GIRO.DIVE + 2, bar(27), 2, 2],
];

/** The music steps back under the whispers. */
export const musicGain = (g: number) => {
  const dip = (from: number, to: number, depth: number) =>
    g < from - 8 || g > to + 8 ? 1 : 1 - depth * Math.min(1, (g - (from - 8)) / 8, (to + 8 - g) / 8);
  return dip(SOLUCION.PSST, SOLUCION.OYE + 20, 0.4) * dip(PELIGRO.L13, PELIGRO.FIN, 0.6);
};

const hook = (): Cue[] => {
  const { VANISH, OCEAN, L02, BOTELLA, ERROR, FREEZE } = HOOK;
  return [
    [VANISH - 1, "agua/vanish", 0.9],
    [OCEAN - 4, "agua/drain", 1.0, L02 - OCEAN + 8],
    [L02 - 2, "whoosh", 0.35],
    [BOTELLA - 3, "agua/choir", 0.35, 45],
    [ERROR - 12, "agua/stampede", 0.85, FREEZE - ERROR + 12],
    [FREEZE - 3, "agua/scratch", 1.0],
    [FREEZE, "impact", 0.25],
  ];
};

const antes = (): Cue[] => {
  const { START, CARD_OUT, PLAYA, UP, MAL } = ANTES;
  return [
    [START, "agua/rewind", 0.75],
    [CARD_OUT, "agua/faucet", 0.9],
    [PLAYA - 2, "whoosh-short", 0.3],
    [UP - 2, "agua/creak", 0.85],
    [MAL + 12, "agua/creak", 0.45, 40, 20],
  ];
};

const problema = (): Cue[] => {
  const { SED, COMIENZO, L06, CONSEGUIR, PAPA, SEGURIDAD } = PROBLEMA;
  return [
    [SED - 12, "agua/moth", 0.85],
    [COMIENZO, "paper", 0.3],
    [L06 - 2, "whoosh", 0.3],
    [CONSEGUIR - 2, "whoosh-short", 0.3],
    [PAPA - 8, "agua/laser", 0.55],
    [SEGURIDAD, "agua/laser", 0.45, 40],
  ];
};

const solucion = (): Cue[] => {
  const { SAFE, SOLES, DRAW, SHOW, GIVE } = SOLUCION;
  return [
    [SAFE - 2, "agua/safe", 0.85],
    [SAFE + 8, "agua/choir", 0.75],
    [SOLES, "agua/coins", 1.0],
    [DRAW, "agua/pencil", 0.85, SHOW - DRAW + 4],
    [SHOW, "sparkle", 0.4],
    [GIVE, "agua/choir", 0.45, 50],
  ];
};

const peligro = (): Cue[] => {
  const { SILENCE, TURN, CHASE, POLE, FIN, RUN } = PELIGRO;
  return [
    [SILENCE - 2, "agua/scratch", 0.9],
    [TURN, "agua/sting", 0.9],
    [CHASE - 4, "agua/stampede", 1.0, POLE - CHASE + 12],
    [FIN, "agua/sting", 0.7],
    [RUN, "agua/stampede", 0.9, 30],
    [RUN, "whoosh", 0.35],
  ];
};

const giro = (): Cue[] => {
  const { NO, HOLE, TRAIL, DROP, DIVE } = GIRO;
  return [
    [NO - 1, "agua/sting", 1.0],
    [HOLE + 6, "agua/drop", 0.55, 30],
    [TRAIL, "agua/stampede", 0.45, DROP - TRAIL],
    [DROP, "agua/drop", 0.8],
    [DIVE, "agua/slowmo", 0.9, AGUA.SCENES.giro.from + AGUA.SCENES.giro.duration - DIVE],
  ];
};

const final = (): Cue[] => {
  const { START, END, FALL, SINK, BOTELLA, CARD, MIRANDO } = FINAL;
  return [
    [START - 2, "agua/gasp", 0.9],
    [FALL - 16, "agua/thud", 1.0],
    [FALL + 6, "agua/morning", 0.75, END - FALL - 6],
    [SINK - 2, "agua/tapwater", 0.8, 75],
    [BOTELLA, "agua/choir", 0.3, 45],
    [CARD, "pop", 0.4],
    [CARD + 10, "pop", 0.35],
    [MIRANDO - 2, "agua/sting", 0.55],
  ];
};

export const CUES: Cue[] = [...hook(), ...antes(), ...problema(), ...solucion(), ...peligro(), ...giro(), ...final()];

export const BEDS: Bed[] = [
  [ANTES.PLAYA, ANTES.END, "agua/wind", 0.35],
  [PROBLEMA.L06, PROBLEMA.CONSEGUIR, "agua/wind", 0.4],
  [PROBLEMA.CONSEGUIR, PROBLEMA.DIFICIL + 20, "agua/wind", 0.22],
  [PELIGRO.START, PELIGRO.SILENCE, "agua/crowd", 0.6],
  [PELIGRO.TURN, PELIGRO.CHASE, "agua/wind", 0.15],
  [PELIGRO.POLE + 10, PELIGRO.FIN, "agua/crowd", 0.2],
];
