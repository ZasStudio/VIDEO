// Sound design of the Casa Matusita short: the Magnific effects ("matusita/<name>"), a few from the
// earlier shorts and synthesized ones, and two Magnific scores cut to the story.
import type { MusicPart } from "../Soundtrack";
import type { Bed, Cue } from "../sfx";
import { FINAL, GANCHO, LUGAR, MIEDO, RETO, SUSTO, VERDAD } from "./beats";
import { MATUSITA } from "./timeline";

const FPS = 30;
/** Seconds into a music file -> frames to trim. */
const at = (s: number) => Math.round(s * FPS);
const CHASE = "matusita/sfx/chase.wav";
const L08_GRITANDO = MATUSITA.wordAt("L08", 6);

/**
 * The dark ambient score (drone, music box, sparse piano) runs from the hook until Nubi steps into
 * the house, where everything outside cuts dead; the hallway rides the chase cue's building tremolo,
 * the run and the doppelgänger its dense section until the light goes off; the present gets the
 * sparse piano, cut before the knock; the end card gets a last music-box phrase.
 */
export const MUSIC_PARTS: MusicPart[] = [
  [0, RETO.INSIDE, 0, 20, 1],
  [MIEDO.L06 - 10, MIEDO.SHADOW - 2, at(20), 30, 2, CHASE],
  [MIEDO.RUN - 4, SUSTO.OFF, at(50.3), 2, 1, CHASE],
  [VERDAD.BREATH + 10, VERDAD.KNOCK - 4, at(37), 30, 3],
  [FINAL.CARD - 4, FINAL.END, at(46), 6, 10],
];

/** The hook's drone sits low under the whisper; the hallway build stays under the voice. */
export const musicGain = (g: number) => {
  if (g < GANCHO.END) return 0.7;
  if (g >= MIEDO.L06 - 10 && g < MIEDO.SHADOW) return 0.75;
  return 1;
};

const gancho = (): Cue[] => {
  const { LIGHT, SIETE, DOS } = GANCHO;
  return [
    [LIGHT - 1, "matusita/click", 0.85],
    [SIETE, "pop", 0.25],
    [DOS, "impact", 0.3],
  ];
};

const lugar = (): Cue[] => {
  const { START, THUNDER, WINDOW, RAISE, EYES } = LUGAR;
  return [
    [START - 2, "whoosh", 0.25],
    [THUNDER - 2, "matusita/thunder", 0.85],
    [WINDOW - 4, "matusita/window", 0.75],
    [RAISE, "whoosh-short", 0.2],
    [EYES - 8, "matusita/whisper", 0.65],
    [EYES, "agua/sting", 0.35],
  ];
};

const reto = (): Cue[] => {
  const { REC, OPEN, SLAM, RATTLE } = RETO;
  return [
    [REC, "matusita/recbeep", 0.6],
    [OPEN, "matusita/creak", 0.9],
    [SLAM - 1, "matusita/slam", 1.0],
    [SLAM, "impact", 0.3],
    [RATTLE, "matusita/rattle", 0.85],
  ];
};

const miedo = (): Cue[] => {
  const { THUMP, STEPS, SHADOW, RUN } = MIEDO;
  return [
    [THUMP - 1, "matusita/thump", 1.0],
    [STEPS, "matusita/steps", 0.9],
    [SHADOW - 1, "matusita/jumpsting", 0.95],
    [RUN, "matusita/runwood", 0.9],
  ];
};

const susto = (): Cue[] => {
  const { DOOR, HORAS, TURN, OFF } = SUSTO;
  return [
    [DOOR - 2, "matusita/dooropen", 0.9],
    [HORAS - 2, "matusita/glitch", 0.35],
    [L08_GRITANDO, "matusita/scream", 0.3],
    [TURN, "matusita/whisper", 0.45],
    [OFF - 1, "matusita/click", 0.9],
    [OFF, "matusita/glitch", 0.9],
  ];
};

const verdad = (): Cue[] => {
  const { BREATH, KNOCK } = VERDAD;
  return [
    [BREATH, "matusita/exhale", 0.8],
    [KNOCK, "matusita/knock", 1.0],
  ];
};

const final = (): Cue[] => {
  const { TURN, ALGUIEN, CLICK, BLACK, CARD } = FINAL;
  return [
    [TURN, "whoosh-short", 0.3],
    [TURN + 4, "matusita/flicker", 0.7],
    // The door swings shut behind Nubi: a slow creak, then the latch.
    [ALGUIEN - 2, "matusita/creak", 0.65],
    [CLICK - 15, "matusita/doorclose", 0.9],
    [BLACK - 16, "matusita/flicker", 0.85],
    [BLACK - 1, "matusita/click", 0.9],
    [CARD, "matusita/whisper", 0.4],
  ];
};

export const CUES: Cue[] = [...gancho(), ...lugar(), ...reto(), ...miedo(), ...susto(), ...verdad(), ...final()];

export const BEDS: Bed[] = [
  [GANCHO.START, GANCHO.END, "matusita/hum", 0.5],
  [GANCHO.START, LUGAR.START, "matusita/rain", 0.15],
  // The street: rain until Nubi steps inside, where it cuts dead.
  [LUGAR.START, RETO.INSIDE, "matusita/rain", 0.6, 2],
  [RETO.START, SUSTO.OFF, "matusita/vhs", 0.22, 2],
  [RETO.INSIDE, SUSTO.START, "matusita/roomtone", 0.55],
  [SUSTO.TURN, SUSTO.OFF, "tiempo/heartbeat", 0.5, 2],
  [VERDAD.START, FINAL.BLACK, "matusita/hum", 0.22, 2],
  [FINAL.L11, FINAL.BLACK, "tiempo/heartbeat", 0.45, 2],
];
