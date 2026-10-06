// Key frames of "¿Y si dormir te pagara?" (GLOBAL frames), from the narration timing. Every shot and
// overlay times its action with these names, so they follow the voice if the timing shifts.
import { DORMIR } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart, lineEnd } = DORMIR;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const GANCHO = {
  START: SCENES.gancho.from,
  END: end("gancho"),
  /** The alarm clock starts ringing: the money counter over the bed stops climbing. */
  ALARM: Math.max(SCENES.gancho.from + 12, lineStart("L01") - 20),
  /** Nubi's fin smashes the alarm clock (eyes still closed). */
  SMASH: lineStart("L01") - 6,
  L01: lineStart("L01"),
  /** "trescientos soles": the frozen counter (S/300) flashes red. */
  TRESCIENTOS: wordAt("L01", 6),
  L02: lineStart("L02"),
  /** "cien soles por hora": the rule stamp. */
  CIEN: wordAt("L02", 6),
  /** "cuando todos quisieron hacerse ricos". */
  TODOS: wordAt("L02", 15),
};

export const OFICINA = {
  START: SCENES.oficina.from,
  END: end("oficina"),
  /** Nubi dives into its office bed and pulls the blanket over itself. */
  DIVE: SCENES.oficina.from + 18,
  L03: lineStart("L03"),
  L04: lineStart("L04"),
  /** Nubi starts snoring; the boss nods, proud. */
  SNORE: lineEnd("L04") + 4,
  NOD: lineEnd("L04") + 16,
  L05: lineStart("L05"),
};

export const PROBLEMA = {
  START: SCENES.problema.from,
  END: end("problema"),
  L06: lineStart("L06"),
  /** "solo cobrabas dormido". */
  SOLO: wordAt("L06", 4),
  /** "Fingir no servía": the bed sensor buzzes «DESPIERTO». */
  FINGIR: wordAt("L06", 7),
  L07: lineStart("L07"),
  /** "¡NO PIENSES EN EL DINERO!" (shouted). */
  GRITO: wordAt("L07", 2),
  /** Nubi opens one eye to peek at its counter: still S/0. */
  PEEK: lineEnd("L07") + 4,
};

export const MUNDO = {
  START: SCENES.mundo.from,
  END: end("mundo"),
  L08: lineStart("L08"),
  /** "¿quién iba a preparar la comida?": the cook asleep on the stove next door. */
  QUIEN: wordAt("L08", 5),
  /** Nubi rings the counter bell; the baker wakes with a huge yawn. */
  BELL: lineEnd("L08") + 4,
  YAWN: lineEnd("L08") + 12,
  L09: lineStart("L09"),
  L10: lineStart("L10"),
  L11: lineStart("L11"),
};

export const ENEMIGO = {
  START: SCENES.enemigo.from,
  END: end("enemigo"),
  /** Back in bed, Nubi shuts its eyes; then the drill starts next door. */
  DRILL: SCENES.enemigo.from + 14,
  L12: lineStart("L12"),
  /** The neighbour: a drill that isn't even on, and a speaker playing construction noise. */
  REVEAL: lineEnd("L12") + 4,
  L13: lineStart("L13"),
  L14: lineStart("L14"),
};

export const GIRO = {
  START: SCENES.giro.from,
  END: end("giro"),
  /** Nubi pays the neighbour; the sleep mask snaps on; the money montage starts. */
  PAY: SCENES.giro.from + 4,
  MASK: SCENES.giro.from + 20,
  L15: lineStart("L15"),
  /** "mil soles": the counter hits S/1000. */
  MIL: wordAt("L15", 3),
  RICO: wordAt("L15", 6),
  /** "abrí los ojos": the mask comes off. */
  OJOS: wordAt("L15", 9),
  /** The phone: three charges land, one after another, down to S/0. */
  CHARGE1: lineEnd("L15") + 2,
  CHARGE2: lineEnd("L15") + 10,
  CHARGE3: lineEnd("L15") + 18,
  ZERO: lineEnd("L15") + 26,
  L16: lineStart("L16"),
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  L17: lineStart("L17"),
  CUANTO: wordAt("L17", 11),
  MILLONARIO: wordAt("L17", 17),
  /** The alarm rings again; Nubi glares at it. */
  ALARM: lineEnd("L17") + 4,
  L18: lineStart("L18"),
  /** Smash; Nubi drops back to sleep; the counter starts again (the video loops). */
  SMASH: lineEnd("L18") + 6,
  SLEEP: lineEnd("L18") + 18,
  /** End text «¿CUÁNTO GANARÍAS DURMIENDO? 💤💸» over the sleeping Nubi. */
  CARD: lineEnd("L18") + 10,
  /** Last word of the question (for overlays). */
  CASA: wordEnd("L17", 20),
};
