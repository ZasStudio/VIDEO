// Key frames of the Inca-phone short, shared by the scenes (animation) and the cues (sound).
// All are global frames derived from the narration timing.
import { INCA } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart } = INCA;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const INTRO = {
  END: end("intro"),
  WAIT: wordAt("L01", 0),
  LAND: wordAt("L01", 8),
  FALL: 16,
  WOW: wordAt("L01", 9),
  TODO: wordAt("L01", 11),
};

const MENSAJE = wordAt("L02", 12);
export const CHASQUI = {
  START: SCENES.chasqui.from,
  END: end("chasqui"),
  TOOT: wordAt("L02", 2) - 6,
  RUN: wordAt("L02", 3),
  RELEVOS: wordAt("L02", 5),
  DIAS: wordAt("L02", 6),
  TRIP: wordAt("L02", 10) - 4,
  MENSAJE,
  GETUP: MENSAJE + 12,
  AHORA: wordAt("L03", 0),
  ESCRIBIRIA: wordAt("L03", 2),
  MI: wordAt("L03", 3),
  SEND: wordEnd("L03", 6),
  Y: wordAt("L04", 0),
  DORMIR: wordAt("L04", 4),
};

const MENSAJES = wordAt("L05", 3);
const C_START = lineStart("L06");
const UBIC = wordAt("L07", 3);
export const THRONE = {
  START: SCENES.inca.from,
  END: end("inca"),
  NOVENTA: wordAt("L05", 0),
  MENSAJES,
  STORM_FROM: SCENES.inca.from + 3,
  STORM_TO: MENSAJES + 4,
  C_START,
  CHAT_IN: C_START - 9,
  ENTONCES: wordAt("L07", 0),
  UBIC,
  SEND: UBIC + 2,
  LOC_AT: UBIC + 14,
  PUES: wordAt("L07", 4),
};

const P_START = lineStart("L09");
const HOY = wordAt("L10", 1);
const SEMBRAR = wordAt("L10", 3);
export const PAPA = {
  START: SCENES.papa.from,
  END: end("papa"),
  APP: wordAt("L08", 4),
  P_START,
  BOT_POP: P_START - 10,
  PERFECTO: wordAt("L10", 0),
  HOY,
  SEMBRAR,
  STRIKES: [HOY + 6, SEMBRAR + 4, SEMBRAR + 16],
  SPROUT: (i: number) => SEMBRAR + 6 + i * 6,
  PAPA_TEC: wordAt("L10", 4),
};

const OYE = wordAt("L13", 0);
export const SELFIE = {
  START: SCENES.selfie.from,
  END: end("selfie"),
  VIRAL: wordAt("L11", 7),
  POV: wordAt("L12", 0),
  AIRE: wordAt("L12", 7),
  PERO: wordAt("L12", 8),
  GRABAS: wordAt("L12", 10),
  OYE,
  SHOVE: OYE - 7,
  FLASH: OYE + 13,
};

const CELULARES = wordAt("L14", 2);
export const CAMINOS = {
  START: SCENES.caminos.from,
  END: end("caminos"),
  CELULARES,
  TOSS: CELULARES + 2,
  LOS: wordAt("L14", 3),
  TREINTA: wordAt("L14", 9),
  KM: wordAt("L14", 11),
  WORD_CAMINOS: wordAt("L14", 13),
  CHASQUIS: wordAt("L14", 14),
  QUIPUS: wordAt("L14", 16),
};

export const CTA = {
  START: SCENES.cta.from,
  END: end("cta"),
  EPOCA: wordAt("L15", 3),
  TE: wordAt("L15", 7),
  COMENTARIOS: wordAt("L15", 11),
};
