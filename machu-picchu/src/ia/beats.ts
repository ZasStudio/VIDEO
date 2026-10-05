// Key frames of the "¿Qué pasaría si la IA no existiera?" short (GLOBAL frames), from the narration
// timing. Every shot and overlay times its action with these names, so they follow the voice.
import { IA } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart, lineEnd } = IA;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const GANCHO = {
  START: SCENES.gancho.from,
  END: end("gancho"),
  /** Cut from the girl reading the endless message to the boy typing his request to the AI. */
  TYPE: SCENES.gancho.from + 22,
  L01: lineStart("L01"),
  /** The boy hits "send" on «Dile que la extraño, pero sin parecer intenso» (Nubi already talking). */
  SEND: lineStart("L01") + 12,
  /** Cut to Nubi, who speaks to the camera from "ese «te extraño»". */
  NUBI: wordAt("L01", 6) - 2,
  /** «ese "te extraño"». */
  EXTRANO: wordAt("L01", 7),
  /** "Y eso apenas es el comienzo": Nubi reaches for the big switch. */
  COMIENZO: wordAt("L01", 15),
  /** Nubi pulls the switch: «IA: ON → OFF», everything powers down. */
  SWITCH: lineEnd("L01") + 2,
};

export const MENSAJE = {
  START: SCENES.mensaje.from,
  END: end("mensaje"),
  L02: lineStart("L02"),
  /** "¿ya comiste?" is sent (SIN IA side). */
  SENT: lineEnd("L02"),
  L03: lineStart("L03"),
  PARRAFOS: wordAt("L03", 0),
  ALMUERZO: wordAt("L03", 10),
  /** Her reply arrives: «Sí». Then crickets. */
  SI: lineEnd("L03") + 8,
  L04: lineStart("L04"),
};

export const TAREA = {
  START: SCENES.tarea.from,
  END: end("tarea"),
  /** The student opens the AI page: it does not exist (error). */
  ERROR: SCENES.tarea.from + 16,
  L05: lineStart("L05"),
  /** "ahora sí se quedó para el último minuto". */
  AHORA: wordAt("L05", 8),
  /** Types «Desde los tiempos antiguos…» word by word. */
  TYPE: lineEnd("L05") + 2,
  L06: lineStart("L06"),
  /** The clock flips to 12:00: ENTREGA CERRADA; head on the desk. */
  MIDNIGHT: lineEnd("L06") + 12,
};

export const JEFE = {
  START: SCENES.jefe.from,
  END: end("jefe"),
  L07: lineStart("L07"),
  RAPIDITA: wordAt("L07", 3),
  /** Forty empty slides appear. */
  SLIDES: lineEnd("L07") + 2,
  L08: lineStart("L08"),
  RAPIDITO: wordAt("L08", 4),
  /** The montage: coffee, more coffee, sunrise. */
  COFFEE1: lineEnd("L08") + 2,
  COFFEE2: lineEnd("L08") + Math.round(0.36 * (lineStart("L09") - lineEnd("L08"))),
  SUNRISE: lineEnd("L08") + Math.round(0.68 * (lineStart("L09") - lineEnd("L08"))),
  L09: lineStart("L09"),
  L10: lineStart("L10"),
  /** The worker stares into the camera. */
  STARE: lineEnd("L10") + 4,
};

export const FOTO = {
  START: SCENES.foto.from,
  END: end("foto"),
  /** The luxury photo is posted: likes pour in. */
  POST: SCENES.foto.from + 6,
  L11: lineStart("L11"),
  /** The scene rewinds / the camera pulls back from the post. */
  REWIND: wordAt("L11", 5),
  /** "otro presupuesto": the reveal, a toy car held close to the lens. */
  REVEAL: wordAt("L11", 10),
  L12: lineStart("L12"),
};

export const GIRO = {
  START: SCENES.giro.from,
  END: end("giro"),
  /** Record scratch: the comic montage switches off. */
  SCRATCH: SCENES.giro.from,
  L13: lineStart("L13"),
  /** "Ya estudiábamos, creábamos y trabajábamos": the boy writes his own message. */
  YA: wordAt("L13", 4),
  /** "La pregunta es…": Nubi pushes the switch back ON. */
  PREGUNTA: wordAt("L13", 13),
  /** "…a que lo hagan todo". */
  TODO: wordAt("L13", 26),
  /** «¿Qué almuerzo?» typed to the AI, a full plate right beside the laptop. */
  ALMUERZO: lineEnd("L13") + 4,
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  L14: lineStart("L14"),
  /** The three options pop up behind Nubi, on their words. */
  TAREA: wordAt("L14", 12),
  TRABAJO: wordAt("L14", 15),
  MENSAJE: wordAt("L14", 18),
  TUYO: wordEnd("L14", 25),
  /** One eye narrows: "levanta una ceja". */
  SQUINT: lineEnd("L14") + 2,
  L15: lineStart("L15"),
  /** End card: «¿QUÉ LE PEDISTE? 👀». */
  CARD: lineEnd("L15") + 10,
};
