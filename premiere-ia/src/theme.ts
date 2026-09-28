// Shared palette, fonts and musical timing for the whole video.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 45 * FPS; // 1350 frames

// The soundtrack runs at 96 BPM: 1 beat = 0.625 s, 1 bar = 2.5 s = 75 frames.
export const BPM = 96;
export const BEAT = (60 / BPM) * FPS; // 18.75 frames
export const BAR = BEAT * 4; // 75 frames

// Scene boundaries (in frames), aligned to bars of the music.
export const SCENES = {
  intro: {from: 0, duration: 150}, // bars 1-2
  interfaz: {from: 150, duration: 225}, // bars 3-5
  edicion: {from: 375, duration: 225}, // bars 6-8
  iaCard: {from: 600, duration: 75}, // bar 9 (break)
  ia: {from: 675, duration: 525}, // bars 10-16
  outro: {from: 1200, duration: 150}, // bars 17-18
} as const;

export const C = {
  // Poster palette
  red: '#EE1B2E',
  redHot: '#FF2A3D',
  redDark: '#A50F25',
  redDeep: '#6E0A18',
  ink: '#141414',
  white: '#FFFFFF',
  cream: '#FFF6F1',
  pink: '#F5B3AA',
  pinkDeep: '#E08A80',
  yellow: '#FFE14D',
  // Premiere-like UI palette
  ui0: '#161616',
  ui1: '#1D1D1D',
  ui2: '#232323',
  ui3: '#2C2C2C',
  ui4: '#383838',
  uiLine: '#3F3F3F',
  uiText: '#D6D6D6',
  uiDim: '#8C8C8C',
  uiBlue: '#2D8CEB',
  clipVideo: '#8F7FE0',
  clipVideo2: '#6F9CE8',
  clipAudio: '#23B08F',
  clipGraphic: '#E0679A',
  prPurple: '#2A0F4F',
  prPink: '#EA77FF',
  ai: '#B98CFF',
};

export const FONT = {
  display: 'Anton',
  marker: 'Permanent Marker',
  block: 'Archivo Black',
  sign: 'Bungee',
  ui: 'SourceSans',
};
