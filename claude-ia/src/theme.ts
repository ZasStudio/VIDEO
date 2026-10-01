// Paleta, tipografías y tiempos del video "Claude IA".
// El estilo replica la referencia (fondos con orbes desenfocados, chispa luminosa,
// tipografía cinética con una palabra destacada) con colores cálidos tipo Claude.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// Música a 100 BPM: 1 tiempo = 18 frames, 1 compás = 72 frames (2,4 s).
export const BEAT = 18;
export const BAR = 72;

export const C = {
  // Modo oscuro
  ink: '#0F0A08',
  night: '#1A110D',
  ember: '#3A1D12',
  rust: '#8A3A20',
  coral: '#D97757',
  amber: '#F2A65A',
  glow: '#FFB48A',
  spark: '#FFE9D6',
  white: '#FFF8F1',
  muted: 'rgba(255, 240, 228, 0.72)',
  // Modo claro
  cream: '#FAF5EC',
  paper: '#F3E9DA',
  peach: '#F6CDB2',
  butter: '#FBE3B8',
  cocoa: '#2B1D16',
  clay: '#C2603A',
  line: 'rgba(43, 29, 22, 0.18)',
} as const;

export const FONT = {
  sans: 'Manrope, sans-serif',
  serif: 'Instrument Serif, serif',
} as const;
