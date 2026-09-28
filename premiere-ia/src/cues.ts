// Every sound in this video was synthesized in code (scripts/generate-audio.mjs).
export type Sfx =
  | 'whoosh'
  | 'whoosh-short'
  | 'pop'
  | 'click'
  | 'key'
  | 'typing'
  | 'cut'
  | 'impact'
  | 'scratch'
  | 'ding'
  | 'sparkle'
  | 'glitch'
  | 'riser';

// [global frame, sound, volume]
export const CUES: [number, Sfx, number][] = [
  // Intro
  [2, 'whoosh-short', 0.38],
  [8, 'whoosh-short', 0.3],
  [26, 'pop', 0.38],
  [40, 'pop', 0.34],
  [70, 'pop', 0.47],
  [76, 'pop', 0.51],
  [82, 'sparkle', 0.34],
  [141, 'whoosh', 0.45],
  // Interface
  [152, 'whoosh', 0.5],
  [164, 'pop', 0.42],
  [174, 'pop', 0.38],
  [180, 'click', 0.48],
  [216, 'click', 0.48],
  [252, 'click', 0.48],
  [288, 'click', 0.48],
  [290, 'pop', 0.38],
  [324, 'click', 0.48],
  [366, 'whoosh-short', 0.47],
  // Editing
  [377, 'pop', 0.42],
  [385, 'click', 0.48],
  [399, 'pop', 0.38],
  [408, 'click', 0.48],
  [417, 'pop', 0.38],
  [424, 'click', 0.48],
  [431, 'pop', 0.38],
  [433, 'pop', 0.42],
  [439, 'key', 0.6],
  [455, 'cut', 0.64],
  [469, 'cut', 0.64],
  [485, 'pop', 0.42],
  [489, 'key', 0.6],
  [497, 'click', 0.48],
  [507, 'key', 0.6],
  [511, 'whoosh-short', 0.38],
  [523, 'key', 0.6],
  [537, 'pop', 0.42],
  [547, 'key', 0.6],
  [553, 'click', 0.48],
  [557, 'pop', 0.34],
  [588, 'ding', 0.51],
  // Break
  [600, 'glitch', 0.47],
  [606, 'whoosh-short', 0.42],
  [618, 'glitch', 0.38],
  [634, 'pop', 0.42],
  [656, 'glitch', 0.42],
  // AI features
  [677, 'sparkle', 0.42],
  [681, 'typing', 0.45],
  [723, 'click', 0.48],
  [739, 'key', 0.6],
  [777, 'whoosh-short', 0.42],
  [782, 'sparkle', 0.38],
  [786, 'pop', 0.3],
  [790, 'pop', 0.3],
  [794, 'pop', 0.3],
  [798, 'pop', 0.3],
  [822, 'click', 0.48],
  [840, 'sparkle', 0.38],
  [882, 'whoosh-short', 0.42],
  [887, 'sparkle', 0.38],
  [912, 'click', 0.48],
  [947, 'ding', 0.42],
  [987, 'whoosh-short', 0.42],
  [992, 'sparkle', 0.38],
  [1034, 'whoosh-short', 0.38],
  [1054, 'ding', 0.42],
  [1092, 'whoosh-short', 0.42],
  [1097, 'sparkle', 0.38],
  [1106, 'click', 0.48],
  [1128, 'click', 0.48],
  [1119, 'riser', 0.3],
  [1179, 'sparkle', 0.47],
  [1181, 'ding', 0.42],
  // Outro
  [1190, 'whoosh', 0.45],
  [1204, 'pop', 0.38],
  [1212, 'pop', 0.38],
  [1222, 'pop', 0.42],
  [1234, 'pop', 0.42],
  [1275, 'impact', 0.3],
  [1281, 'sparkle', 0.42],
];
