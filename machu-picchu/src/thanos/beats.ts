// Key frames of the Thanos short (global frames), from the narration timing.
import { THANOS } from "./timeline";

const { SCENES, wordAt, lineStart, lineEnd } = THANOS;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const PORTAL = {
  START: SCENES.portal.from,
  END: end("portal"),
  /** First person through the portal until here; then Nubi drops into the frozen battle. */
  POV_END: lineStart("L01") - 12,
  LAND: lineStart("L01"),
  ALTO: [wordAt("L01", 0), wordAt("L01", 1), wordAt("L01", 2)],
  ESTE: wordAt("L01", 3),
  IMPORTANTE: wordAt("L01", 8),
  UNIVERSO: wordAt("L01", 12),
};

export const CARRERA = {
  START: SCENES.carrera.from,
  END: end("carrera"),
  RUN: SCENES.carrera.from + 6,
  DEDOS: wordAt("L02", 5),
  EVITARLO: wordAt("L02", 10),
  FACIL: lineStart("L03"),
  /** The rock catches a leg; the slow motion ends. */
  TRIP: lineEnd("L03") + 5,
  /** Face-plant. */
  FALL: lineEnd("L03") + 14,
  NO: lineStart("L04"),
  FACIL2: wordAt("L04", 3),
};

export const THOR = {
  START: SCENES.thor.from,
  END: end("thor"),
  BOLT: SCENES.thor.from + 12,
  GUANTELETE: wordAt("L05", 5),
  THROW: lineEnd("L05") + 3,
  /** First person riding the hammer, from the throw to the impact. */
  POV: lineEnd("L05") + 7,
  HIT: lineEnd("L05") + 46,
  /** Thanos snaps: just a click. */
  SNAP: lineStart("L06") - 24,
  SENAL: wordAt("L06", 3),
  L06: lineStart("L06"),
};

export const HEROES = {
  START: SCENES.heroes.from,
  END: end("heroes"),
  /** One landing after another while "todos los héroes siguen aquí" plays. */
  LANDS: [0, 1, 2, 3, 4, 5].map((i) => SCENES.heroes.from + 14 + i * 19),
  HEROES: wordAt("L07", 5),
  TRISTES: wordAt("L08", 4),
  TIEMPO: wordAt("L08", 10),
  EQUIPO: wordAt("L08", 13),
  COMPLETO: wordAt("L08", 15),
};

export const TRAJES = {
  START: SCENES.trajes.from,
  END: end("trajes"),
  /** "uno con …": each costume change lands 4 frames before its "uno". */
  UNO: [wordAt("L09", 0), wordAt("L09", 3), wordAt("L09", 6), wordAt("L09", 9)],
  /** The item words: escudo, martillo, rayos, magia. */
  ITEM: [wordAt("L09", 2), wordAt("L09", 5), wordAt("L09", 8), wordAt("L09", 11)],
  /** Back to plain Nubi, holding a rock. */
  PLAIN: lineEnd("L09") + 2,
  PIEDRA: wordAt("L10", 5),
  TOSS: lineEnd("L10") + 8,
  BONK: lineEnd("L10") + 24,
};

export const PIEDRAS = {
  START: SCENES.piedras.from,
  END: end("piedras"),
  FURY: SCENES.piedras.from + 4,
  POWER: SCENES.piedras.from + 14,
  PIEDRAS: wordAt("L11", 6),
  /** The gauntlet slams the ground: cracks run towards the heroes. */
  BLAST: lineEnd("L11") + 4,
  INTENTARA: wordAt("L12", 9),
  /** The ground bursts and Nubi is launched. */
  BURST: wordAt("L12", 10),
  LAUNCH: wordAt("L12", 10) + 6,
  /** First person, tumbling through the air. */
  POV: wordAt("L12", 12),
};

export const PORTALES = {
  START: SCENES.portales.from,
  END: end("portales"),
  OPEN: SCENES.portales.from + 20,
  BATALLA: wordAt("L13", 3),
  TODOS: wordAt("L13", 9),
  THANOS: wordAt("L13", 12),
  NADIE: wordAt("L13", 16),
  PILE: lineEnd("L13") + 4,
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  PIERDE: wordAt("L14", 3),
  TAKE: wordAt("L14", 7),
  GUANTELETE: wordAt("L14", 10),
  ESPERA: lineStart("L15"),
  APP: wordAt("L15", 3),
  PIZZA: wordAt("L15", 5),
};

export const POSCREDITOS = {
  START: SCENES.poscreditos.from,
  END: end("poscreditos"),
  CLANK: SCENES.poscreditos.from + 34,
};

export const DOOM = {
  START: SCENES.doom.from,
  END: end("doom"),
  GRAB: SCENES.doom.from + 14,
  UNIVERSO: wordAt("L16", 4),
  MEJORARLO: wordAt("L17", 2),
  TURN: lineEnd("L17") + 4,
  GLOW: lineEnd("L17") + 12,
  LIGHT: lineEnd("L17") + 18,
  PROBLEMA: wordAt("L18", 7),
  BLACK: end("doom") - 8,
};

export const CIERRE = {
  START: SCENES.cierre.from,
  END: end("cierre"),
};
