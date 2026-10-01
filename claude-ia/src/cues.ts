import {STARTS} from './timeline';

// Efectos de sonido: [frame local de la escena, archivo, volumen].
type Cue = [number, string, number];

const typing = (from: number, to: number, every = 3, vol = 0.35): Cue[] => {
  const out: Cue[] = [];
  for (let f = from; f < to; f += every) out.push([f, 'tick', vol]);
  return out;
};

const PER_SCENE: Cue[][] = [
  // S1 — "Todo empieza con una pregunta"
  [[6, 'tick', 0.5], [14, 'tick', 0.45], [24, 'tick', 0.45], [30, 'tick', 0.45], [40, 'pop', 0.7], ...typing(50, 68), [80, 'click', 0.9], [96, 'whoosh-soft', 0.7], [106, 'sparkle', 0.6], [100, 'swell', 0.55]],
  // S2 — Idea -> Prompt
  [[0, 'impact', 0.45], [6, 'pop', 0.5], [26, 'whoosh-soft', 0.6], [40, 'glitch', 0.55], [70, 'whoosh', 0.5]],
  // S3 — ¿Y si esto pudiera pensar contigo?
  [[2, 'pop', 0.6], ...typing(16, 40), [40, 'pop', 0.4], [52, 'sparkle', 0.5], ...typing(54, 66), [76, 'whoosh-soft', 0.6], [92, 'whoosh', 0.85], [63, 'swell', 0.6]],
  // S4 — Convirtiendo ideas en resultados
  [[0, 'impact', 0.7], ...typing(8, 24, 3, 0.3), [30, 'whoosh-soft', 0.55], ...typing(42, 64, 3, 0.3), [56, 'whoosh-soft', 0.5], [76, 'pop', 0.55], [116, 'whoosh', 0.8], [130, 'sparkle', 0.5]],
  // S5 — RAZONA / CLARIDAD (claro)
  [[4, 'whoosh-soft', 0.5], [30, 'pop', 0.6], [42, 'sparkle', 0.4], [96, 'whoosh-soft', 0.6], [104, 'whoosh', 0.7], [120, 'pop', 0.5], [134, 'pop', 0.45], [142, 'pop', 0.4], [160, 'whoosh-soft', 0.5], [190, 'whoosh', 0.6]],
  // S6 — Cinta y chat
  [[0, 'whoosh', 0.6], [22, 'pop', 0.5], [30, 'pop', 0.5], [38, 'pop', 0.5], [46, 'pop', 0.4], ...typing(14, 40, 3, 0.25), ...typing(56, 120, 4, 0.2)],
  // SJ — Crea juntos (cursores colaborativos)
  [[6, 'pop', 0.5], [10, 'whoosh-soft', 0.45], [16, 'click', 0.7], [26, 'whoosh', 0.55], [30, 'whoosh-soft', 0.45], [74, 'click', 0.85], [78, 'pop', 0.45], ...typing(96, 124, 3, 0.25), [132, 'whoosh-soft', 0.4]],
  // S7 — Tablero
  [[0, 'impact', 0.35], [2, 'whoosh-soft', 0.4], [12, 'whoosh-soft', 0.4], [22, 'whoosh-soft', 0.4], [32, 'whoosh-soft', 0.4], [40, 'pop', 0.5], [70, 'whoosh', 0.7], ...typing(80, 104, 3, 0.3), [108, 'glitch', 0.5], [120, 'sparkle', 0.45]],
  // S8 — Artefactos
  [[0, 'click', 0.7], [2, 'whoosh', 0.6], [18, 'pop', 0.6], [22, 'sparkle', 0.5], [50, 'whoosh-soft', 0.6], [60, 'glitch', 0.55], ...typing(74, 90, 3, 0.3)],
  // S9 — Respuestas claras
  [[0, 'pop', 0.5], [8, 'pop', 0.35], [14, 'whoosh-soft', 0.55], [22, 'tick', 0.4], [36, 'pop', 0.5], [46, 'sparkle', 0.55], [92, 'whoosh-soft', 0.5]],
  // S10 — Todo pensado para llevarte más lejos
  [...typing(4, 30, 4, 0.3), [14, 'pop', 0.45], [20, 'pop', 0.4], [24, 'sparkle', 0.4], [42, 'glitch', 0.5], [60, 'whoosh-soft', 0.4], [84, 'whoosh', 0.75]],
  // S11 — Porque una gran IA... entiende
  [...typing(2, 54, 3, 0.28), [58, 'pop', 0.6], [62, 'sparkle', 0.55], [66, 'tick', 0.3], [72, 'tick', 0.3], [79, 'tick', 0.3]],
  // S12 — Cierre
  [[2, 'pop', 0.55], ...typing(8, 26, 3, 0.25), [26, 'whoosh-soft', 0.45], [50, 'whoosh-soft', 0.5], [62, 'pop', 0.55], ...typing(66, 90, 3, 0.25), [90, 'chime', 0.75], [92, 'sparkle', 0.45]],
];

export const CUES: {frame: number; file: string; volume: number}[] = PER_SCENE.flatMap((cues, i) =>
  cues.map(([f, file, volume]) => ({frame: STARTS[i] + f, file, volume})),
).sort((a, b) => a.frame - b.frame);
