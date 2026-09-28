// Palette, fonts and timing for "Cómo se construyó Machu Picchu".

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Music: 120 BPM -> 1 beat = 15 frames, 1 bar = 60 frames (2 s).
export const BEAT = 15;
export const BAR = 60;

// Scene boundaries and the total duration come from the narration: see timeline.ts.

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
