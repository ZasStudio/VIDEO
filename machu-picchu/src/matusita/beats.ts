// Key frames of the Casa Matusita short (GLOBAL frames), from the narration timing. Every shot and
// overlay times its action with these names, so they follow the voice if the timing shifts.
import { MATUSITA } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart, lineEnd } = MATUSITA;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const GANCHO = {
  START: SCENES.gancho.from,
  END: end("gancho"),
  /** The flashlight clicks on under Nubi's face: its eyes appear. */
  LIGHT: SCENES.gancho.from + 8,
  L01: lineStart("L01"),
  LIMA: wordAt("L01", 4),
  /** "siete días": "META: 7 DÍAS". */
  SIETE: wordAt("L01", 12),
  /** "ni dos horas": "DURÓ: MENOS DE 2 HORAS". */
  DOS: wordAt("L01", 18),
};

export const LUGAR = {
  START: SCENES.lugar.from,
  END: end("lugar"),
  /** Thunder flash over the facade. */
  THUNDER: SCENES.lugar.from + 6,
  L02: lineStart("L02"),
  MATUSITA: wordAt("L02", 2),
  /** "ese segundo piso": the camera rises to the second floor. */
  SEGUNDO: wordAt("L02", 14),
  /** A second-floor window lights up briefly. */
  WINDOW: wordAt("L02", 15),
  /** Nubi raises its flashlight to the window. */
  RAISE: lineEnd("L02") + 4,
  L03: lineStart("L03"),
  /** "algo miraba de vuelta": two faint eyes in the dark window, for a moment. */
  EYES: wordAt("L03", 5),
  EYES_OFF: wordEnd("L03", 8) + 6,
};

export const RETO = {
  START: SCENES.reto.from,
  END: end("reto"),
  /** The camcorder starts recording (REC). */
  REC: SCENES.reto.from,
  /** The rusty door creaks open; Nubi steps in: the street sound drops dead. */
  OPEN: SCENES.reto.from + 4,
  INSIDE: lineStart("L04") - 4,
  L04: lineStart("L04"),
  SEMANA: wordAt("L04", 1),
  /** The door behind Nubi slams shut by itself. */
  SLAM: lineEnd("L04") + 4,
  /** Nubi tries the handle: locked. */
  RATTLE: lineEnd("L04") + 14,
  L05: lineStart("L05"),
  DIGNIDAD: wordAt("L05", 8),
  LINTERNA: wordAt("L05", 11),
};

export const MIEDO = {
  START: SCENES.miedo.from,
  END: end("miedo"),
  /** A heavy thump upstairs. */
  THUMP: SCENES.miedo.from + 6,
  L06: lineStart("L06"),
  PASOS: wordAt("L06", 9),
  /** "No venían de adelante…": the light sweeps the empty hallway ahead. */
  ADELANTE: wordAt("L06", 10),
  /** Footsteps behind Nubi. */
  STEPS: lineEnd("L06"),
  /** "…venían detrás de él.": Nubi turns slowly. */
  L07: lineStart("L07"),
  /** A second shadow appears on the wall next to Nubi's. */
  SHADOW: lineEnd("L07") + 2,
  /** Nubi bolts. */
  RUN: end("miedo") - 12,
};

export const SUSTO = {
  START: SCENES.susto.from,
  END: end("susto"),
  /** Nubi flings a door open: behind it, its own room. */
  DOOR: SCENES.susto.from + 8,
  L08: lineStart("L08"),
  /** "dos horas después": the camcorder clock jumps forward. */
  HORAS: wordAt("L08", 3),
  /** The other Nubi, sitting at the camera, slowly turns its head. */
  TURN: wordAt("L08", 9),
  /** It switches off its flashlight: hard cut to black. */
  OFF: end("susto") - 8,
};

export const VERDAD = {
  START: SCENES.verdad.from,
  END: end("verdad"),
  /** Nubi breathes out; the room light comes back slowly. */
  BREATH: SCENES.verdad.from + 6,
  L09: lineStart("L09"),
  NUNCA: wordAt("L09", 9),
  TELE: wordAt("L09", 19),
  L10: lineStart("L10"),
  MENTIRA: wordAt("L10", 7),
  /** Two knocks on the door behind Nubi. */
  KNOCK: lineEnd("L10") + 10,
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  /** Nubi spins round: nobody; the door is ajar. */
  TURN: SCENES.final.from,
  /** It turns back to the camera. */
  BACK: lineStart("L11") - 4,
  L11: lineStart("L11"),
  /** "…alguien acaba de entrar?": the door behind Nubi starts to close by itself. */
  ALGUIEN: wordAt("L11", 10),
  /** The latch clicks: the door is shut. */
  CLICK: lineEnd("L11") + 6,
  /** The flashlight flickers out: black. */
  BLACK: lineEnd("L11") + 22,
  /** The end card ("¿LEYENDA O SUGESTIÓN?"). */
  CARD: lineEnd("L11") + 30,
};
