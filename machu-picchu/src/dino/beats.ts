// Key frames of the dinosaur short, shared by the scenes (animation) and the cues (sound).
import { DINO } from "./timeline";

const { SCENES, wordAt, lineStart, lineEnd } = DINO;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const INTRO = {
  END: end("intro"),
  ASTEROIDE: wordAt("L01", 8),
  CAMBIO: wordAt("L01", 9),
  SCOPE: wordAt("L01", 9) - 4,
  FALLADO: wordAt("L01", 14),
};

const L03 = lineStart("L03");
export const PASA = {
  START: SCENES.pasa.from,
  END: end("pasa"),
  PASS: SCENES.pasa.from + 4,
  CHEER: lineStart("L02"),
  L02_END: lineEnd("L02"),
  STOMP1: lineEnd("L02") + 4,
  STOMP2: lineEnd("L02") + 18,
  ESPERA: L03,
  PLAN: wordAt("L03", 6),
  POV: wordAt("L03", 6) + 6,
};

export const CIUDAD = {
  START: SCENES.ciudad.from,
  END: end("ciudad"),
  MUROS: wordAt("L04", 3),
  PARQUES: wordAt("L04", 6),
  SENALES: wordAt("L05", 1),
  TREX: wordAt("L05", 6),
};

const SNATCH = lineEnd("L06") + 4;
export const PIZZA = {
  START: SCENES.pizza.from,
  END: end("pizza"),
  EXTREMO: wordAt("L06", 5),
  SNATCH,
  POV_END: lineStart("L07") - 2,
  DATO: wordAt("L07", 0),
  PAVO: wordAt("L07", 8),
  PLUMAS: wordAt("L07", 11),
  MASCOTAS: wordAt("L08", 2),
  MAMA: wordAt("L08", 3),
  MOM: lineStart("L09"),
  PLANTA: wordAt("L09", 5),
  MOM_END: lineEnd("L09"),
};

export const CAVE = {
  START: SCENES.cavernicola.from,
  END: end("cavernicola"),
  POV_END: wordAt("L10", 2),
  EVOLUCIONAR: wordAt("L10", 8),
  HUMANOS: wordAt("L11", 5),
  EXISTIERAMOS: wordAt("L11", 8),
  L11_END: lineEnd("L11"),
};

export const REY = {
  START: SCENES.rey.from,
  END: end("rey"),
  MANDARIAN: wordAt("L12", 5),
  ROAR: lineEnd("L12") + 3,
  SNACK: wordAt("L13", 4),
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  PANTALLA: wordAt("L14", 7),
  GRAB: lineEnd("L14") + 1,
  /** The question pops once the photo is taken (the phone view has faded out). */
  CTA: lineEnd("L14") + 23,
  TE: wordAt("L15", 6),
};
