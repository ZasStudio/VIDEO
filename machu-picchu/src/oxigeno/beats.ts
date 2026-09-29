// Key frames of the oxygen short, shared by the scenes (animation) and the cues (sound).
import { OXI } from "./timeline";

const { SCENES, wordAt, lineStart, lineEnd } = OXI;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const INTRO = {
  END: end("intro"),
  Q: wordAt("L01", 0),
  OXIGENO: wordAt("L01", 5),
  DESAPARECIERA: wordAt("L01", 9),
  CINCO: wordAt("L01", 12),
};

const PRESS = SCENES.boton.from + 8;
export const BOTON = {
  START: SCENES.boton.from,
  END: end("boton"),
  PRESS,
  ALARM: lineStart("L02"),
  CERO: wordAt("L02", 1),
  NO: wordAt("L03", 0),
  POLVO: wordAt("L03", 5),
  MIRA: wordAt("L03", 6),
};

export const FUEGO = {
  START: SCENES.fuego.from,
  END: end("fuego"),
  FUEGO: wordAt("L04", 2),
  APAGARIA: wordAt("L04", 4),
  VELAS: wordAt("L04", 5),
  COCINAS: wordAt("L04", 6),
  FOGATAS: wordAt("L04", 7),
  HASTA: wordAt("L04", 8),
  CAFECITO: wordAt("L04", 10),
};

export const MOTORES = {
  START: SCENES.motores.from,
  END: end("motores"),
  MOTORES: wordAt("L05", 1),
  AUTOS: wordAt("L05", 6),
  AVIONES: wordAt("L05", 8),
  APAGADOS: wordAt("L05", 9),
  COHETES: wordAt("L06", 1),
  ELLOS: wordAt("L06", 2),
  LLEVAN: wordAt("L06", 4),
};

export const HUMANOS = {
  START: SCENES.humanos.from,
  END: end("humanos"),
  NOSOTROS: wordAt("L07", 1),
  TRANQUILO: wordAt("L07", 2),
  SANGRE: wordAt("L07", 4),
  OIDOS: wordAt("L08", 3),
  POP: wordAt("L08", 5),
  GOLPE: wordAt("L08", 11),
  PRESION: wordAt("L08", 15),
};

const REGRESO_START = SCENES.regreso.from;
const PRENDER = wordAt("L09", 11);
export const REGRESO = {
  START: REGRESO_START,
  END: end("regreso"),
  BACK: REGRESO_START + 6,
  NADA: wordAt("L09", 5),
  SOLO: wordAt("L09", 8),
  HABRIA: wordAt("L09", 9),
  STRIKE1: wordAt("L09", 9) + 4,
  STRIKE2: PRENDER + 6,
  LIT: PRENDER + 14,
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  MUNDO: wordAt("L10", 7),
  PERO: wordAt("L10", 8),
  SILENCIO: wordAt("L10", 13),
  L10_END: lineEnd("L10"),
  CTA_START: lineStart("L11"),
  TE: wordAt("L11", 5),
};
