// Palette, fonts and timing for "Cómo se construyó Machu Picchu".

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 60 * FPS; // 1800 frames

// Music: 120 BPM -> 1 beat = 15 frames, 1 bar = 60 frames (2 s).
export const BEAT = 15;
export const BAR = 60;

// Scene boundaries in frames (aligned to bars of the music).
export const SCENES = {
  hook: { from: 0, duration: 180 }, // 0-6 s
  intro: { from: 180, duration: 120 }, // 6-10 s
  datos: { from: 300, duration: 160 }, // 10-15.3 s
  inca: { from: 460, duration: 80 }, // 15.3-18 s
  reto: { from: 540, duration: 180 }, // 18-24 s
  piedras: { from: 720, duration: 300 }, // 24-34 s
  sismos: { from: 1020, duration: 240 }, // 34-42 s
  subsuelo: { from: 1260, duration: 300 }, // 42-52 s
  mita: { from: 1560, duration: 120 }, // 52-56 s
  final: { from: 1680, duration: 120 }, // 56-60 s
} as const;

export const C = {
  clawd: "#D97757",
  clawdDark: "#B8583A",
  ink: "#0E1116",
  white: "#FFFFFF",
  yellow: "#FFD60A",
  gold: "#FFB703",
  orange: "#FF7A00",
  red: "#FF3B30",
  green: "#39D353",
  blue: "#1E6BFF",
  cyan: "#27C4F5",
  purple: "#7B2FF7",
  // 3D world
  skyTop: "#1552D6",
  skyMid: "#3AA0F2",
  skyHorizon: "#FFE0B8",
  grass: "#5DB84A",
  grassDark: "#2E7D3A",
  forest: "#2F6B35",
  rock: "#8E8A80",
  rockDark: "#5F5B55",
  stone: "#BDB6A8",
  stoneDark: "#8D867A",
  thatch: "#C99B45",
  soil: "#7A4B2A",
  water: "#2F9BEA",
};

export const FONT = {
  heavy: "Montserrat", // 700-900
  fun: "Lilita One",
  title: "Luckiest Guy",
};
