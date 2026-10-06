// Sound design of "¿Y si dormir te pagara?": the Magnific effects ("dormir/<name>"), a few from the
// earlier shorts, and the comedic lullaby score cut to the scenes.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { ENEMIGO, FINAL, GANCHO, GIRO, MUNDO, OFICINA, PROBLEMA } from "./beats";

const FPS = 30;
/** Seconds into a music file -> frames to trim. */
const at = (s: number) => Math.round(s * FPS);

/**
 * The lullaby score: its music box under the climbing counter (killed by the smash), the bouncy
 * section for the rule and the office, the tiptoe section for "fingir", the cheeky bakery section,
 * nothing under the drill, the fast montage up to "abrí los ojos", the reprise for the question, and
 * the music box again over the last frames so the loop back to the start is seamless.
 */
export const MUSIC_PARTS: MusicPart[] = [
  [0, GANCHO.SMASH, at(2.5), 0, 1],
  [GANCHO.L02 - 6, PROBLEMA.START + 2, at(20.0), 6, 4],
  [PROBLEMA.START, PROBLEMA.PEEK + 4, at(42.5), 6, 2],
  [MUNDO.START, MUNDO.END, at(57.0), 6, 4],
  [GIRO.MASK, GIRO.OJOS + 2, at(87.5), 4, 2],
  [FINAL.START, FINAL.ALARM, at(110.0), 8, 3],
  [FINAL.SMASH + 6, FINAL.END, at(1.0), 6, 1],
];

/** The score steps back under the lines and stays low under the alarm gags. */
export const musicGain = (g: number) => {
  if (g >= MUNDO.L09 - 4 && g < MUNDO.END) return 0.75;
  if (g >= FINAL.START && g < FINAL.ALARM) return 0.85;
  return 1;
};

const gancho = (): Cue[] => {
  const { START, ALARM, SMASH, TRESCIENTOS, CIEN, TODOS } = GANCHO;
  return [
    [START, "dormir/chaching", 0.55],
    [START + 5, "dormir/chaching", 0.45],
    [START + 10, "dormir/chaching", 0.5],
    [ALARM, "dormir/alarm", 0.85, SMASH - ALARM + 2],
    [SMASH - 1, "dormir/smash", 1.0],
    [SMASH, "impact", 0.3],
    [TRESCIENTOS, "tiempo/drain", 0.3, 30],
    [CIEN - 2, "pop", 0.4],
    [CIEN, "dormir/chaching", 0.5],
    [TODOS - 4, "whoosh", 0.35],
    [TODOS + 6, "ia/sparkle", 0.35],
  ];
};

const oficina = (): Cue[] => {
  const { START, DIVE, L03, NOD } = OFICINA;
  return [
    [START - 2, "whoosh-short", 0.3],
    [DIVE - 2, "dormir/bed", 0.9],
    [L03 - 2, "impact", 0.2],
    [NOD, "pop", 0.25],
  ];
};

const problema = (): Cue[] => {
  const { START, L06, SOLO, FINGIR, GRITO, PEEK } = PROBLEMA;
  return [
    [START - 2, "whoosh-short", 0.25],
    // The colleague keeps earning in the next bed.
    [L06 + 8, "dormir/chaching", 0.3],
    [SOLO + 20, "dormir/chaching", 0.28],
    [FINGIR - 2, "dormir/denied", 0.85],
    [GRITO, "impact", 0.2],
    [PEEK, "dormir/denied", 0.6],
    [PEEK + 4, "ia/trombone", 0.35, 34],
  ];
};

const mundo = (): Cue[] => {
  const { START, QUIEN, BELL, YAWN, L09, L10 } = MUNDO;
  return [
    [START - 2, "whoosh", 0.3],
    [QUIEN - 4, "whoosh-short", 0.25],
    [BELL, "dormir/bell", 0.9],
    [YAWN, "dormir/yawn", 0.85],
    [L09 + 18, "pop", 0.35],
    [L10 + 2, "ia/sparkle", 0.3],
  ];
};

const enemigo = (): Cue[] => {
  const { START, DRILL, REVEAL } = ENEMIGO;
  return [
    [START - 2, "whoosh-short", 0.25],
    [DRILL - 1, "dormir/drill", 1.0, REVEAL - DRILL + 2],
    [REVEAL - 2, "whoosh-short", 0.3],
  ];
};

const giro = (): Cue[] => {
  const { PAY, MASK, MIL, RICO, OJOS, CHARGE1, CHARGE2, CHARGE3, ZERO } = GIRO;
  return [
    [PAY, "tiempo/pay", 0.75],
    [MASK - 1, "dormir/mask", 0.9],
    [MASK + 6, "tiempo/clockfast", 0.55, MIL - MASK - 6],
    [MIL - 6, "dormir/chaching", 0.7],
    [MIL, "dormir/coins", 0.75],
    [RICO, "ia/sparkle", 0.4],
    [OJOS - 2, "whoosh-short", 0.3],
    [CHARGE1, "dormir/charges", 0.9],
    [CHARGE2, "pop", 0.3],
    [CHARGE3, "pop", 0.3],
    [ZERO, "impact", 0.3],
  ];
};

const final = (): Cue[] => {
  const { START, ALARM, SMASH, SLEEP, CARD } = FINAL;
  return [
    [START - 2, "whoosh-short", 0.3],
    [ALARM, "dormir/alarm", 0.5, SMASH - ALARM + 2],
    [SMASH - 1, "dormir/smash", 1.0],
    [SMASH, "impact", 0.3],
    [CARD, "pop", 0.35],
    [SLEEP, "dormir/bed", 0.5],
    [SLEEP + 10, "dormir/chaching", 0.45],
  ];
};

export const CUES: Cue[] = [...gancho(), ...oficina(), ...problema(), ...mundo(), ...enemigo(), ...giro(), ...final()];

export const BEDS: Bed[] = [
  [GANCHO.START, GANCHO.ALARM, "dormir/snore", 0.5],
  [OFICINA.START, PROBLEMA.END, "dormir/officesnore", 0.35],
  [OFICINA.SNORE, OFICINA.END, "dormir/snore", 0.6],
  [MUNDO.START, MUNDO.BELL, "dormir/snore", 0.45],
  [ENEMIGO.START, ENEMIGO.DRILL, "dormir/snore", 0.45],
  [ENEMIGO.REVEAL, ENEMIGO.L14, "dormir/construction", 0.55, 2],
  [GIRO.MASK + 4, GIRO.OJOS, "dormir/snore", 0.4],
  [FINAL.SLEEP, FINAL.END, "dormir/snore", 0.55],
];
