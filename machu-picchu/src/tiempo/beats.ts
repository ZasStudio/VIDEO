// Key frames of the time short (GLOBAL frames), from the narration timing. Every shot and the
// life counters (clock.ts) time their action with these names, so they follow the voices.
import { TIEMPO } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart, lineEnd } = TIEMPO;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const HOOK = {
  START: SCENES.hook.from,
  END: end("hook"),
  /** "dinero": a banknote drifts past Nubi and crumbles into sand. */
  DINERO: wordAt("L01", 6),
  /** "tiempo": the camera rises to the counter over Nubi's head. */
  TIEMPO: wordAt("L01", 12),
  VIDA: wordAt("L01", 17),
};

export const COMPRAS = {
  START: SCENES.compras.from,
  END: end("compras"),
  /** Nubi taps its fin on the payment terminal. */
  TAP: wordAt("L02", 2) - 4,
  /** "seis horas": Nubi's counter drops 6 hours. */
  SEIS: wordAt("L02", 3),
  /** Nubi slurps the juice. */
  SLURP: wordEnd("L02", 4) + 2,
  /** "Una pizza…": cut to the pizza counter. */
  PIZZA: wordAt("L02", 5),
  /** "¡tres días!": the price; Nubi recoils. */
  TRES: wordAt("L02", 7),
};

export const ESCALA = {
  START: SCENES.escala.from,
  END: end("escala"),
  CELULAR: wordAt("L03", 1),
  MES: wordAt("L03", 4),
  AUTO: wordAt("L03", 6),
  ANOS: wordAt("L03", 8),
  /** "Y una casa…": cut to the mansion. */
  CASA_CUT: wordAt("L03", 9),
  /** The sign "40 AÑOS". */
  CASA: wordAt("L03", 11),
  /** "Una vida entera.": Nubi deflates. */
  L04: lineStart("L04"),
  ENTERA: wordAt("L04", 2),
};

export const PREGUNTA = {
  START: SCENES.pregunta.from,
  END: end("pregunta"),
  L05: lineStart("L05"),
  COMO: wordAt("L05", 1),
};

export const OFICINA = {
  START: SCENES.oficina.from,
  END: end("oficina"),
  /** "Trabajando.": Nubi at a desk next to its coworker. */
  L06: lineStart("L06"),
  /** The working day in a time-lapse (9:00 → 17:00): every counter drops 8 hours. */
  LAPSE: lineStart("L06") + 12,
  LAPSE_END: lineEnd("L06") - 2,
  /** "un día extra": the rule "8 H = +1 DÍA" lights up. */
  DIA: wordAt("L06", 8),
  /** The shift-end bell. */
  BELL: lineEnd("L06"),
  /** The coworker's reward: "+00:03:00". */
  REWARD: lineEnd("L06") + 8,
  L07: lineStart("L07"),
  PRODUCTIVO: wordAt("L07", 8),
};

export const SENORA = {
  START: SCENES.senora.from,
  END: end("senora"),
  L08: lineStart("L08"),
  /** "dieciocho segundos": her counter reads exactly 00:00:18 here. */
  DIECIOCHO: wordAt("L08", 3),
  L09: lineStart("L09"),
  ALQUILER: wordAt("L09", 7),
  /** "Tome…": their fins touch. */
  TOME: wordAt("L10", 0),
  /** "un año": the year flows over (her counter +1 AÑO, Nubi's −1 AÑO). */
  ANO: wordAt("L10", 1),
  INVITO: wordAt("L10", 3),
  /** She hugs Nubi. */
  HUG: lineEnd("L10") + 2,
};

export const CARGO = {
  START: SCENES.cargo.from,
  END: end("cargo"),
  /** Nubi's counter starts beeping and draining (years per second). */
  ALARM: SCENES.cargo.from + 6,
  L11: lineStart("L11"),
  /** The giant TIMECO notification slides in. */
  NOTIF: lineStart("L12") - 6,
  L12: lineStart("L12"),
  PREMIUM: wordAt("L12", 5),
  GRACIAS: wordAt("L12", 6),
  /** Nubi takes a huge breath and holds it: the counter stops. */
  INHALE: wordAt("L12", 9),
  /** Nubi can't hold it: the air bursts out, the counter drains again. */
  EXHALE: end("cargo") - 12,
};

export const TIMECO = {
  START: SCENES.timeco.from,
  END: end("timeco"),
  /** The tower reveal (boom). */
  TOWER: SCENES.timeco.from + 8,
  L13: lineStart("L13"),
  COMER: wordAt("L13", 4),
  DORMIR: wordAt("L13", 5),
  RESPIRAR: wordAt("L13", 6),
  TRABAJAR: wordAt("L13", 10),
  /** The extraction screen: "45 SEGUNDOS DE CADA PERSONA". */
  SCREEN: lineEnd("L13") + 2,
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  /** The TIMECO drone drops in front of Nubi. */
  DRONE: SCENES.final.from,
  /** Its red scan sweeps over Nubi. */
  SCAN: lineStart("L14") - 8,
  L14: lineStart("L14"),
  /** "diez segundos": Nubi's counter crashes to 00:00:10 and runs in real time from here. */
  MULTA: wordAt("L14", 4),
  /** The giant door starts opening. */
  DOOR: lineEnd("L14"),
  L15: lineStart("L15"),
  /** "¿lo gastarías…": the comment card appears. */
  CARD: wordAt("L15", 7),
  FELIZ: wordAt("L15", 11),
  TRABAJAR: wordAt("L15", 14),
  /** Cut to black (Nubi's counter still shows 00:00:01). */
  BLACK: lineEnd("L15") + 4,
  /** "Pase, Nubi… lo estábamos esperando." over black. */
  L16: lineStart("L16"),
};
