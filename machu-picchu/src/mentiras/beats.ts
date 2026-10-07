// Key frames of "¿Y si tus mentiras salieran sobre tu cabeza?" (GLOBAL frames), from the narration
// timing. Every shot and overlay times its action with these names, so they follow the voice if the
// timing shifts. TAG = the frame a truth tag pops over a liar's head (always in the silence after the lie).
import { MENTIRAS } from "./timeline";

const { SCENES, wordAt, wordEnd, lineStart, lineEnd } = MENTIRAS;
const end = (k: keyof typeof SCENES) => SCENES[k].from + SCENES[k].duration;

export const GANCHO = {
  START: SCENES.gancho.from,
  END: end("gancho"),
  /** In bed under the blanket, phone at its ear, fake-panting and pedalling its legs as if running. */
  L01: lineStart("L01"),
  /** Right after "llegando": «ACABA DE DESPERTAR» slams down over Nubi's head. */
  TAG: wordEnd("L01", 4) + 1,
  /** Nubi freezes and looks up at the tag, horrified (the pedalling stops). */
  LOOK: wordEnd("L01", 4) + 9,
  /** Sitting up, to camera: "¿Qué pasaría si cada mentira mostrara la verdad sobre tu cabeza?" */
  L02: lineStart("L02"),
  /** "cabeza": Nubi points up at the tag. */
  CABEZA: wordAt("L02", 10),
  /** "Yo no duré ni cinco segundos" (deadpan). */
  DURE: wordAt("L02", 11),
};

export const ESCAPE = {
  START: SCENES.escape.from,
  END: end("escape"),
  /** Nubi arrives at the café table with a cap pulled right down, smug; taps the cap. */
  L03: lineStart("L03"),
  /** The friend, arms crossed: "¿Y por qué llegaste tarde?" */
  L04: lineStart("L04"),
  L05: lineStart("L05"),
  /** After "Había tráfico": the tag rips up THROUGH the cap: «SE QUEDÓ VIENDO VIDEOS». */
  TAG: lineEnd("L05") + 1,
  /** More details append under it: «DE GATITOS», then «3 HORAS». */
  DETAIL1: lineEnd("L05") + 15,
  DETAIL2: lineEnd("L05") + 28,
  /** Whispered to camera: "Esta cosa da demasiados detalles." */
  L06: lineStart("L06"),
};

export const DEUDA = {
  START: SCENES.deuda.from,
  END: end("deuda"),
  /** The friend pressed against a shop window, dazzled by sneakers (S/799); Nubi appears behind him. */
  L07: lineStart("L07"),
  /** The friend jumps, then: "Te pagaría, pero estoy misio." (turns out his empty pockets) */
  L08: lineStart("L08"),
  /** «TIENE S/800» pops over the friend; then «QUIERE COMPRAR ZAPATILLAS». */
  TAG: lineEnd("L08") + 1,
  DETAIL: lineEnd("L08") + 15,
  /** Nubi holds its fin out, palm up. */
  HAND: lineEnd("L08") + 24,
  /** The friend tries to bolt (legs spinning); Nubi grabs him by the hoodie; his legs keep spinning. */
  RUN: lineEnd("L08") + 32,
  GRAB: lineEnd("L08") + 40,
  /** "Tranquilo… tus zapatillas pueden esperar." */
  L09: lineStart("L09"),
  /** "esperar": he hands Nubi the money; the tag flips S/800 -> S/700. */
  PAGA: wordAt("L09", 4),
};

export const CITA = {
  START: SCENES.cita.from,
  END: end("cita"),
  /** The date reads Nubi's message on her phone: the chat bubble pops beside her. */
  BUBBLE: SCENES.cita.from + 6,
  /** "¿Usas esa frase con todo el mundo?" */
  L10: lineStart("L10"),
  /** Hand on heart, smooth: "No, solo contigo." */
  L11: lineStart("L11"),
  /** The romantic music stops (record scratch) and «LA COPIÓ Y PEGÓ» pops; then «A 7 PERSONAS». */
  TAG: lineEnd("L11") + 1,
  DETAIL: lineEnd("L11") + 15,
  /** Crickets. She stands up (chair scrape) and turns to leave. */
  STAND: lineEnd("L11") + 34,
  /** Nubi reaching out: "¡Pero contigo le puse un corazón!" */
  L12: lineStart("L12"),
  /** She walks out of frame. */
  LEAVE: lineEnd("L12") - 4,
};

export const JEFE = {
  START: SCENES.jefe.from,
  END: end("jefe"),
  /** 6:00 pm: everyone heads for the door with their bags; the boss slides into the doorway. */
  BLOCK: SCENES.jefe.from + 8,
  /** "Una reunión rapidita. Cinco minutos." */
  L13: lineStart("L13"),
  /** «TRAJO 68 DIAPOSITIVAS» over the boss; then «Y PREGUNTAS AL FINAL». */
  TAG: lineEnd("L13") + 1,
  DETAIL: lineEnd("L13") + 17,
  /** Everyone groans and walks slowly backwards to their chairs. */
  GROAN: lineEnd("L13") + 12,
  /** Whispered to camera (Nubi slumped back in its chair): "La mentira más peligrosa de todas." */
  L14: lineStart("L14"),
  /** "dun dun duuun" on the last words. */
  DUN: lineEnd("L14") - 8,
};

export const GIRO = {
  START: SCENES.giro.from,
  END: end("giro"),
  /** Nubi to camera, proud, fins on hips: "Encontré la solución: no volver a mentir." */
  L15: lineStart("L15"),
  /** "la solución": a sparkle. */
  SOLUCION: wordAt("L15", 2),
  /** The friend steps in holding the EMPTY pizza box open, points at it: "¿Te comiste mi pizza?" */
  BOX: lineStart("L16") - 8,
  L16: lineStart("L16"),
  /** Nubi freezes and says nothing; an empty truth tag appears over it with "…" (loading)… */
  SILENCIO: lineEnd("L16") + 3,
  /** …and gives up (no lie, no truth). */
  NADA: lineEnd("L16") + 34,
  /** Nubi looks away and whistles (cheese still on its fin). */
  SILBA: lineEnd("L16") + 10,
  /** Nubi's thought, voice-over (Nubi keeps whistling): "Descubrí que callarme todavía era gratis." */
  L17: lineStart("L17"),
};

export const FINAL = {
  START: SCENES.final.from,
  END: end("final"),
  /** Close to camera: "Ahora confiesa: ¿qué mentira aparecería primero sobre tu cabeza?" */
  L18: lineStart("L18"),
  /** The three option cards pop one by one: «ESTOY LLEGANDO», «YA TE PAGUÉ», «NO ME PASA NADA». */
  OPT1: wordAt("L18", 9),
  OPT2: wordAt("L18", 11),
  OPT3: wordAt("L18", 14),
  /** Nubi crosses its fins: "Yo nunca digo esa última." */
  ARMS: lineStart("L19") - 6,
  L19: lineStart("L19"),
  /** «LA DIJO ESTA MAÑANA» pops over Nubi. */
  TAG: lineEnd("L19") + 1,
  /** Nubi turns on the tag, shouting: "¡A ti nadie te preguntó!" */
  L20: lineStart("L20"),
  /** Nubi swats the tag away (it spins off screen). */
  SWAT: lineEnd("L20") + 2,
  /** End card: «¿CUÁL SALDRÍA SOBRE TU CABEZA? 1, 2 o 3». */
  CARD: lineEnd("L20") + 8,
  /** The phone rings on the nightstand; Nubi reaches for it (the video loops back to the call). */
  RING: end("final") - 26,
};
