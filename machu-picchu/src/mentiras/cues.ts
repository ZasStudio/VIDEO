// Sound design of "¿Y si tus mentiras salieran sobre tu cabeza?": the Magnific effects
// ("mentiras/<name>"), a few from the earlier shorts, and the cheeky score cut to the scenes. The
// truth tag always lands on the same "bzzt-ding" sting, and the music stops dead under it (each
// scene's groove picks up again where it would have been, as if it had only been muted).
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { CITA, DEUDA, ESCAPE, FINAL, GANCHO, GIRO, JEFE } from "./beats";

const FPS = 30;
/** Seconds into a music file -> frames to trim. */
const at = (s: number) => Math.round(s * FPS);

// The score (100 BPM): intro pickup 0–2.49 s (downbeat at 2.49), light groove to 12.09, main groove
// 12.09–31.29, sneaky tiptoe section 31.29–55.29, office bossa 55.29–79.29, big groove with claps
// 79.29 to its last hit at ~98.4 s.
const DOWNBEAT = at(2.49);
const SNEAKY = at(31.29);
const GROOVE = at(12.09);
const BOSSA = at(55.29);
const BIG = at(79.29);
const LAST_HIT = at(98.45);
/** Continue a section after a stop as if it had kept playing since `from` (trim at `from` = `trim`). */
const resume = (trim: number, from: number, g: number) => trim + (g - from);

export const MUSIC_PARTS: MusicPart[] = [
  // The intro pickup under the fake panting: its first downbeat lands with the first truth tag.
  [Math.max(0, GANCHO.TAG - DOWNBEAT), GANCHO.END + 3, Math.max(0, DOWNBEAT - GANCHO.TAG), 0, 6],
  // The café: the sneaky section; dead stop for the tag ripping through the cap, then it carries on.
  [ESCAPE.START - 2, ESCAPE.TAG - 1, SNEAKY - 2, 3, 2],
  [ESCAPE.TAG + 14, ESCAPE.END + 3, resume(SNEAKY - 2, ESCAPE.START - 2, ESCAPE.TAG + 14), 8, 6],
  // The sneakers: the main groove; stop for the tag; back in on the getaway.
  [DEUDA.START, DEUDA.TAG - 1, GROOVE, 0, 2],
  [DEUDA.RUN - 2, DEUDA.END + 3, resume(GROOVE, DEUDA.START, DEUDA.RUN - 2), 3, 6],
  // The date: the cheesy violin, cut dead by the record scratch.
  [CITA.START - 2, CITA.TAG, 0, 8, 1, "mentiras/sfx/romance.wav"],
  // The office: elevator bossa; stop for the tag; it goes on, cheerful and low, under the sad retreat.
  [JEFE.START - 2, JEFE.TAG - 1, BOSSA - 2, 3, 2],
  [JEFE.GROAN + 6, JEFE.DUN + 2, resume(BOSSA - 2, JEFE.START - 2, JEFE.GROAN + 6), 10, 8],
  // "Encontré la solución": the big groove, killed by the pizza box (then only the whistle).
  [GIRO.START - 2, GIRO.BOX - 1, BIG - 2, 0, 3],
  // The question: the main groove, low; stop for the last tag.
  [FINAL.START - 4, FINAL.TAG - 1, GROOVE + at(2.4) - 4, 6, 2],
  // After the swat: the score's last bar, its final hit right on the last frame (then the loop).
  [FINAL.SWAT - 1, FINAL.END, LAST_HIT - (FINAL.END - FINAL.SWAT + 1), 0, 2],
];

/** The score steps back under the fake panting, the retreat and the question. */
export const musicGain = (g: number) => {
  if (g < GANCHO.TAG - 1) return 0.55;
  if (g >= JEFE.GROAN && g < JEFE.END) return 0.55;
  if (g >= FINAL.START && g < FINAL.TAG) return 0.75;
  return 1;
};

const gancho = (): Cue[] => {
  const { TAG, L02, CABEZA } = GANCHO;
  return [
    [TAG - 1, "mentiras/truth", 0.9],
    [TAG, "impact", 0.3],
    [L02 - 2, "whoosh-short", 0.3],
    [CABEZA, "pop", 0.3],
  ];
};

const escape = (): Cue[] => {
  const { START, L03, TAG, DETAIL1, DETAIL2 } = ESCAPE;
  return [
    [START - 2, "whoosh", 0.3],
    [L03 - 3, "pop", 0.2],
    [TAG - 2, "mentiras/rip", 0.9],
    [TAG, "mentiras/truth", 0.8],
    [DETAIL1, "pop", 0.4],
    [DETAIL2, "pop", 0.45],
  ];
};

const deuda = (): Cue[] => {
  const { START, L08, TAG, DETAIL, RUN, GRAB, PAGA } = DEUDA;
  return [
    [START - 2, "whoosh-short", 0.3],
    [START, "mentiras/choir", 0.55],
    // His startled hop as Nubi speaks behind him (the cut outside lands on it).
    [L08 - 8, "whoosh-short", 0.25],
    [L08 - 4, "pop", 0.35],
    [TAG - 1, "mentiras/truth", 0.85],
    [DETAIL, "pop", 0.4],
    // The legs keep spinning in place after the grab, until he gives up.
    [RUN, "mentiras/scramble", 0.75],
    [RUN + 52, "mentiras/scramble", 0.5, PAGA - 16 - (RUN + 52)],
    [GRAB, "mentiras/grab", 0.85],
    [PAGA - 4, "dormir/chaching", 0.55],
    [PAGA + 2, "pop", 0.35],
  ];
};

const cita = (): Cue[] => {
  const { START, BUBBLE, TAG, DETAIL, STAND, L12, LEAVE } = CITA;
  return [
    [START - 2, "whoosh-short", 0.25],
    [BUBBLE, "ia/receive", 0.45],
    [TAG - 2, "ia/scratch", 0.9],
    [TAG, "mentiras/truth", 0.85],
    [DETAIL, "pop", 0.4],
    [TAG + 12, "ia/crickets", 0.45, L12 - TAG + 10],
    [STAND, "mentiras/chair", 0.8],
    [LEAVE - 6, "ia/trombone", 0.45, 40],
  ];
};

const jefe = (): Cue[] => {
  const { START, BLOCK, TAG, DETAIL, GROAN, DUN } = JEFE;
  return [
    [START - 2, "whoosh", 0.3],
    [START + 2, "ding", 0.4],
    [BLOCK - 2, "whoosh-short", 0.4],
    [BLOCK + 4, "impact", 0.25],
    [TAG - 1, "mentiras/truth", 0.85],
    [DETAIL, "pop", 0.4],
    [GROAN, "mentiras/groan", 0.85],
    [DUN, "mentiras/dundun", 0.75, GIRO.START - DUN + 8],
  ];
};

const giro = (): Cue[] => {
  const { START, SOLUCION, BOX, SILENCIO, NADA, SILBA, END } = GIRO;
  return [
    [START - 2, "whoosh-short", 0.3],
    [SOLUCION, "ia/sparkle", 0.4],
    [BOX, "mentiras/pizzabox", 0.8],
    [SILENCIO, "mentiras/loading", 0.55, NADA - SILENCIO + 4],
    [NADA, "ia/error", 0.3],
    [SILBA, "mentiras/whistle", 0.7, END - SILBA + 4],
  ];
};

const final = (): Cue[] => {
  const { START, OPT1, OPT2, OPT3, TAG, SWAT, CARD, RING, END } = FINAL;
  return [
    [START - 2, "whoosh-short", 0.25],
    [OPT1, "pop", 0.45],
    [OPT2, "pop", 0.45],
    [OPT3, "pop", 0.5],
    [TAG - 1, "mentiras/truth", 0.9],
    [SWAT - 2, "mentiras/swat", 0.9],
    [CARD, "pop", 0.35],
    [RING, "mentiras/phonering", 0.65, END - RING],
    // Nubi dives for the phone and flops back into bed (into the loop).
    [RING + 10, "pop", 0.3],
    [RING + 14, "dormir/bed", 0.45],
  ];
};

export const CUES: Cue[] = [...gancho(), ...escape(), ...deuda(), ...cita(), ...jefe(), ...giro(), ...final()];

export const BEDS: Bed[] = [
  [GANCHO.START, GANCHO.END, "mentiras/birds", 0.35],
  [ESCAPE.START, DEUDA.END, "mentiras/cafe", 0.4],
  [CITA.START, CITA.END, "mentiras/restaurant", 0.4],
  [JEFE.START, JEFE.END, "ia/office", 0.35],
  [GIRO.START, FINAL.END, "mentiras/birds", 0.3, 4],
];
