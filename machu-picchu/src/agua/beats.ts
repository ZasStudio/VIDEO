// Key frames of the water short (GLOBAL frames), from the narration timing. Every shot times
// its action with these names, so the animation follows the voices if the timing shifts.
import { AGUA } from "./timeline";

const { SCENES, wordAt, lineStart, lineEnd } = AGUA;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const HOOK = {
  START: SCENES.hook.from,
  END: end("hook"),
  /** "desapareciera": the water in the glass vanishes. */
  VANISH: wordAt("L01", 5),
  /** Cut from the glass to the ocean (just after the water vanishes). */
  OCEAN: wordAt("L01", 5) + 16,
  /** "ahora": the ocean drains away (inside the ocean shot). */
  AHORA: wordAt("L01", 6),
  /** "Encontré la última botella…": cut to the flash-forward chase. */
  L02: lineStart("L02"),
  BOTELLA: wordAt("L02", 3),
  /** "error": the crowd floods in behind Nubi. */
  ERROR: wordAt("L02", 8),
  /** Freeze frame ("sí, ese soy yo") until the end of the hook. */
  FREEZE: lineEnd("L02") - 2,
};

export const ANTES = {
  START: SCENES.antes.from,
  END: end("antes"),
  /** The "DOS HORAS ANTES" rewind card covers the screen until here. */
  CARD_OUT: SCENES.antes.from + 22,
  CORTADO: wordAt("L03", 3),
  /** "playa": cut to the dry beach. */
  PLAYA: wordAt("L03", 11),
  /** Nubi looks up: the ship leaning over it. */
  UP: lineStart("L04") - 24,
  MAL: wordAt("L04", 3),
};

export const PROBLEMA = {
  START: SCENES.problema.from,
  END: end("problema"),
  SED: wordAt("L05", 2),
  COMIENZO: wordAt("L05", 6),
  /** "Sin agua, los cultivos…": cut to the fields. */
  L06: lineStart("L06"),
  /** "…y conseguir comida…": cut to the supermarket. */
  CONSEGUIR: wordAt("L06", 7),
  DIFICIL: wordAt("L06", 13),
  L07: lineStart("L07"),
  PAPA: wordAt("L07", 2),
  SEGURIDAD: wordAt("L07", 5),
};

export const SOLUCION = {
  START: SCENES.solucion.from,
  END: end("solucion"),
  /** "Pssst… ¡oye, tú!" (the seller). */
  PSST: lineStart("L08"),
  OYE: wordAt("L08", 1),
  /** The safe door swings open: the bottle glows. */
  SAFE: lineEnd("L08") + 3,
  /** "La última. Diez millones." */
  ULTIMA: lineStart("L09"),
  MILLONES: wordAt("L09", 3),
  /** "Tengo tres soles… y te hago un retrato." (Nubi) */
  L10: lineStart("L10"),
  SOLES: wordAt("L10", 2),
  RETRATO: wordAt("L10", 7),
  /** Nubi scribbles the portrait. */
  DRAW: lineEnd("L10") + 2,
  /** The seller sees it. */
  SHOW: lineStart("L11") - 12,
  /** "Igualito a mí." */
  IGUALITO: lineStart("L11"),
  /** He hands the bottle over. */
  GIVE: lineEnd("L11") + 4,
};

export const PELIGRO = {
  START: SCENES.peligro.from,
  END: end("peligro"),
  /** Nubi steps out of the alley hugging the bottle. */
  OUT: SCENES.peligro.from + 3,
  /** Everyone stops (record scratch). */
  SILENCE: SCENES.peligro.from + 14,
  /** Every head turns to Nubi. */
  TURN: SCENES.peligro.from + 22,
  L12: lineStart("L12"),
  MOSTRARLA: wordAt("L12", 3),
  AMIGOS: wordAt("L12", 8),
  /** Nubi bolts, the crowd charges. */
  CHASE: lineEnd("L12") + 2,
  /** Nubi hides behind the thin pole. */
  POLE: lineStart("L13") - 12,
  L13: lineStart("L13"),
  TAMPOCO: wordAt("L13", 6),
  /** A fin taps Nubi from the side. */
  FIN: lineEnd("L13") + 4,
  /** Nubi runs. */
  RUN: lineEnd("L13") + 16,
};

export const GIRO = {
  START: SCENES.giro.from,
  END: end("giro"),
  /** Nubi unscrews the cap. */
  OPEN: Math.max(SCENES.giro.from, lineStart("L14") - 14),
  L14: lineStart("L14"),
  /** "¡NO!": it's empty. */
  NO: wordAt("L14", 2),
  /** The hole in the bottom. */
  HOLE: lineEnd("L14") + 2,
  /** "¡Me seguían porque…": the top-down shot of the trail of drops. */
  TRAIL: lineStart("L15"),
  AGUA: wordAt("L15", 6),
  /** The last drop falls. */
  DROP: lineStart("L16") - 16,
  /** "¡NOOO!": the slow-motion dive. */
  DIVE: lineStart("L16"),
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  /** Nubi falls out of bed. */
  FALL: SCENES.final.from + 4,
  /** At the sink: the tap gives a big stream of water. */
  SINK: lineStart("L17") - 12,
  L17: lineStart("L17"),
  L18: lineStart("L18"),
  BOTELLA: wordAt("L18", 5),
  /** The bottle close to the camera, hugged. */
  CLOSE: lineStart("L19"),
  QUEDARIAS: wordAt("L19", 5),
  L20: lineStart("L20"),
  /** The suspicious squint. */
  MIRANDO: wordAt("L20", 4),
  /** The question card ("¿COMPARTIR O SOBREVIVIR?") appears at the top. */
  CARD: wordAt("L19", 1),
};
