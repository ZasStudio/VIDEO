// Sound design of the AI short: the Magnific effects ("ia/<name>"), a few from the earlier shorts,
// the playful sitcom score cut to the scenes and the reflective piano for the turn.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { FINAL, FOTO, GANCHO, GIRO, JEFE, MENSAJE, TAREA } from "./beats";

const FPS = 30;
/** Seconds into a music file -> frames to trim. */
const at = (s: number) => Math.round(s * FPS);
const REFLEX = "ia/sfx/reflexivo.wav";

/**
 * The sitcom score (104 BPM) plays each gag and stops dead on its punchline: the switch, her "Sí",
 * midnight, the stare, the rewind; the record scratch kills it for the turn, where the felt piano
 * takes over; the ending gets the score's last section, timed so its final button lands on the
 * last frame.
 */
export const MUSIC_PARTS: MusicPart[] = [
  [0, GANCHO.SWITCH + 3, 0, 4, 3],
  [MENSAJE.START, MENSAJE.SI, at(4.0), 8, 2],
  [TAREA.START + 4, TAREA.MIDNIGHT, at(41.0), 8, 2],
  [JEFE.START, JEFE.STARE, at(60.0), 6, 3],
  [FOTO.START, FOTO.REWIND, at(75.0), 4, 2],
  [FOTO.REVEAL - 2, GIRO.START + 1, at(81.0), 4, 1],
  [GIRO.START + 12, FINAL.START + 4, 0, 20, 10, REFLEX],
  [FINAL.START, FINAL.END, at(105.0) - (FINAL.END - FINAL.START), 10, 2],
];

/** The score sits a little lower under the long sincere line and the final question. */
export const musicGain = (g: number) => {
  if (g >= GIRO.START && g < FINAL.START) return 0.9;
  if (g >= FINAL.START && g < FINAL.CARD) return 0.8;
  return 1;
};

const gancho = (): Cue[] => {
  const { START, TYPE, SEND, NUBI, SWITCH } = GANCHO;
  return [
    [START, "ia/sparkle", 0.4],
    [START + 4, "ia/phonetype", 0.25, TYPE - START],
    [TYPE - 2, "whoosh-short", 0.3],
    [TYPE + 2, "ia/typing", 0.6, SEND - TYPE - 2],
    [SEND, "ia/send", 0.7],
    [NUBI - 2, "whoosh-short", 0.3],
    [SWITCH - 1, "ia/switch", 1.0],
    [SWITCH, "impact", 0.35],
  ];
};

const mensaje = (): Cue[] => {
  const { START, L02, SENT, SI } = MENSAJE;
  return [
    [START, "whoosh", 0.3],
    [L02 - 24, "ia/phonetype", 0.55, 44],
    [SENT, "ia/send", 0.7],
    [SI, "ia/receive", 0.85],
    [SI + 10, "ia/crickets", 0.8],
  ];
};

const tarea = (): Cue[] => {
  const { START, ERROR, TYPE, L06, MIDNIGHT } = TAREA;
  return [
    [START - 2, "whoosh-short", 0.3],
    [START + 3, "ia/typing", 0.5, ERROR - START - 3],
    [ERROR, "ia/error", 0.8],
    [ERROR + 1, "impact", 0.25],
    [TYPE, "ia/mash", 0.75, L06 - TYPE + 4],
    [L06 - 2, "pop", 0.3],
    [MIDNIGHT, "ia/alarm", 0.75],
    [MIDNIGHT + 6, "ia/thud", 0.95],
    [MIDNIGHT + 8, "ia/trombone", 0.45, 40],
  ];
};

const jefe = (): Cue[] => {
  const { L07, SLIDES, COFFEE1, COFFEE2, SUNRISE, STARE } = JEFE;
  return [
    [L07 - 8, "ia/sip", 0.5, 24],
    [SLIDES - 2, "whoosh-short", 0.3],
    [SLIDES + 2, "pop", 0.3],
    [COFFEE1, "ia/coffee", 0.7, COFFEE2 - COFFEE1 + 4],
    [COFFEE2, "ia/sip", 0.65, SUNRISE - COFFEE2 + 4],
    [SUNRISE, "ia/rooster", 0.6, 50],
    [STARE - 1, "whoosh-short", 0.2],
  ];
};

const foto = (): Cue[] => {
  const { START, POST, REWIND, REVEAL } = FOTO;
  return [
    [START, "ia/shutter", 0.7],
    [POST, "ia/likes", 0.65],
    [REWIND - 2, "ia/rewind", 0.85],
    [REVEAL, "pop", 0.4],
  ];
};

const giro = (): Cue[] => {
  const { START, YA, SENT, REPLY, ON, TODO, ALMUERZO } = GIRO;
  return [
    [START, "ia/scratch", 0.9],
    [YA + 4, "ia/phonetype", 0.45, SENT - YA - 4],
    [SENT, "ia/send", 0.6],
    [REPLY, "ia/receive", 0.7],
    [REPLY + 4, "ia/sparkle", 0.5],
    // The lever back up: its clunk, then the power-up whine (the power-down played backwards).
    [ON - 1, "ia/switch", 0.8, 8],
    [ON, "ia/switchon", 0.55, 80],
    [TODO - 4, "ia/typing", 0.5, ALMUERZO - TODO + 4],
    [ALMUERZO, "ia/send", 0.6],
  ];
};

const final = (): Cue[] => {
  const { START, TAREA: T, TRABAJO, MENSAJE: M, SQUINT, CARD } = FINAL;
  return [
    [START - 2, "whoosh-short", 0.3],
    [T, "pop", 0.4],
    [TRABAJO, "pop", 0.4],
    [M, "pop", 0.45],
    [SQUINT, "whoosh-short", 0.15],
    [CARD, "impact", 0.3],
    [CARD + 4, "ia/sparkle", 0.45],
  ];
};

export const CUES: Cue[] = [...gancho(), ...mensaje(), ...tarea(), ...jefe(), ...foto(), ...giro(), ...final()];

export const BEDS: Bed[] = [
  [TAREA.START, TAREA.END, "ia/night", 0.45],
  [TAREA.START, TAREA.MIDNIGHT, "ia/clock", 0.55],
  [JEFE.START, JEFE.END, "ia/office", 0.45],
];
