// Lista de cortes (EDL). Todo se corta junto —video y voz— para no perder la sincronía.
// Cada corte cae dentro de un silencio detectado en la voz limpia (ffmpeg silencedetect,
// -38 dB, >= 0,30 s), así nunca se corta una palabra a la mitad.

export const FPS = 25;
// El original termina con un fundido a negro desde 78,44 s: se corta antes y el cierre es propio.
export const SOURCE_SECONDS = 78.4;

/** Tramos que se eliminan del original, en segundos [desde, hasta). */
export const REMOVE: [number, number][] = [
  [3.85, 4.2], // pausa tras "Barcelona,"
  [8.8, 9.5], // pausa tras "acompáñenme."
  [15.05, 16.8], // frase trabada: "A mí va a ser un pequeño esfuerzo, ¿eh?"
  [18.45, 18.89],
  [25.9, 26.4],
  [27.87, 28.58],
  [31.58, 31.95],
  [47.45, 47.78],
  [49.88, 50.15],
  [53.8, 54.19],
  [56.45, 56.95],
  [61.37, 62.04],
  [69.16, 69.57],
  [74.27, 74.53],
];

export type Segment = {
  /** frame de inicio en el original */
  from: number;
  /** frame final (exclusivo) en el original */
  to: number;
  /** frame de inicio en la edición */
  at: number;
};

const toFrame = (s: number) => Math.round(s * FPS);

export const SEGMENTS: Segment[] = (() => {
  const out: Segment[] = [];
  let cursor = 0;
  let at = 0;
  for (const [a, b] of REMOVE) {
    const from = toFrame(cursor);
    const to = toFrame(a);
    out.push({from, to, at});
    at += to - from;
    cursor = b;
  }
  const from = toFrame(cursor);
  const to = toFrame(SOURCE_SECONDS);
  out.push({from, to, at});
  return out;
})();

export const EDIT_FRAMES = SEGMENTS.reduce((acc, s) => acc + (s.to - s.from), 0);

/** Cuadro casi congelado al final para sostener la frase de cierre (1,76 s). */
export const HOLD_FRAMES = 44;
export const TOTAL_FRAMES = EDIT_FRAMES + HOLD_FRAMES;

/** Convierte un tiempo del original (ms) al de la edición (ms); null si cae en un tramo eliminado. */
export const mapMs = (ms: number): number | null => {
  const f = (ms / 1000) * FPS;
  for (const s of SEGMENTS) {
    if (f >= s.from && f < s.to) return ((s.at + (f - s.from)) / FPS) * 1000;
  }
  return null;
};

/**
 * Como mapMs, pero si el instante cae en un tramo eliminado lo "empuja" al borde útil:
 * los inicios al final del tramo y los finales al principio. (Los tiempos de whisper son
 * aproximados y a veces caen en un silencio que se recortó.)
 */
export const mapSnap = (ms: number, edge: 'start' | 'end'): number | null => {
  const direct = mapMs(ms);
  if (direct !== null) return direct;
  for (const [a, b] of REMOVE) {
    if (ms >= a * 1000 && ms < b * 1000) return mapMs(edge === 'start' ? b * 1000 + 45 : a * 1000 - 45); // ±45 ms > medio frame
  }
  return null;
};
